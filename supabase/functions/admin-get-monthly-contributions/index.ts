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

    // 3. Get all user profiles
    const { data: allUsers, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('role', 'user')
      .order('first_name', { ascending: true })
      .order('last_name', { ascending: true });

    if (usersError) throw usersError;

    // 4. Get all 'deposit' transactions for the month from the main transactions table
    const { data: monthlyDeposits, error: depositsError } = await supabaseAdmin
      .from('transactions')
      .select('user_id')
      .eq('type', 'deposit')
      .not('user_id', 'is', null)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (depositsError) throw depositsError;

    const paidUserIds = new Set(monthlyDeposits.map(p => p.user_id));

    // 5. Combine the data
    const contributionList = allUsers.map(user => ({
      fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim().toUpperCase(),
      status: paidUserIds.has(user.id) ? 'paid' : 'pending'
    }));

    return new Response(JSON.stringify({ contributionList }), {
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