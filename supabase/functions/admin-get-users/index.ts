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

    // 1. Check if the user is an admin
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

    // 2. Get pagination parameters from request body
    const { page = 1, perPage = 30 } = await req.json();

    // 3. Fetch a paginated list of users from auth schema
    const { data: { users, total }, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: page,
      perPage: perPage,
    });
    if (authError) throw authError;

    // 4. Fetch all profiles from public schema to merge data
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*');
    if (profilesError) throw profilesError;

    const profilesMap = new Map(profiles.map((p: any) => [p.id, p]));

    const mergedData = users.map(u => {
      const userProfile = profilesMap.get(u.id) || {};
      return {
        ...u,
        ...userProfile,
        id: u.id,
      };
    });

    // 5. Return paginated users and the total count
    return new Response(JSON.stringify({ users: mergedData, total }), {
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