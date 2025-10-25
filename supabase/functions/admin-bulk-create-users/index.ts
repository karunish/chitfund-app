// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to generate a random password
const generatePassword = (length = 10) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

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

    // 2. Get user list from request body
    const { users } = await req.json();
    if (!users || !Array.isArray(users)) {
        return new Response(JSON.stringify({ error: 'Request body must contain a "users" array.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    const results = {
        successes: [],
        failures: [],
    };

    // 3. Loop through and create each user
    for (const user of users) {
        const { firstName, lastName } = user;
        const fullName = `${firstName} ${lastName}`;

        try {
            if (!firstName || !lastName) {
                throw new Error("Each user must have a firstName and lastName.");
            }

            const now = new Date();
            const month = String(now.getMonth() + 1).padStart(2, '0'); // JS months are 0-indexed
            const year = String(now.getFullYear()).slice(-2);
            const firstInitial = firstName.charAt(0).toUpperCase();
            const lastInitial = lastName.charAt(0).toUpperCase();
            // Add a random suffix to prevent collisions for users with same initials created in the same month
            const randomSuffix = Math.floor(100 + Math.random() * 900);

            const username = `${firstInitial}${lastInitial}${month}${year}${randomSuffix}`;
            const email = `${username}@withusfs.com`;
            const password = generatePassword();
            const generatedReferenceName = Math.random().toString(36).substring(2, 8).toUpperCase();

            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    first_name: firstName,
                    last_name: lastName,
                    reference_name: generatedReferenceName,
                    role: 'user',
                }
            });

            if (createError) {
                throw createError;
            }

            results.successes.push({ name: fullName, email, password });

        } catch (error) {
            results.failures.push({ name: fullName, error: error.message });
        }
    }

    return new Response(JSON.stringify(results), {
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