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

    const { error } = await supabaseAdmin.rpc('increment_outstanding_amounts', { amount_to_add: 500 });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ message: "Successfully updated outstanding amounts for all users by 500." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in monthly-dues function:', error);
    return new Response(JSON.stringify({ error: error.message, details: error }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})