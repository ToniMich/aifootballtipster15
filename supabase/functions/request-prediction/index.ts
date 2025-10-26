// supabase/functions/request-prediction/index.ts

import { corsHeaders } from '../_shared/cors.ts'
import { normalizeTeamName } from '../_shared/teamNameNormalizer.ts'
import { supabaseAdminClient } from '../_shared/init.ts'

declare const Deno: any;

Deno.serve(async (req: Request) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { teamA: rawTeamA, teamB: rawTeamB, matchCategory } = await req.json()
    const teamA = normalizeTeamName(rawTeamA)
    const teamB = normalizeTeamName(rawTeamB)

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const fetchRecentPrediction = async (home: string, away: string) => {
        const { data, error } = await supabaseAdminClient
            .from('predictions')
            .select('*')
            .eq('team_a', home)
            .eq('team_b', away)
            .eq('match_category', matchCategory)
            .gte('created_at', twentyFourHoursAgo)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw new Error(`[Database Error] Failed to search for predictions: ${error.message}`);
        return data;
    };

    const existingPrediction = await fetchRecentPrediction(teamA, teamB) || await fetchRecentPrediction(teamB, teamA);
    
    if (existingPrediction) {
        if (existingPrediction.status === 'processing') {
            await supabaseAdminClient.from('predictions').update({ tally: existingPrediction.tally + 1 }).eq('id', existingPrediction.id);
            return new Response(JSON.stringify({ isCached: false, data: { jobId: existingPrediction.id } }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
            });
        }

        if (['pending', 'won', 'lost'].includes(existingPrediction.status)) {
            const { data: updatedPrediction } = await supabaseAdminClient.from('predictions').update({ tally: existingPrediction.tally + 1 }).eq('id', existingPrediction.id).select().single();
            if (typeof updatedPrediction.prediction_data !== 'object' || updatedPrediction.prediction_data === null) {
                updatedPrediction.prediction_data = {};
            }
            updatedPrediction.prediction_data.fromCache = true;
            return new Response(JSON.stringify({ isCached: true, data: updatedPrediction }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
            });
        }
    }
    
    const { data: newJob, error: insertError } = await supabaseAdminClient
        .from('predictions')
        .insert({ team_a: teamA, team_b: teamB, match_category: matchCategory, status: 'processing', prediction_data: {}, tally: 1 })
        .select()
        .single();

    if (insertError) throw new Error(`[Database Error] Failed to create prediction job: ${insertError.message}`);

    // Directly invoke the AI prediction function without awaiting it (fire-and-forget).
    // This allows the current function to return a job ID to the user immediately.
    supabaseAdminClient.functions.invoke('gemini-predict', {
        body: { jobId: newJob.id, teamA, teamB, matchCategory },
    }).catch(err => console.error("Error invoking background prediction function:", err));

    return new Response(JSON.stringify({ isCached: false, data: { jobId: newJob.id } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in request-prediction function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})