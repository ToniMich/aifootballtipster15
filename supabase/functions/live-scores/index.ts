// supabase/functions/live-scores/index.ts

import { corsHeaders } from '../shared/cors.ts'

declare const Deno: any;

// Type definition copied from the main project's types.ts for robustness.
interface LiveMatch {
    id: string;
    league: string;
    teamA: string;
    teamB: string;
    scoreA: number | null;
    scoreB: number | null;
    time: string;
    status: 'LIVE' | 'HT' | 'FT' | 'Not Started';
}

interface TheSportsDBEvent {
    idLiveScore: string;
    strLeague: string;
    strHomeTeam: string;
    strAwayTeam: string;
    intHomeScore: string | null;
    intAwayScore: string | null;
    strProgress: string;
    strStatus: string;
}

// Normalizes raw data from TheSportsDB API into the clean LiveMatch format.
const normalizeMatchData = (events: TheSportsDBEvent[]): LiveMatch[] => {
    if (!Array.isArray(events)) {
        return [];
    }
    
    return events.map((m): LiveMatch => {
        const parseScore = (v: any): number | null => {
            if (v === null || v === undefined || v === '') return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        };
        
        const homeScore = parseScore(m.intHomeScore);
        const awayScore = parseScore(m.intAwayScore);
        
        const rawStatus = (m.strProgress ?? m.strStatus ?? '').toString() || 'Not Started';
        const displayStatus = rawStatus.toUpperCase();

        let status: LiveMatch['status'] = 'Not Started';
        let time = rawStatus;

        if (/^\d+'?$/.test(rawStatus)) {
            status = 'LIVE';
            time = rawStatus.endsWith("'") ? rawStatus : `${rawStatus}'`;
        } else if (displayStatus.includes('LIVE') || displayStatus.includes('1ST HALF') || displayStatus.includes('2ND HALF')) {
            status = 'LIVE';
            time = rawStatus.includes("'") ? rawStatus : 'Live';
        } else if (displayStatus.includes('HALFTIME') || displayStatus === 'HT') {
            status = 'HT';
            time = 'HT';
        } else if (displayStatus.includes('FINISHED') || displayStatus === 'FT') {
            status = 'FT';
            time = 'FT';
        } else if (/\d{2}:\d{2}/.test(rawStatus)) {
            status = 'Not Started';
            const tm = rawStatus.match(/\d{2}:\d{2}/);
            time = tm ? tm[0] : rawStatus;
        }

        return {
            id: m.idLiveScore,
            league: m.strLeague ?? 'Unknown League',
            teamA: m.strHomeTeam ?? 'Team A',
            teamB: m.strAwayTeam ?? 'Team B',
            scoreA: homeScore,
            scoreB: awayScore,
            time,
            status
        };
    }).filter(m => m.status !== 'FT'); // We don't need to show finished matches in the live scores.
};

Deno.serve(async (req: Request) => {
  // Handle preflight OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Enforce that only GET requests are allowed for this function
    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed. Please use GET.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 405, // Method Not Allowed
        });
    }

    const apiKey = Deno.env.get('THESPORTSDB_API_KEY');
    if (!apiKey) {
      throw new Error('[Configuration Error] TheSportsDB API key is not configured on the server.');
    }

    const apiUrl = `https://www.thesportsdb.com/api/v1/json/${apiKey}/livescore.php?s=Soccer`;
    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch from TheSportsDB API. Status: ${response.status}`);
    }

    const data: { livescore?: TheSportsDBEvent[] } = await response.json();
    
    const normalizedMatches = normalizeMatchData(data.livescore || []);

    return new Response(JSON.stringify({ matches: normalizedMatches }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
    
  } catch (error) {
    console.error('Error in live-scores function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // Use 500 for internal server errors
    });
  }
});
