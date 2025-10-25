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

    // 2. Get loan data from request body
    const {
      userId,
      amount,
      reason,
      guarantorId,
      status,
      issueDate, // created_at
      dueDate,   // due_date
    } = await req.json();

    if (!userId || !amount || !guarantorId || !status || !issueDate || !['pending', 'in-process', 'rejected', 'closed'].includes(status)) {
        return new Response(JSON.stringify({ error: 'Missing or invalid required fields.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    // 3. Fetch user and guarantor names
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', [userId, guarantorId]);
    if (usersError) throw usersError;

    const userProfile = users.find(u => u.id === userId);
    const guarantorProfile = users.find(u => u.id === guarantorId);
    const userFullName = `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim();
    const guarantorName = `${guarantorProfile?.first_name || ''} ${guarantorProfile?.last_name || ''}`.trim();

    // 4. Insert the new loan request
    const { data: newLoan, error: insertError } = await supabaseAdmin
      .from('loan_requests')
      .insert({
        user_id: userId,
        user_email: (await supabaseAdmin.auth.admin.getUserById(userId)).data.user?.email,
        amount,
        reason,
        guarantor_id: guarantorId,
        guarantor_name: guarantorName,
        status,
        created_at: issueDate,
        due_date: dueDate,
        processed_by: status !== 'pending' ? adminUser.id : null,
        processed_at: status !== 'pending' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 5. If in-process or closed, handle financial updates
    if (status === 'in-process' || status === 'closed') {
      const { data: loanTier, error: tierError } = await supabaseAdmin
        .from('loan_tiers')
        .select('fine')
        .eq('amount', amount)
        .single();

      if (tierError || !loanTier) {
        throw new Error(`Could not find loan tier for amount ${amount}. Error: ${tierError?.message}`);
      }

      const totalAmountToAdd = amount + loanTier.fine;

      // Update outstanding amount
      const { error: rpcError } = await supabaseAdmin.rpc('increment_user_outstanding_amount', {
        user_uuid: userId,
        amount_to_add: totalAmountToAdd,
      });
      if (rpcError) throw rpcError;

      // Create personal transaction log
      const { error: personalLogError } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'withdrawal',
          amount: amount,
          description: `Loan of $${amount.toLocaleString('en-IN')} approved. Total outstanding: $${totalAmountToAdd.toLocaleString('en-IN')}.`,
          user_full_name: userFullName,
          created_at: issueDate, // Use the historical issue date
        });
      if (personalLogError) throw personalLogError;

      // Create public transaction log
      const { error: publicLogError } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: null,
          type: 'withdrawal',
          amount: amount,
          description: 'Loan',
          user_full_name: userFullName,
          created_at: issueDate, // Use the historical issue date
        });
      if (publicLogError) throw publicLogError;
    }

    return new Response(JSON.stringify({ message: "Loan created successfully", loan: newLoan }), {
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