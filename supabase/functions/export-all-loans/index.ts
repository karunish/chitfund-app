// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'content-disposition',
}

// Helper to convert array of objects to CSV string
function toCsv(data: any[], columns: string[], columnMap: Record<string, string>): string {
  const header = columns.map(col => columnMap[col]).join(',') + '\n';
  const rows = data.map(row => {
    return columns.map(col => {
      let val;
      if (col === 'user_full_name') {
        val = `${row.user?.first_name || ''} ${row.user?.last_name || ''}`.trim();
      } else {
        val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
      }
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

    const { data: loans, error } = await supabaseAdmin
      .from('loan_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name');
    if (profilesError) throw profilesError;

    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    const mergedData = loans.map(loan => ({
      ...loan,
      user: profilesMap.get(loan.user_id) || null
    }));

    const columns = ['id', 'user_full_name', 'user_email', 'amount', 'status', 'created_at', 'due_date', 'processed_at', 'guarantor_name', 'reason'];
    const columnMap = {
      'id': 'Loan ID',
      'user_full_name': 'User Name',
      'user_email': 'User Email',
      'amount': 'Amount',
      'status': 'Status',
      'created_at': 'Issue Date',
      'due_date': 'Due Date',
      'processed_at': 'Processed Date',
      'guarantor_name': 'Guarantor Name',
      'reason': 'Reason',
    };
    const csvData = toCsv(mergedData, columns, columnMap);
    
    const headers = {
      ...corsHeaders,
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="all_loans_export_${new Date().toISOString().split('T')[0]}.csv"`,
    };

    return new Response(csvData, { headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})