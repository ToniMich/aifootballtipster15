// live-scores Edge Function (TheSportsDB v2)
// Deploy: supabase functions deploy live-scores
// Required secret:
//  - THESPORTSDB_API_KEY  (your TheSportsDB API key)
// Endpoint used: https://www.thesportsdb.com/api/v2/json/{KEY}/livescore/soccer

import { corsHeaders } from 'shared/cors.ts';

// Fix for "Cannot find name 'Deno'" error in Supabase Edge Functions.
declare const Deno: any;

console.info('live-scores function starting');

Deno.serve(async (req: Request) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const KEY = Deno.env.get('THESPORTSDB_API_KEY') ?? '';
    if (!KEY) {
      return new Response(JSON.stringify({ error: 'THESPORTSDB_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = `https://www.thesportsdb.com/api/v2/json/${encodeURIComponent(KEY)}/livescore/soccer`;

    const upstream = await fetch(url, { method: 'GET' });
    if (!upstream.ok) {
      const text = await upstream.text();
      return new Response(JSON.stringify({ error: 'Upstream fetch failed', details: text }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const raw = await upstream.json();

    // The v2 endpoint typically returns an array of events at root or under 'events' — try to detect
    const events: any[] = Array.isArray(raw) ? raw : (raw.events ?? raw?.data ?? []);

    // League priority (variants)
    const priority = [
      'Premier League',
      'LaLiga',
      'La Liga',
      'Bundesliga',
      'Ligue 1',
      'Championship',
      'Champions League',
      'UEFA Champions League'
    ];

    function normalize(m: any) {
      const id = m.idEvent ?? m.id ?? String(Math.random());
      const league = (m.strLeague ?? m.league ?? m.competition ?? 'Unknown').trim();
      const home = (m.strHomeTeam ?? m.home_team ?? m.home ?? 'Home').trim();
      const away = (m.strAwayTeam ?? m.away_team ?? m.away ?? 'Away').trim();

      // Scores
      const score_home = m.intHomeScore ?? m.home_score ?? m.homeScore ?? null;
      const score_away = m.intAwayScore ?? m.away_score ?? m.awayScore ?? null;

      // Status fields can vary. v2 often uses "intMin" or "strStatus" or "status"
      const statusRaw = (m.strStatus ?? m.status ?? m.intMinute ?? m.minute ?? m.time ?? '').toString().trim();

      let display_status = statusRaw || 'NS';
      let minute: string | null = null;
      const s = statusRaw.toUpperCase();

      if (!statusRaw) {
        display_status = 'NS';
      } else if (s === 'HT' || s.includes('HALF') || s.includes('HALF TIME')) {
        display_status = 'HT';
      } else if (s === 'FT' || s.includes('FULL') || s.includes('FINAL')) {
        display_status = 'FT';
      } else {
        // Extract minute like 68 or "68'"
        const mMatch = statusRaw.match(/(\d{1,3})(\+?\d{0,2})/);
        if (mMatch) {
          minute = mMatch[0];
          display_status = `Live ${minute}'`;
        } else if (s.includes('LIVE') || s.includes('IN PLAY') || s.includes('INPLAY')) {
          display_status = 'Live';
        } else {
          display_status = statusRaw;
        }
      }

      if (minute && !minute.endsWith("'")) minute = `${minute}'`;

      return {
        id,
        league,
        display_status,
        minute,
        home,
        away,
        score_home: score_home === null || score_home === undefined ? null : Number(score_home),
        score_away: score_away === null || score_away === undefined ? null : Number(score_away)
      };
    }

    const normalized = events.map(normalize);

    function leagueIndex(l: string) {
      const idx = priority.findIndex(p => l.toLowerCase().includes(p.toLowerCase()));
      return idx === -1 ? priority.length : idx;
    }
    function statusRank(ds: string) {
      const s = (ds ?? '').toUpperCase();
      if (s.startsWith('LIVE')) return 0;
      if (s === 'HT') return 1;
      if (s === 'FT') return 2;
      return 3;
    }

    normalized.sort((a, b) => {
      const la = leagueIndex(a.league);
      const lb = leagueIndex(b.league);
      if (la !== lb) return la - lb;

      const sa = statusRank(a.display_status);
      const sb = statusRank(b.display_status);
      if (sa !== sb) return sa - sb;

      const ma = parseInt((a.minute ?? '').replace("'", ""), 10) || 0;
      const mb = parseInt((b.minute ?? '').replace("'", ""), 10) || 0;
      if (sa === 0 && sb === 0 && ma !== mb) return mb - ma;

      if (a.league !== b.league) return a.league.localeCompare(b.league);
      return (a.home + a.away).localeCompare(b.home + b.away);
    });

    const output = normalized.map(m => ({
      league: m.league,
      status: m.display_status,
      minute: m.minute,
      home: m.home,
      away: m.away,
      score_home: m.score_home,
      score_away: m.score_away
    }));

    return new Response(JSON.stringify({ data: output }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('live-scores error', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});