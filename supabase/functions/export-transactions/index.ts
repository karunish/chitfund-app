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
    // Use the service role key to bypass RLS for a full data export
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const columns = ['id', 'created_at', 'user_id', 'type', 'amount', 'description', 'user_full_name'];
    const csvData = toCsv(data, columns);
    
    const headers = {
      ...corsHeaders,
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="transactions_export_${new Date().toISOString().split('T')[0]}.csv"`,
    };

    return new Response(csvData, { headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})