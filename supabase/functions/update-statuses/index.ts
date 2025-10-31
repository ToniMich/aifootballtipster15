// supabase/functions/update-statuses/index.ts

import { corsHeaders } from '../shared/cors.ts'
import { normalizeTeamName } from '../shared/teamNameNormalizer.ts'
import { supabaseAdminClient as supabase } from '../shared/init.ts'
import { BestBet } from '../../../types.ts';

// Fix for "Cannot find name 'Deno'" error in Supabase Edge Functions.
declare const Deno: any;

interface Prediction {
    id: string;
    team_a: string;
    team_b: string;
    prediction_data: {
        prediction?: string;
        bestBets?: BestBet[];
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

const evaluateBets = (prediction: Prediction, match: Match): { mainOutcome: 'won' | 'lost', updatedBestBets: BestBet[] } => {
    const { team_a: teamA_input, team_b: teamB_input, prediction_data } = prediction;
    const { strHomeTeam, intHomeScore, intAwayScore } = match;

    const homeScore = parseInt(intHomeScore!, 10);
    const awayScore = parseInt(intAwayScore!, 10);
    const totalGoals = homeScore + awayScore;
    
    const dbTeamAIsHome = normalizeTeamName(strHomeTeam) === teamA_input;
    const teamA_score = dbTeamAIsHome ? homeScore : awayScore;
    const teamB_score = dbTeamAIsHome ? awayScore : homeScore;
    
    const normalizedTeamA = teamA_input.toLowerCase();
    const normalizedTeamB = teamB_input.toLowerCase();

    // 1. Evaluate Main Prediction
    let mainPredictionWin = false;
    const mainPredictionText = (prediction_data.prediction || '').toLowerCase();
    
    if (mainPredictionText.includes(normalizedTeamA) && mainPredictionText.includes('win')) {
        if (teamA_score > teamB_score) mainPredictionWin = true;
    } else if (mainPredictionText.includes(normalizedTeamB) && mainPredictionText.includes('win')) {
        if (teamB_score > teamA_score) mainPredictionWin = true;
    } else if (mainPredictionText.includes('draw')) {
        if (teamA_score === teamB_score) mainPredictionWin = true;
    }

    // 2. Evaluate Each "Best Bet"
    const updatedBestBets = (prediction_data.bestBets || []).map(bet => {
        let isBetCorrect = false;
        const betValue = bet.value.toLowerCase();
        
        switch (bet.category) {
            case "Match Winner":
                if (betValue.includes(normalizedTeamA) && teamA_score > teamB_score) isBetCorrect = true;
                else if (betValue.includes(normalizedTeamB) && teamB_score > teamA_score) isBetCorrect = true;
                else if (betValue.includes('draw') && teamA_score === teamB_score) isBetCorrect = true;
                break;
            case "Total Goals":
            case "Over/Under":
                const overUnderMatch = betValue.match(/(over|under)\s*(\d+\.?\d*)/);
                if (overUnderMatch) {
                    const type = overUnderMatch[1];
                    const value = parseFloat(overUnderMatch[2]);
                    if (type === 'over' && totalGoals > value) isBetCorrect = true;
                    else if (type === 'under' && totalGoals < value) isBetCorrect = true;
                }
                break;
            case "Both Teams to Score":
                if (betValue === 'yes' && homeScore > 0 && awayScore > 0) isBetCorrect = true;
                else if (betValue === 'no' && (homeScore === 0 || awayScore === 0)) isBetCorrect = true;
                break;
        }
        return { ...bet, betStatus: isBetCorrect ? 'won' : 'lost' } as BestBet;
    });

    return {
        mainOutcome: mainPredictionWin ? 'won' : 'lost',
        updatedBestBets: updatedBestBets,
    };
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('THESPORTSDB_API_KEY');
    if (!apiKey) throw new Error('[Configuration Error] Server configuration is incomplete.');

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
        const match = allEvents.find(e => 
            e.strHomeTeam && e.strAwayTeam &&
            ((normalizeTeamName(e.strHomeTeam) === prediction.team_a && normalizeTeamName(e.strAwayTeam) === prediction.team_b) ||
             (normalizeTeamName(e.strHomeTeam) === prediction.team_b && normalizeTeamName(e.strAwayTeam) === prediction.team_a))
        );

        if (match && (match.strStatus === 'Match Finished' || match.strStatus === 'FT') && match.intHomeScore !== null && match.intAwayScore !== null) {
            const { mainOutcome, updatedBestBets } = evaluateBets(prediction, match);
            
            const dbTeamAIsHome = normalizeTeamName(match.strHomeTeam) === prediction.team_a;
            const teamA_logo = cleanLogoUrl(dbTeamAIsHome ? match.strHomeBadge : match.strAwayBadge);
            const teamB_logo = cleanLogoUrl(dbTeamAIsHome ? match.strAwayBadge : match.strHomeBadge);

            const updatedPredictionData = { 
                ...(prediction.prediction_data || {}), 
                bestBets: updatedBestBets,
                teamA_logo, 
                teamB_logo 
            };
            
            updatePromises.push(
                supabase.from('predictions').update({
                    status: mainOutcome,
                    prediction_data: updatedPredictionData
                }).eq('id', prediction.id)
            );
            updatedCount++;
        }
    }

    if (updatePromises.length > 0) {
        const results = await Promise.allSettled(updatePromises);
        results.forEach(result => {
            if (result.status === 'rejected') {
                console.error('Failed to update a prediction:', result.reason);
            }
        });
    }

    return new Response(JSON.stringify({ message: `Sync complete. Checked ${pendingPredictions.length} predictions and updated ${updatedCount}.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    });

  } catch (error) {
    console.error('Error in update-statuses function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    });
  }
})
