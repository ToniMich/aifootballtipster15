// supabase/functions/get-prediction/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/cors.ts'

// Fix for "Cannot find name 'Deno'" error in Supabase Edge Functions.
declare const Deno: any;

serve(async (req: Request) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  try {
    const { jobId } = await req.json()
    if (!jobId) {
      throw new Error('Missing required jobId parameter.')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('[Configuration Error] Supabase credentials are not configured on the server.');
    }
    
    // Note: Using the service_role_key to bypass RLS for this server-to-server action.
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: prediction, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('id', jobId)
        .single()

    if (error) {
        if (error.code === 'PGRST116') { // PostgREST code for "No rows found"
            return new Response(JSON.stringify({ error: `Prediction with ID ${jobId} not found.` }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404,
            });
        }
        throw new Error(`[Database Error] ${error.message}`);
    }

    return new Response(JSON.stringify(prediction), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in get-prediction function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
