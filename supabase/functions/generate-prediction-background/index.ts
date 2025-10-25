// supabase/functions/generate-prediction-background/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Fix for "Cannot find name 'Deno'" error in Supabase Edge Functions.
declare const Deno: any;

serve(async (req: Request) => {
    // This function acts as a proxy to trigger the gemini-predict function
    // in a fire-and-forget manner, allowing the initial request to return quickly.
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('[Configuration Error] Supabase credentials for background invocation are not configured.');
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
        const body = await req.json();

        // Invoke the gemini-predict function without awaiting it.
        supabaseAdmin.functions.invoke('gemini-predict', {
            body: body,
        }).catch(err => console.error("Error invoking gemini-predict function:", err.message));

        // Return an immediate success response to the caller.
        return new Response(JSON.stringify({ success: true, message: "Prediction job forwarded." }), { status: 200 });

    } catch (error) {
        console.error('Error in generate-prediction-background function:', error.message);
        // This error response is for the function that called this one (request-prediction),
        // not for the end-user.
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});