// supabase/functions/request-prediction/index.ts

import { corsHeaders } from '../shared/cors.ts'
import { normalizeTeamName } from '../shared/teamNameNormalizer.ts'
import { supabaseAdminClient } from '../shared/init.ts'

declare const Deno: any;

Deno.serve(async (req: Request) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { teamA: rawTeamA, teamB: rawTeamB, matchCategory }: { teamA: string, teamB: string, matchCategory: 'men' | 'women' } = await req.json();
    const teamA = normalizeTeamName(rawTeamA)
    const teamB = normalizeTeamName(rawTeamB)

    if (!teamA || !teamB) {
        throw new Error("Both teamA and teamB must be provided.");
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // More efficient query to find an existing prediction for either team order
    const { data: existingPredictions, error: fetchError } = await supabaseAdminClient
        .from('predictions')
        .select('*')
        .or(`(team_a.eq.${teamA},team_b.eq.${teamB}),(team_a.eq.${teamB},team_b.eq.${teamA})`)
        .eq('match_category', matchCategory)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(1);

    if (fetchError) {
        throw new Error(`[Database Error] Failed to search for predictions: ${fetchError.message}`);
    }

    const existingPrediction = existingPredictions && existingPredictions.length > 0 ? existingPredictions[0] : null;
    
    if (existingPrediction) {
        // Null-safe handling of the tally
        const newTally = (existingPrediction.tally || 0) + 1;

        if (existingPrediction.status === 'processing') {
            const { error: updateError } = await supabaseAdminClient.from('predictions').update({ tally: newTally }).eq('id', existingPrediction.id);
            if (updateError) {
                // Log the error but don't fail the request; returning the job ID is still useful.
                console.error(`[Database Warning] Failed to update tally for processing job ${existingPrediction.id}: ${updateError.message}`);
            }
            return new Response(JSON.stringify({ isCached: false, data: { jobId: existingPrediction.id } }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
            });
        }

        if (['pending', 'won', 'lost'].includes(existingPrediction.status)) {
            const { data: updatedPrediction, error: updateError } = await supabaseAdminClient
                .from('predictions')
                .update({ tally: newTally })
                .eq('id', existingPrediction.id)
                .select()
                .single();
            
            if (updateError) {
                throw new Error(`[Database Error] Failed to update tally for cached job: ${updateError.message}`);
            }
            if (!updatedPrediction) {
                throw new Error(`[Database Error] Failed to retrieve updated prediction after tallying.`);
            }

            // Safely add 'fromCache' flag
            const predictionData = updatedPrediction.prediction_data ? { ...updatedPrediction.prediction_data } : {};
            predictionData.fromCache = true;
            updatedPrediction.prediction_data = predictionData;

            return new Response(JSON.stringify({ isCached: true, data: updatedPrediction }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
            });
        }
    }
    
    // No recent, usable prediction found. Create a new one.
    const { data: newJob, error: insertError } = await supabaseAdminClient
        .from('predictions')
        .insert({ team_a: teamA, team_b: teamB, match_category: matchCategory, status: 'processing', prediction_data: {}, tally: 1 })
        .select()
        .single();

    if (insertError) throw new Error(`[Database Error] Failed to create prediction job: ${insertError.message}`);
    if (!newJob) throw new Error(`[Database Error] Failed to retrieve new job details after insert.`);

    // Directly invoke the AI prediction function without awaiting it (fire-and-forget).
    // Add logging for invocation failure.
    supabaseAdminClient.functions.invoke('gemini-predict', {
        body: { jobId: newJob.id, teamA, teamB, matchCategory },
    }).catch(err => console.error(`[Invocation Error] Failed to start background prediction for job ${newJob.id}:`, err));

    return new Response(JSON.stringify({ isCached: false, data: { jobId: newJob.id } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in request-prediction function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})