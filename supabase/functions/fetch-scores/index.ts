// supabase/functions/fetch-scores/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

// Fix for "Cannot find name 'Deno'" error in Supabase Edge Functions.
declare const Deno: any;

interface SportsDBEvent {
  idEvent: string;
  strLeague: string;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus: string;
  strTime: string;
}

/**
 * Maps a raw event from TheSportsDB API to the LiveMatch format used by the frontend.
 * @param {SportsDBEvent} event - The raw event object.
 * @returns {object} A formatted LiveMatch object.
 */
function mapEventToLiveMatch(event: SportsDBEvent) {
    const time = event.strStatus?.match(/^\d+'/) ? event.strStatus : (event.strStatus || 'NS');
    let status: 'LIVE' | 'HT' | 'FT' | 'Not Started' = 'Not Started';

    if (time.includes("'")) {
        status = 'LIVE';
    } else if (time.toLowerCase().includes('half time') || time === 'HT') {
        status = 'HT';
    } else if (time.toLowerCase().includes('finished') || time === 'FT') {
        status = 'FT';
    }

    return {
        id: event.idEvent,
        league: event.strLeague,
        teamA: event.strHomeTeam,
        teamB: event.strAwayTeam,
        scoreA: event.intHomeScore ? parseInt(event.intHomeScore, 10) : null,
        scoreB: event.intAwayScore ? parseInt(event.intAwayScore, 10) : null,
        time: time,
        status: status,
    };
}

serve(async (req: Request) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  try {
    const apiKey = Deno.env.get('THESPORTSDB_API_KEY');

    if (!apiKey) {
      throw new Error('[Configuration Error] The API key for live scores is not configured.');
    }
    
    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsday.php?d=${formattedDate}&s=Soccer`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch from TheSportsDB. Status: ${response.status}`);
    
    const data = await response.json();
    
    if (!data || !data.events) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const allowedLeagueKeywords = [
        'premier league', 'la liga', 'bundesliga', 'serie a', 'ligue 1', 'eredivisie', 'primeira liga',
        'champions league', 'europa league', 'conference league', 'fifa world cup', 'uefa european championship',
        'copa america', 'africa cup of nations', 'major league soccer', 'mls', 'liga mx', 'brasileirão',
        'argentine primera división', 'copa libertadores', 'scottish premiership', 'saudi pro league', 'psl'
    ];

    const getStatusPriority = (status: string) => {
        if (!status) return 4;
        const s = status.toLowerCase();
        if (s.match(/^\d+'$/)) return 1; // Live minute
        if (s.includes('half time')) return 2; // HT
        if (s.includes('finished')) return 3; // Finished
        return 4; // Others
    };
    
    const sortedEvents = data.events
        .filter((e: SportsDBEvent) => {
            if (!e.strLeague) return false;
            const leagueNameLower = e.strLeague.toLowerCase();
            const isAllowedLeague = allowedLeagueKeywords.some(keyword => leagueNameLower.includes(keyword));
            const isLiveOrRecent = e.strStatus && !/not started|postponed|cancelled|abandoned/i.test(e.strStatus);
            return isAllowedLeague && isLiveOrRecent;
        })
        .sort((a: SportsDBEvent, b: SportsDBEvent) => {
            const statusDiff = getStatusPriority(a.strStatus) - getStatusPriority(b.strStatus);
            if (statusDiff !== 0) return statusDiff;
            const leagueCompare = (a.strLeague || '').localeCompare(b.strLeague || '');
            if (leagueCompare !== 0) return leagueCompare;
            return (a.strTime || '').localeCompare(b.strTime || '');
        })
        .slice(0, 15);
        
    const liveMatches = sortedEvents.map(mapEventToLiveMatch);

    return new Response(JSON.stringify({ matches: liveMatches }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error in fetch-scores function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})