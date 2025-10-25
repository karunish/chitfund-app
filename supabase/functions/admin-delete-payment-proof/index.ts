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

    // 2. Get proof ID from request body
    const { proofId } = await req.json();
    if (!proofId) {
        return new Response(JSON.stringify({ error: 'Missing proofId.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    // 3. Fetch the proof to get the file path
    const { data: proof, error: fetchError } = await supabaseAdmin
      .from('payment_proofs')
      .select('file_path')
      .eq('id', proofId)
      .single();

    if (fetchError) {
      console.warn(`Could not fetch proof ${proofId} to delete file, it may already be gone.`);
    }

    // 4. Delete the database record
    const { error: deleteDbError } = await supabaseAdmin
      .from('payment_proofs')
      .delete()
      .eq('id', proofId);

    if (deleteDbError) {
        throw deleteDbError;
    }

    // 5. Delete the file from storage if it was found
    if (proof && proof.file_path) {
        const { error: storageError } = await supabaseAdmin
            .storage
            .from('payment-proofs')
            .remove([proof.file_path]);
        if (storageError) {
            console.error('Failed to delete file from storage during proof deletion:', storageError.message);
        }
    }

    return new Response(JSON.stringify({ message: "Payment proof deleted successfully" }), {
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