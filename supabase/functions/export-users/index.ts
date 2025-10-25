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

    // Fetch ALL users from auth schema using pagination
    const allUsers = [];
    let page = 1;
    const perPage = 1000; // Use max per page to minimize requests
    let hasMore = true;

    while(hasMore) {
      const { data: { users: userBatch }, error: authError } = await supabaseAdmin.auth.admin.listUsers({
        page: page,
        perPage: perPage,
      });

      if (authError) {
        throw authError;
      }

      if (userBatch && userBatch.length > 0) {
        allUsers.push(...userBatch);
        page++;
        if (userBatch.length < perPage) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    // Fetch profiles from public schema
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*');
    if (profilesError) throw profilesError;

    // Create a map of profiles for easy lookup
    const profilesMap = new Map(profiles.map((p: any) => [p.id, p]));

    // Merge auth user data with profile data
    const mergedData = allUsers.map(user => {
      const profile = profilesMap.get(user.id);
      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at || 'Never',
        first_name: profile?.first_name || '',
        last_name: profile?.last_name || '',
        reference_name: profile?.reference_name || '',
        role: profile?.role || 'user',
        outstanding_amount: profile?.outstanding_amount || 0,
      };
    });

    const columns = ['id', 'email', 'first_name', 'last_name', 'role', 'outstanding_amount', 'reference_name', 'last_sign_in_at', 'created_at'];
    const csvData = toCsv(mergedData, columns);
    
    const headers = {
      ...corsHeaders,
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="users_export_${new Date().toISOString().split('T')[0]}.csv"`,
    };

    return new Response(csvData, { headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})