// supabase/functions/_shared/cors.ts

// Standard CORS headers for all Edge Functions.
// These headers are sent back to the browser during a preflight OPTIONS request
// to tell the browser that it's safe for the frontend (running on a different domain)
// to make requests to this Supabase function.
export const corsHeaders = {
  // 'Access-Control-Allow-Origin': '*' allows any domain to make requests.
  // For production, you might want to restrict this to your specific frontend domain
  // (e.g., 'https://aifootballtipster.app').
  'Access-Control-Allow-Origin': '*',

  // 'Access-Control-Allow-Methods' specifies which HTTP methods are allowed.
  // We need POST for sending data, GET for retrieving, and OPTIONS for the preflight check.
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',

  // 'Access-Control-Allow-Headers' specifies which headers the browser is allowed to include
  // in the actual request. The Supabase client sends these by default.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}