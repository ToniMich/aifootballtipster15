// supabase/functions/get-team-stats/index.ts

import { corsHeaders } from '../shared/cors.ts'
import { normalizeTeamName } from '../shared/teamNameNormalizer.ts'
import { supabaseAdminClient as supabase } from '../shared/init.ts'

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

    let wins = 0;
    // The query is already ordered by created_at descending
    const recentOutcomes = predictions.slice(0, 5).map(p => {
        // Determine if the prediction was a win FOR this team.
        const predictionText = p.prediction_data?.prediction?.toLowerCase() || '';
        const wasPredictedToWin = predictionText.includes(normalizedTeamName.toLowerCase()) && predictionText.includes('win');
        
        if (p.status === 'won' && wasPredictedToWin) {
            return 'won';
        }
        if (p.status === 'lost' && !wasPredictedToWin) {
            // This case is tricky. A "loss" status could be a "win" for the tracker
            // if we predicted the other team to win. For simplicity, we only count
            // explicit "won" statuses for now. A 'lost' status on the record means
            // the main prediction was wrong.
            return 'lost';
        }
        // If the status is 'won' but we didn't predict this team to win (e.g., predicted a draw or other team), it's a loss for this team's tracker.
        if (p.status === 'won' && !wasPredictedToWin) {
            return 'lost';
        }

        return 'lost';
    });


    // Calculate total wins more accurately
    for (const p of predictions) {
        const predictionText = p.prediction_data?.prediction?.toLowerCase() || '';
        const wasPredictedToWin = predictionText.includes(normalizedTeamName.toLowerCase()) && predictionText.includes('win');
        if (p.status === 'won' && wasPredictedToWin) {
            wins++;
        }
    }


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