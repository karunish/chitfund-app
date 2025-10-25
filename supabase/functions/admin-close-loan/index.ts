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
    if (!user) throw new Error("User not authenticated");
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

    // 2. Get loan ID from request body
    const { loanId } = await req.json();
    if (!loanId) {
        return new Response(JSON.stringify({ error: 'Missing loanId.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    // 3. Update the loan status to 'closed'
    const { error: updateError } = await supabaseAdmin
      .from('loan_requests')
      .update({ status: 'closed', processed_at: new Date().toISOString() })
      .eq('id', loanId);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ message: "Loan marked as closed successfully" }), {
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