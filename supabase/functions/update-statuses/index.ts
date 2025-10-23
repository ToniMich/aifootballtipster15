// supabase/functions/update-statuses/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/cors.ts'
import { normalizeTeamName } from '../shared/teamNameNormalizer.ts'

// Fix for "Cannot find name 'Deno'" error in Supabase Edge Functions.
declare const Deno: any;

interface Prediction {
    id: string;
    team_a: string;
    team_b: string;
    prediction_data: {
        prediction?: string;
        [key: string]: any;
    };
    [key: string]: any;
}

interface Match {
    strHomeTeam: string;
    strAwayTeam: string;
    intHomeScore: string | null;
    intAwayScore: string | null;
    strHomeBadge?: string;
    strAwayBadge?: string;
    strStatus?: string;
}

const cleanLogoUrl = (url: string | null | undefined): string | null => {
    if (typeof url === 'string' && url.endsWith('/preview')) {
        return url.slice(0, -8); // Removes '/preview'
    }
    return url || null;
};

const determineOutcome = (prediction: Prediction, match: Match): 'won' | 'lost' | 'pending' => {
    const { team_a: teamA_input, team_b: teamB_input, prediction_data } = prediction;
    const { strHomeTeam, strAwayTeam, intHomeScore, intAwayScore } = match;

    if (intHomeScore === null || intAwayScore === null) return 'pending';
    const homeScore = parseInt(intHomeScore, 10);
    const awayScore = parseInt(intAwayScore, 10);
    if (!prediction_data || !prediction_data.prediction) return 'pending';
    
    const predictionText = prediction_data.prediction.toLowerCase();
    const dbTeamAIsHome = normalizeTeamName(strHomeTeam) === teamA_input;
    const teamA_score = dbTeamAIsHome ? homeScore : awayScore;
    const teamB_score = dbTeamAIsHome ? awayScore : homeScore;
    let isWin = false;
    const normalizedTeamA = teamA_input.toLowerCase();
    const normalizedTeamB = teamB_input.toLowerCase();

    if (predictionText.includes(normalizedTeamA) && predictionText.includes('win')) {
        if (teamA_score > teamB_score) isWin = true;
    } else if (predictionText.includes(normalizedTeamB) && predictionText.includes('win')) {
        if (teamB_score > teamA_score) isWin = true;
    } else if (predictionText.includes('draw')) {
        if (teamA_score === teamB_score) isWin = true;
    } else {
        const overUnderMatch = predictionText.match(/(over|under)\s*(\d+\.?\d*)/);
        if (overUnderMatch) {
            const type = overUnderMatch[1];
            const value = parseFloat(overUnderMatch[2]);
            const totalGoals = homeScore + awayScore;
            if (type === 'over' && totalGoals > value) isWin = true;
            else if (type === 'under' && totalGoals < value) isWin = true;
        }
    }
    return isWin ? 'won' : 'lost';
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const apiKey = Deno.env.get('THESPORTSDB_API_KEY');

    if (!apiKey || !supabaseUrl || !serviceRoleKey) {
        throw new Error('[Configuration Error] Server configuration is incomplete.');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: pendingPredictions, error: fetchError } = await supabase
        .from('predictions').select('*').eq('status', 'pending').gte('created_at', sevenDaysAgo);

    if (fetchError) throw new Error(`[Database Error] Failed to fetch predictions: ${fetchError.message}`);
    if (!pendingPredictions || pendingPredictions.length === 0) {
        return new Response(JSON.stringify({ message: 'No recent pending predictions found to update.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
        });
    }

    let updatedCount = 0;
    const teamsToQuery = new Set(pendingPredictions.flatMap(p => [p.team_a, p.team_b]));
    const allEvents: Match[] = [];

    for (const team of teamsToQuery) {
        const teamASearch = encodeURIComponent(team as string);
        const apiUrl = `https://www.thesportsdb.com/api/v1/json/${apiKey}/searchevents.php?e=${teamASearch}`;
        try {
            const response = await fetch(apiUrl);
            if (response.ok) {
                const data = await response.json() as { event?: Match[] };
                if (data && Array.isArray(data.event)) {
                    allEvents.push(...data.event);
                }
            }
        } catch (apiError) {
            console.warn(`Could not fetch events for ${team}:`, apiError.message);
        }
    }

    const updatePromises = [];
    for (const prediction of pendingPredictions) {
        const match = allEvents.find(e => {
            const homeTeam = normalizeTeamName(e.strHomeTeam);
            const awayTeam = normalizeTeamName(e.strAwayTeam);
            return (homeTeam === prediction.team_a && awayTeam === prediction.team_b) ||
                   (homeTeam === prediction.team_b && awayTeam === prediction.team_a);
        });

        if (match && (match.strStatus === 'Match Finished' || match.strStatus === 'FT')) {
            const newStatus = determineOutcome(prediction, match);
            if (newStatus !== 'pending') {
                const dbTeamAIsHome = normalizeTeamName(match.strHomeTeam) === prediction.team_a;
                const teamA_logo = cleanLogoUrl(dbTeamAIsHome ? match.strHomeBadge : match.strAwayBadge);
                const teamB_logo = cleanLogoUrl(dbTeamAIsHome ? match.strAwayBadge : match.strHomeBadge);
                const updatedPredictionData = { ...(prediction.prediction_data || {}), teamA_logo, teamB_logo };
                updatePromises.push(
                    supabase.from('predictions').update({
                        status: newStatus,
                        prediction_data: updatedPredictionData
                    }).eq('id', prediction.id)
                );
                updatedCount++;
            }
        }
    }

    if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
    }

    return new Response(JSON.stringify({ message: `Sync complete. Checked ${pendingPredictions.length} predictions and updated ${updatedCount}.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    });

  } catch (error) {
    console.error('Error in update-statuses function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    });
  }
})
