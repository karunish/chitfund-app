// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'content-disposition',
}

// Helper to convert array of objects to CSV string
function toCsv(data: any[], columns: string[]): string {
  const header = columns.join(',') + '\n';
  const rows = data.map(row => {
    return columns.map(col => {
      let val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
      // Escape commas, quotes, and newlines
      val = val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val.replace(/"/g, '""')}"` : val;
      return val;
    }).join(',');
  }).join('\n');
  return header + rows;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Check if the user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Authorization header missing");
    
    const { data: { user: adminUser } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!adminUser) throw new Error("Admin user not authenticated");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single();

    if (profileError || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'You must be an admin to perform this action.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // 2. Get user ID from request body
    const { userId } = await req.json();
    if (!userId) {
        return new Response(JSON.stringify({ error: 'Missing userId.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    // 3. Fetch loan history for the user
    const { data, error } = await supabaseAdmin
      .from('loan_requests')
      .select('id, created_at, amount, reason, status, processed_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // 4. Convert to CSV and return
    const columns = ['id', 'created_at', 'amount', 'reason', 'status', 'processed_at'];
    const csvData = toCsv(data, columns);
    
    const headers = {
      ...corsHeaders,
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="loan_history_${userId}_${new Date().toISOString().split('T')[0]}.csv"`,
    };

    return new Response(csvData, { headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})