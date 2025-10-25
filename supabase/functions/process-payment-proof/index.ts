// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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
    const { proofId, status, notes } = await req.json();
    if (!proofId || !status || !['approved', 'rejected'].includes(status)) {
        return new Response(JSON.stringify({ error: 'Missing or invalid required fields.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
    if (status === 'rejected' && !notes) {
        return new Response(JSON.stringify({ error: 'Rejection notes are required.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    // 3. Fetch the payment proof
    const { data: proof, error: fetchError } = await supabaseAdmin
      .from('payment_proofs')
      .select('*')
      .eq('id', proofId)
      .single();

    if (fetchError || !proof) {
      throw new Error(`Payment proof not found. Error: ${fetchError?.message}`);
    }
    if (proof.status !== 'pending') {
      throw new Error('This proof has already been processed.');
    }

    // 4. Process based on status
    if (status === 'approved') {
      // Call RPC to create transaction
      const { error: rpcError } = await supabaseAdmin.rpc('admin_create_transaction', {
        p_user_id: proof.user_id,
        p_type: 'deposit',
        p_amount: 500,
        p_description: `Monthly contribution for ${new Date(proof.contribution_month).toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        p_user_full_name: proof.user_full_name,
        p_transaction_date: proof.contribution_month,
      });
      if (rpcError) throw rpcError;
    }

    // 5. Update the proof status
    const { error: updateError } = await supabaseAdmin
      .from('payment_proofs')
      .update({ status, notes, processed_by: adminUser.id, processed_at: new Date().toISOString() })
      .eq('id', proofId);
    if (updateError) throw updateError;

    // 6. Create a notification for the user
    const contributionMonthFormatted = new Date(proof.contribution_month).toLocaleString('default', { month: 'long', year: 'numeric' });
    let notificationPayload;

    if (status === 'approved') {
      notificationPayload = {
        user_id: proof.user_id,
        title: 'Contribution Approved',
        message: `Your contribution for ${contributionMonthFormatted} has been approved.`,
        link: '/contribute'
      };
    } else { // status === 'rejected'
      notificationPayload = {
        user_id: proof.user_id,
        title: 'Contribution Rejected',
        message: `Your contribution for ${contributionMonthFormatted} was rejected. Reason: ${notes}`,
        link: '/contribute'
      };
    }

    const { error: notificationError } = await supabaseAdmin
      .from('notifications')
      .insert(notificationPayload);

    if (notificationError) {
      // Log the error but don't fail the whole transaction, as the primary action (processing proof) succeeded.
      console.error('Failed to create notification:', notificationError.message);
    }

    // 7. Delete the file from storage
    const { error: storageError } = await supabaseAdmin
      .storage
      .from('payment-proofs')
      .remove([proof.file_path]);
    if (storageError) {
      console.error('Failed to delete file from storage:', storageError.message);
    }

    return new Response(JSON.stringify({ message: `Proof successfully ${status}.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in process-payment-proof function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})