// supabase/functions/get-config/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../shared/cors.ts'

// Fix for "Cannot find name 'Deno'" error in Supabase Edge Functions.
declare const Deno: any;

serve(async (req: Request) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  try {
    // These variables need to be set in the Supabase project's environment variables settings.
    const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('VITE_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Configuration Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY are not set in the Edge Function environment.');
      throw new Error('[Configuration Error] The public Supabase credentials are not configured on the server.');
    }

    return new Response(JSON.stringify({ supabaseUrl, supabaseAnonKey }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error in get-config function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
