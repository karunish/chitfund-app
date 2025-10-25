// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { startOfMonth, endOfMonth } from "https://esm.sh/date-fns@2.30.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Admin check
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

    // 2. Get month and year from request body
    const { year, month } = await req.json(); // month is 0-indexed (0-11)
    if (year === undefined || month === undefined) {
        return new Response(JSON.stringify({ error: 'Missing year or month.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    const aDate = new Date(year, month, 1);
    const startDate = startOfMonth(aDate).toISOString();
    const endDate = endOfMonth(aDate).toISOString();

    // 3. Fetch loans due in the selected month
    const { data: loans, error: loansError } = await supabaseAdmin
      .from('loan_requests')
      .select('id, created_at, due_date, amount, status, user_id, guarantor_name')
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .in('status', ['in-process', 'closed']);
    
    if (loansError) throw loansError;
    if (!loans || loans.length === 0) {
      return new Response(JSON.stringify({ repaymentList: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Fetch necessary related data
    const userIds = [...new Set(loans.map(l => l.user_id))];
    const { data: profiles, error: profilesError } = await supabaseAdmin.from('profiles').select('id, first_name, last_name').in('id', userIds);
    if (profilesError) throw profilesError;
    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    const { data: loanTiers, error: tiersError } = await supabaseAdmin.from('loan_tiers').select('amount, fine');
    if (tiersError) throw tiersError;
    const tiersMap = new Map(loanTiers.map(t => [t.amount, t.fine]));

    // 5. Format the final list
    const repaymentList = loans.map(loan => {
      const userProfile = profilesMap.get(loan.user_id);
      const fine = tiersMap.get(loan.amount) || 0;
      return {
        userName: `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim(),
        loanTakenDate: loan.created_at,
        loanAmount: loan.amount,
        loanReturnDate: loan.due_date,
        loanReturnAmount: loan.amount + fine,
        guarantorName: loan.guarantor_name || 'N/A',
        status: loan.status, // 'in-process' or 'closed'
      };
    });

    return new Response(JSON.stringify({ repaymentList }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})