// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { addMonths } from "https://esm.sh/date-fns@2.30.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // 2. Get data from request body
    const { loanId, status, rejection_reason } = await req.json();
    if (!loanId || !status || !['approved', 'rejected'].includes(status)) {
        return new Response(JSON.stringify({ error: 'Missing or invalid required fields.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
    if (status === 'rejected' && !rejection_reason) {
      return new Response(JSON.stringify({ error: 'Rejection reason is required.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
      });
    }

    // 3. Fetch the loan request
    const { data: loanRequest, error: fetchError } = await supabaseAdmin
      .from('loan_requests')
      .select('*')
      .eq('id', loanId)
      .single();

    if (fetchError || !loanRequest) {
      throw new Error(`Loan request not found. Error: ${fetchError?.message}`);
    }
    if (loanRequest.status !== 'pending') {
      throw new Error('This loan request has already been processed.');
    }

    // 4. Prepare the update payload
    const updatePayload: { 
      status: string; 
      processed_by: string; 
      processed_at: string; 
      rejection_reason?: string;
      due_date?: string | null;
    } = {
      status,
      processed_by: adminUser.id,
      processed_at: new Date().toISOString(),
      rejection_reason: status === 'rejected' ? rejection_reason : undefined,
    };

    // 5. If approved, find the loan tier and calculate due date
    if (status === 'approved') {
      const { data: loanTier, error: tierError } = await supabaseAdmin
        .from('loan_tiers')
        .select('repayment_info')
        .eq('amount', loanRequest.amount)
        .single();

      if (tierError || !loanTier) {
        throw new Error(`Could not find loan tier for amount ${loanRequest.amount}. Error: ${tierError?.message}`);
      }
      
      const repaymentString = loanTier.repayment_info;
      const monthsMatch = repaymentString.match(/(\d+)\s+Months/);
      if (monthsMatch && monthsMatch[1]) {
          const monthsToAdd = parseInt(monthsMatch[1], 10);
          if (!isNaN(monthsToAdd)) {
              updatePayload.due_date = addMonths(new Date(), monthsToAdd).toISOString();
          }
      }
    }

    // 6. Update the loan request itself
    const { error: updateError } = await supabaseAdmin
      .from('loan_requests')
      .update(updatePayload)
      .eq('id', loanId);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ message: `Loan request successfully ${status}.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in process-loan-request function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})