// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) throw new Error("Admin user not authenticated");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'You must be an admin to perform this action.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // 2. Get loanId from body
    const { loanId } = await req.json();
    if (!loanId) {
      return new Response(JSON.stringify({ error: 'Missing loanId.' }), {
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
    if (loanRequest.status !== 'approved') {
      throw new Error('This loan is not in an approved state ready for disbursement.');
    }

    // 4. Perform financial updates
    const { data: loanTier, error: tierError } = await supabaseAdmin
      .from('loan_tiers')
      .select('fine')
      .eq('amount', loanRequest.amount)
      .single();

    if (tierError || !loanTier) {
      throw new Error(`Could not find loan tier for amount ${loanRequest.amount}. Error: ${tierError?.message}`);
    }

    const totalAmountToAdd = loanRequest.amount + loanTier.fine;

    await supabaseAdmin.rpc('increment_user_outstanding_amount', {
      user_uuid: loanRequest.user_id,
      amount_to_add: totalAmountToAdd,
    });

    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', loanRequest.user_id)
      .single();
    const userFullName = `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || 'N/A';

    await supabaseAdmin.from('transactions').insert({
      user_id: loanRequest.user_id,
      type: 'withdrawal',
      amount: loanRequest.amount,
      description: `Loan of $${loanRequest.amount.toLocaleString('en-IN')} disbursed. Total outstanding: $${totalAmountToAdd.toLocaleString('en-IN')}.`,
      user_full_name: userFullName,
    });

    await supabaseAdmin.from('transactions').insert({
      user_id: null,
      type: 'withdrawal',
      amount: loanRequest.amount,
      description: 'Loan',
      user_full_name: userFullName,
    });

    // 5. Update the loan status to 'in-process'
    const { error: updateError } = await supabaseAdmin
      .from('loan_requests')
      .update({ status: 'in-process' })
      .eq('id', loanId);
    if (updateError) throw updateError;

    // 6. Create notification for user
    await supabaseAdmin.from('notifications').insert({
      user_id: loanRequest.user_id,
      title: 'Loan Disbursed',
      message: `Your loan of $${loanRequest.amount.toLocaleString('en-IN')} has been disbursed.`,
      link: '/loan-request'
    });

    return new Response(JSON.stringify({ message: `Loan successfully disbursed.` }), {
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