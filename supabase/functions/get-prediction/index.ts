// supabase/functions/get-prediction/index.ts

import { corsHeaders } from '../shared/cors.ts'
import { supabaseAdminClient as supabase } from '../shared/init.ts'

declare const Deno: any;

Deno.serve(async (req: Request) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Fix: Add type definition for the JSON body to resolve property access errors.
    const { jobId }: { jobId: string } = await req.json();
    if (!jobId) {
      throw new Error('Missing required jobId parameter.')
    }

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
      status: 400,
    })
  }
})