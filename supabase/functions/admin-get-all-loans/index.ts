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

    // 2. Get parameters from request body
    const { statusFilter } = await req.json();

    // 3. Build the query for loans
    let loanQuery = supabaseAdmin
      .from('loan_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      loanQuery = loanQuery.eq('status', statusFilter);
    }
    
    const { data: loans, error: loansError } = await loanQuery;
    if (loansError) throw loansError;

    // 4. Fetch all profiles to merge names
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name');
    if (profilesError) throw profilesError;

    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    // 5. Merge the data
    const mergedLoans = loans.map(loan => ({
      ...loan,
      user: profilesMap.get(loan.user_id) || null
    }));

    // 6. Return the data
    return new Response(JSON.stringify({ loans: mergedLoans }), {
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