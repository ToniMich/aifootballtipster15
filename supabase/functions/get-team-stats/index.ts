// supabase/functions/get-team-stats/index.ts

import { corsHeaders } from '../shared/cors.ts'
import { normalizeTeamName } from '../shared/teamNameNormalizer.ts'
import { supabaseAdminClient as supabase } from '../shared/init.ts'
import { HistoryItem } from '../../../types.ts';

declare const Deno: any;

Deno.serve(async (req: Request) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Fix: Add type definition for the JSON body to resolve property access errors.
    const { teamName }: { teamName: string } = await req.json();
    if (!teamName) {
      throw new Error('Missing required teamName parameter.')
    }

    const normalizedTeamName = normalizeTeamName(teamName);

    // Fetch all completed predictions where the team was either team_a or team_b
    const { data: predictions, error } = await supabase
        .from('predictions')
        .select('team_a, team_b, status, prediction_data, created_at')
        .or(`team_a.eq.${normalizedTeamName},team_b.eq.${normalizedTeamName}`)
        .in('status', ['won', 'lost'])
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(`[Database Error] ${error.message}`);
    }

    if (!predictions || predictions.length === 0) {
        return new Response(JSON.stringify({ total: 0, wins: 0, recentOutcomes: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // A 'won' status means the AI's prediction was correct for that match.
    const wins = predictions.filter(p => p.status === 'won').length;

    // The recent outcomes should simply reflect if the AI was right ('won') or wrong ('lost')
    // for the last 5 predictions involving this team.
    const recentOutcomes = predictions.slice(0, 5).map(p => p.status as HistoryItem['status']);

    const stats = {
        total: predictions.length,
        wins: wins,
        recentOutcomes,
    };

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in get-team-stats function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
