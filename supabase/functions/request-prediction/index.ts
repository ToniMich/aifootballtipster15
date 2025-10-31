// supabase/functions/request-prediction/index.ts

import { corsHeaders } from '../shared/cors.ts'
import { normalizeTeamName } from '../shared/teamNameNormalizer.ts'
import { supabaseAdminClient } from '../shared/init.ts'

declare const Deno: any;

const FREE_TIER_LIMIT = 12;

Deno.serve(async (req: Request) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        throw new Error("Missing Authorization header.");
    }
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdminClient.auth.getUser(jwt);
    if (userError || !user) {
        throw new Error(`Authentication failed: ${userError?.message || 'User not found.'}`);
    }

    const { teamA: rawTeamA, teamB: rawTeamB, matchCategory, forceRefresh = false }: { teamA: string, teamB: string, matchCategory: 'men' | 'women', forceRefresh?: boolean } = await req.json();
    const teamA = normalizeTeamName(rawTeamA)
    const teamB = normalizeTeamName(rawTeamB)
    if (!teamA || !teamB) {
        throw new Error("Both teamA and teamB must be provided.");
    }
    
    // 2. Check user's subscription status and usage
    const { data: profile, error: profileError } = await supabaseAdminClient
        .from('profiles')
        .select('subscription_status, monthly_prediction_count, last_prediction_date')
        .eq('id', user.id)
        .single();
    
    if (profileError) {
        throw new Error(`Could not retrieve user profile: ${profileError.message}`);
    }

    // For now, any subscription status other than 'free' is considered pro
    const isProUser = profile.subscription_status !== 'free';

    if (!isProUser) {
        const now = new Date();
        const lastPredictionDate = profile.last_prediction_date ? new Date(profile.last_prediction_date) : null;
        let currentCount = profile.monthly_prediction_count || 0;

        // Reset monthly count if the last prediction was in a different month
        if (lastPredictionDate && (lastPredictionDate.getMonth() !== now.getMonth() || lastPredictionDate.getFullYear() !== now.getFullYear())) {
            currentCount = 0;
        }

        if (currentCount >= FREE_TIER_LIMIT) {
            return new Response(JSON.stringify({ error: "Usage limit reached. Please upgrade to Pro for unlimited predictions." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429,
            });
        }
    }

    // 3. Cache Check (only if not forcing a refresh)
    if (!forceRefresh) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: existingPredictions, error: fetchError } = await supabaseAdminClient
            .from('predictions')
            .select('*')
            .or(`(team_a.eq.${teamA},team_b.eq.${teamB}),(team_a.eq.${teamB},team_b.eq.${teamA})`)
            .eq('match_category', matchCategory)
            .gte('created_at', twentyFourHoursAgo)
            .order('created_at', { ascending: false })
            .limit(1);

        if (fetchError) throw new Error(`[Database Error] Failed to search for predictions: ${fetchError.message}`);

        const existingPrediction = existingPredictions?.[0];
        if (existingPrediction) {
             const predictionData = { ...existingPrediction.prediction_data, fromCache: true };
             existingPrediction.prediction_data = predictionData;

             return new Response(JSON.stringify({ isCached: true, data: existingPrediction }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
            });
        }
    }
    
    // 4. Create New Prediction Job
    const { data: newJob, error: insertError } = await supabaseAdminClient
        .from('predictions')
        .insert({ team_a: teamA, team_b: teamB, match_category: matchCategory, status: 'processing', prediction_data: {}, tally: 1, user_id: user.id })
        .select()
        .single();

    if (insertError) throw new Error(`[Database Error] Failed to create prediction job: ${insertError.message}`);
    if (!newJob) throw new Error(`[Database Error] Failed to retrieve new job details after insert.`);

    // 5. Update user's prediction count for free users
    if (!isProUser) {
        const { error: updateProfileError } = await supabaseAdminClient
            .from('profiles')
            .update({
                monthly_prediction_count: (profile.monthly_prediction_count || 0) + 1,
                last_prediction_date: new Date().toISOString()
            })
            .eq('id', user.id);
        if (updateProfileError) {
             console.error(`[Database Warning] Failed to update prediction count for user ${user.id}: ${updateProfileError.message}`);
        }
    }

    // 6. Asynchronously trigger the Gemini function
    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/gemini-predict`;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    fetch(functionUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({ jobId: newJob.id, teamA, teamB, matchCategory }),
    }).catch(err => {
        console.error(`[Invocation Error] Fire-and-forget fetch to gemini-predict failed for job ${newJob.id}:`, err.message);
    });

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
