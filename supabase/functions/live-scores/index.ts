// supabase/functions/live-scores/index.ts

import { corsHeaders } from '../_shared/cors.ts'

// Fix for "Cannot find name 'Deno'" error in Supabase Edge Functions.
declare const Deno: any;

const API_TIMEOUT_MS = 8000;

interface TheSportsDBEvent {
  idEvent: string | null;
  strLeague: string | null;
  strHomeTeam: string | null;
  strAwayTeam: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus: string | null;
}

// A robust normalization function to safely process API data
const normalizeMatchData = (event: TheSportsDBEvent) => {
    const parseScore = (score: string | null): number | null => {
        if (score === null) return null;
        const num = parseInt(score, 10);
        return isNaN(num) ? null : num;
    };

    return {
        idEvent: event.idEvent,
        league: event.strLeague ?? 'Unknown League',
        home: event.strHomeTeam ?? 'Team A',
        away: event.strAwayTeam ?? 'Team B',
        homeScore: parseScore(event.intHomeScore),
        awayScore: parseScore(event.intAwayScore),
        status: event.strStatus ?? 'Not Started',
    };
};

Deno.serve(async (req: Request) => {
  // Handle preflight OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('THESPORTSDB_API_KEY');
    if (!apiKey) {
      // This is a critical server configuration issue.
      throw new Error('Server configuration error: TheSportsDB API key is missing.');
    }

    const upstreamUrl = `https://www.thesportsdb.com/api/v1/json/${apiKey}/livescore.php?s=Soccer`;
    
    // Create a timeout controller for the external API fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch(upstreamUrl, { signal: controller.signal });
    clearTimeout(timeoutId); // Clear the timeout if the fetch was successful

    // Read the response body as text to handle both JSON and non-JSON error responses gracefully
    const responseText = await response.text();

    if (!response.ok) {
        // The upstream API returned a non-2xx status (e.g., 403, 500)
        throw new Error(`The live scores service returned an error. Status: ${response.status}. Response: ${responseText}`);
    }
    
    let data;
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        // The upstream API returned a 200 status but with an invalid JSON body
        throw new Error(`Received an invalid response from the live scores provider. Response: ${responseText}`);
    }

    // The SportsDB API for v1 returns `{ events: [...] }` on success or `{ events: null }` if none are live.
    const rawEvents: TheSportsDBEvent[] | null = data.events;

    // Normalize the data, ensuring we handle the case where `rawEvents` is null or not an array.
    const matches = Array.isArray(rawEvents)
        ? rawEvents.map(normalizeMatchData)
        : [];

    const responsePayload = {
        cached: false, // This function performs a live fetch, so caching is always false.
        matches: matches,
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Critical error in live-scores function:', error);
    // Propagate a clear error message to the client with a 500 status.
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});