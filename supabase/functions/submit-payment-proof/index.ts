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
    // Create a Supabase client with the service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Authorization header missing");
    
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) throw new Error("User not authenticated");

    // Fetch user's profile to get their name
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();
    if (profileError) throw new Error(`Could not fetch user profile: ${profileError.message}`);

    // 2. Parse form data from the request
    const formData = await req.formData();
    const file = formData.get('proof');
    const year = formData.get('year');
    const month = formData.get('month');

    if (!file || !year || !month) {
      return new Response(JSON.stringify({ error: 'Missing required fields: proof, year, or month.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 3. Upload the file to storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('payment-proofs')
      .upload(filePath, file, {
        contentType: file.type,
      });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    // 4. Insert the record into the database
    const contributionMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
    const userFullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();

    const { error: dbError } = await supabaseAdmin.from('payment_proofs').insert({
      user_id: user.id,
      user_full_name: userFullName,
      contribution_month: contributionMonth.toISOString(),
      file_path: filePath,
      status: 'pending', // Explicitly set status
    });
    if (dbError) {
      // If DB insert fails, try to clean up the orphaned file in storage
      await supabaseAdmin.storage.from('payment-proofs').remove([filePath]);
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    // 5. Return success
    return new Response(JSON.stringify({ message: "Proof submitted successfully" }), {
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