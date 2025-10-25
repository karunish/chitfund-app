// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { addMonths, format } from "https://esm.sh/date-fns@2.30.0";

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
    const { userId, startYear, startMonth, endYear, endMonth } = await req.json();
    if (userId === undefined || startYear === undefined || startMonth === undefined || endYear === undefined || endMonth === undefined) {
        return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    // 3. Fetch user's full name
    const { data: userProfile, error: userProfileError } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', userId)
      .single();
    
    if (userProfileError) {
      throw new Error(`Could not fetch user profile: ${userProfileError.message}`);
    }
    if (!userProfile) {
      throw new Error(`Profile not found for user ID: ${userId}`);
    }
    const userFullName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim();

    // 4. Loop through months and create transactions
    const startDate = new Date(startYear, startMonth, 1);
    const endDate = new Date(endYear, endMonth, 1);
    let currentDate = startDate;
    let contributionsAdded = 0;

    while (currentDate <= endDate) {
      const monthName = format(currentDate, 'MMMM yyyy');
      const { error: rpcError } = await supabaseAdmin.rpc('admin_create_transaction', {
        p_user_id: userId,
        p_type: 'deposit',
        p_amount: 500,
        p_description: `Monthly contribution for ${monthName}`,
        p_user_full_name: userFullName,
        p_transaction_date: currentDate.toISOString(),
      });

      if (rpcError) {
        throw new Error(`Failed to create transaction for ${monthName}: ${rpcError.message}`);
      }
      
      contributionsAdded++;
      currentDate = addMonths(currentDate, 1);
    }

    return new Response(JSON.stringify({ message: `Successfully added ${contributionsAdded} contributions.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in admin-bulk-add-contributions:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})