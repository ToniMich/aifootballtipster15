// live-scores (updated)
// Assumptions:
// - Deno runtime (Edge Function)
// - THESPORTSDB_API_KEY set in environment
// - Query params:
//    ?league=<name>         -> case-insensitive partial match (optional)
//    ?ttl=<seconds>         -> cache TTL in seconds (optional, default 20)
// Example: /.netlify/functions/live-scores?league=Mongolian&ttl=10

console.info('live-scores function starting');

// Fix for "Cannot find name 'Deno'" error in Supabase Edge Functions.
declare const Deno: any;

const DEFAULT_TTL_SECONDS = 20;
const DEFAULT_TIMEOUT_MS = 5000; // upstream fetch timeout

function jsonResponse(obj: unknown, status = 200, extraHeaders: Record<string,string> = {}) {
  const headers: Record<string,string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };
  Object.assign(headers, extraHeaders);
  return new Response(JSON.stringify(obj), { status, headers });
}

function normalizeMatch(m: any) {
  return {
    idLiveScore: m.idLiveScore ?? m.idEvent ?? null,
    idEvent: m.idEvent ?? null,
    league: m.strLeague ?? null,
    event: m.strEvent ?? null,
    home: m.strHomeTeam ?? null,
    away: m.strAwayTeam ?? null,
    homeScore: m.intHomeScore !== undefined ? (m.intHomeScore === null ? null : Number(m.intHomeScore)) : null,
    awayScore: m.intAwayScore !== undefined ? (m.intAwayScore === null ? null : Number(m.intAwayScore)) : null,
    status: m.strStatus ?? null,
    date: m.dateEvent ?? null,
    time: m.strTime ?? null,
    raw: m
  };
}

Deno.serve(async (req: Request) => {
  try {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization'
        }
      });
    }

    const url = new URL(req.url);
    const leagueQ = url.searchParams.get('league')?.trim() || null;
    const ttlParam = url.searchParams.get('ttl');
    const ttlSeconds = ttlParam ? Math.max(0, Number(ttlParam) || DEFAULT_TTL_SECONDS) : DEFAULT_TTL_SECONDS;

    const apiKey = Deno.env.get('THESPORTSDB_API_KEY');
    if (!apiKey) {
      return jsonResponse({ error: 'Missing THESPORTSDB_API_KEY' }, 500);
    }

    // Simple in-memory cache on globalThis to survive warm containers
    const now = Date.now();
    const globalAny: any = globalThis;
    globalAny.__live_scores_cache = globalAny.__live_scores_cache || { ts: 0, ttl: 0, data: null };
    const cache = globalAny.__live_scores_cache;

    // Use cache if TTL matches and still fresh
    if (cache.data && (now - cache.ts) < (ttlSeconds * 1000) && cache.ttl === ttlSeconds) {
      // Serve cached results but still allow server-side filtering by league param
      const raw = cache.data;
      const matches = Array.isArray(raw.livescore) ? raw.livescore : (raw.events || raw.scores || []);
      const filtered = filterAndNormalize(matches, leagueQ);
      return jsonResponse({
        cached: true,
        league: leagueQ,
        ttlSeconds,
        timestamp: new Date(cache.ts).toISOString(),
        count: filtered.length,
        matches: filtered
      }, 200);
    }

    // Build upstream URL (use the livescore endpoint)
    const upstreamUrl = 'https://www.thesportsdb.com/api/v2/json/livescore/soccer';

    // Fetch with timeout
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(upstreamUrl, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey
        },
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(to);
      console.error('Upstream fetch failed', err);
      return jsonResponse({ error: 'Upstream fetch failed', message: String(err) }, 502);
    }
    clearTimeout(to);

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => '');
      console.error('Upstream not OK', upstreamRes.status, text);
      return jsonResponse({ error: 'Upstream error', status: upstreamRes.status }, 502);
    }

    const upstreamJson = await upstreamRes.json().catch((e) => {
      console.error('Failed parsing upstream JSON', e);
      return null;
    });

    if (!upstreamJson) {
      return jsonResponse({ error: 'Invalid upstream JSON' }, 502);
    }

    // Cache the raw upstream response
    cache.ts = now;
    cache.ttl = ttlSeconds;
    cache.data = upstreamJson;

    const matchesRaw = Array.isArray(upstreamJson.livescore) ? upstreamJson.livescore : (upstreamJson.events || upstreamJson.scores || []);
    const filtered = filterAndNormalize(matchesRaw, leagueQ);

    return jsonResponse({
      cached: false,
      league: leagueQ,
      ttlSeconds,
      timestamp: new Date(now).toISOString(),
      count: filtered.length,
      matches: filtered
    }, 200);
  } catch (err) {
    console.error('Function error', err);
    return jsonResponse({ error: 'Internal error', message: String(err) }, 500);
  }
});

function filterAndNormalize(matches: any, leagueQuery: string | null) {
  if (!Array.isArray(matches)) return [];
  if (!leagueQuery) {
    return matches.map(normalizeMatch);
  }
  const q = leagueQuery.toLowerCase();
  return matches
    .filter(m => {
      const league = (m.strLeague || m.league || '').toString().toLowerCase();
      const event = (m.strEvent || '').toString().toLowerCase();
      return league.includes(q) || event.includes(q);
    })
    .map(normalizeMatch);
}