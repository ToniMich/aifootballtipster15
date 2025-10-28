// supabase/functions/gemini-predict/index.ts

// FIX: Corrected import paths for shared utilities.
import { supabaseAdminClient as supabase } from '../_shared/init.ts'
import { GoogleGenAI, Type } from 'npm:@google/genai@1.24.0';
import { corsHeaders } from "../_shared/cors.ts";

// Fix for "Cannot find name 'Deno'" error in Supabase Edge Functions.
declare const Deno: any;

// This schema is passed to Gemini to ensure a structured, predictable JSON response.
const predictionSchema = {
    type: Type.OBJECT,
    properties: {
        prediction: { type: Type.STRING, description: 'The final match outcome prediction (e.g., "Manchester City to Win", "Draw", "Over 2.5 Goals").' },
        confidence: { type: Type.STRING, description: 'Confidence level for the prediction. Must be one of: "High", "Medium", "Low".' },
        teamA_winProbability: { type: Type.STRING, description: 'The estimated win probability for Team A, as a percentage (e.g., "60%").' },
        teamB_winProbability: { type: Type.STRING, description: 'The estimated win probability for Team B, as a percentage (e.g., "15%").' },
        drawProbability: { type: Type.STRING, description: 'The estimated probability of a draw, as a percentage (e.g., "25%").' },
        analysis: { type: Type.STRING, description: 'A detailed, data-driven analysis of the match, explaining the reasoning behind the prediction. Should be at least 3-4 sentences long.' },
        keyStats: {
            type: Type.OBJECT,
            properties: {
                teamA_form: { type: Type.STRING, description: 'Recent form for Team A as a 5-character string (e.g., "WWDLD").' },
                teamB_form: { type: Type.STRING, description: 'Recent form for Team B as a 5-character string (e.g., "LWWWL").' },
                head_to_head: {
                    type: Type.OBJECT,
                    description: 'A structured breakdown of head-to-head match history.',
                    properties: {
                        totalMatches: { type: Type.INTEGER, description: 'Total number of recent H2H matches analyzed (e.g., last 5-10).' },
                        teamA_wins: { type: Type.INTEGER, description: 'Number of wins for Team A in those matches.' },
                        draws: { type: Type.INTEGER, description: 'Number of draws in those matches.' },
                        teamB_wins: { type: Type.INTEGER, description: 'Number of wins for Team B in those matches.' },
                        summary: { type: Type.STRING, description: 'A brief text summary of the H2H record.' }
                    },
                    required: ['totalMatches', 'teamA_wins', 'draws', 'teamB_wins', 'summary']
                }
            },
            required: ['teamA_form', 'teamB_form', 'head_to_head']
        },
        bestBets: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: { category: { type: Type.STRING, description: 'The betting market category (e.g., "Match Winner", "Total Goals").' }, value: { type: Type.STRING, description: 'The specific bet recommendation (e.g., "Manchester City", "Over 2.5").' }, reasoning: { type: Type.STRING, description: 'A short, concise reason for this specific bet.' }, confidence: { type: Type.STRING, description: 'The confidence for this bet as a percentage (e.g., "85%").' }, overValue: { type: Type.STRING, description: 'For "Total Goals" market, the "Over" value (e.g., "Over 2.5"). Optional.' }, overConfidence: { type: Type.STRING, description: 'Confidence for the "Over" bet. Optional.' }, underValue: { type: Type.STRING, description: 'For "Total Goals" market, the "Under" value (e.g., "Under 2.5"). Optional.' }, underConfidence: { type: Type.STRING, description: 'Confidence for the "Under" bet. Optional.' } },
                required: ['category', 'value', 'reasoning', 'confidence']
            }
        },
        availabilityFactors: { type: Type.STRING, description: 'A summary of key player injuries, suspensions, or returns affecting the match. If none, state "No significant availability issues for either team."' },
        venue: { type: Type.STRING, description: 'The name of the stadium and city where the match will be played (e.g., "Old Trafford, Manchester").' },
        kickoffTime: { type: Type.STRING, description: 'The local date and time of the match kickoff (e.g., "2024-08-17 15:00 BST").' },
        referee: { type: Type.STRING, description: 'The name of the appointed match referee. If unknown, state "To be announced".' },
        leagueContext: {
            type: Type.OBJECT,
            properties: { leagueName: { type: Type.STRING, description: 'The name of the league or competition.' }, teamA_position: { type: Type.STRING, description: 'Current league table position for Team A. State "N/A" if not applicable.' }, teamB_position: { type: Type.STRING, description: 'Current league table position for Team B. State "N/A" if not applicable.' }, isRivalry: { type: Type.BOOLEAN, description: 'True if this is a significant historical rivalry.' }, isDerby: { type: Type.BOOLEAN, description: 'True if this is a local derby match.' }, contextualAnalysis: { type: Type.STRING, description: 'Brief analysis of what this match means for both teams in the context of the league/competition.' } },
            required: ['leagueName', 'teamA_position', 'teamB_position', 'isRivalry', 'isDerby', 'contextualAnalysis']
        },
        playerStats: {
            type: Type.ARRAY, description: 'Statistics for 2-3 key players from each team who are likely to influence the game.',
            items: { type: Type.OBJECT, properties: { playerName: { type: Type.STRING }, teamName: { type: Type.STRING }, position: { type: Type.STRING }, goals: { type: Type.INTEGER }, assists: { type: Type.INTEGER }, yellowCards: { type: Type.INTEGER }, redCards: { type: Type.INTEGER }, }, required: ['playerName', 'teamName', 'position', 'goals', 'assists', 'yellowCards', 'redCards'] }
        },
        goalScorerPredictions: {
            type: Type.ARRAY, description: 'Predictions for likely anytime goal scorers.',
            items: { type: Type.OBJECT, properties: { playerName: { type: Type.STRING }, teamName: { type: Type.STRING }, probability: { type: Type.STRING, description: 'Must be one of: "High", "Medium", "Low".' }, reasoning: { type: Type.STRING } }, required: ['playerName', 'teamName', 'probability', 'reasoning'] }
        },
        goalProbabilities: {
            type: Type.OBJECT,
            properties: { "0-1": { type: Type.STRING, description: 'Probability of 0-1 total goals as a percentage.' }, "2-3": { type: Type.STRING, description: 'Probability of 2-3 total goals as a percentage.' }, "4+": { type: Type.STRING, description: 'Probability of 4+ total goals as a percentage.' } },
            required: ["0-1", "2-3", "4+"]
        },
        bttsPrediction: {
            type: Type.OBJECT,
            description: "Prediction for 'Both Teams to Score'. The sum of probabilities must be 100%.",
            properties: {
                yesProbability: { type: Type.STRING, description: 'Probability of YES as a percentage string (e.g., "70%").' },
                noProbability: { type: Type.STRING, description: 'Probability of NO as a percentage string (e.g., "30%").' }
            },
            required: ['yesProbability', 'noProbability']
        },
        overUnderPrediction: {
            type: Type.OBJECT,
            description: "Prediction for 'Total Goals Over/Under 2.5'. The sum of probabilities must be 100%.",
            properties: {
                over25Probability: { type: Type.STRING, description: 'Probability of Over 2.5 goals as a percentage string (e.g., "65%").' },
                under25Probability: { type: Type.STRING, description: 'Probability of Under 2.5 goals as a percentage string (e.g., "35%").' }
            },
            required: ['over25Probability', 'under25Probability']
        }
    },
    required: ['prediction', 'confidence', 'teamA_winProbability', 'teamB_winProbability', 'drawProbability', 'analysis', 'keyStats', 'bestBets', 'availabilityFactors', 'venue', 'kickoffTime', 'referee', 'leagueContext', 'playerStats', 'goalScorerPredictions', 'goalProbabilities', 'bttsPrediction', 'overUnderPrediction']
};

Deno.serve(async (req: Request) => {
    // This is a background function and does not need to handle OPTIONS preflight requests.
    const apiKey = Deno.env.get('API_KEY');
    
    let jobId: string | null = null;
    let body;
    try {
        body = await req.json();
        jobId = body.jobId;
    } catch (e) {
        console.error("Gemini-predict function called with invalid body:", e.message);
        // This function is invoked by another function, so we return an error response
        // which can be caught by the caller if it's awaiting the result.
        return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
    }

    const failJob = async (errorMessage: string) => {
        console.error(`Failing job ${jobId}: ${errorMessage}`);
        if (!jobId) {
            console.error("Cannot update job status: Job ID is missing.");
            return;
        }
        try {
            await supabase.from('predictions').update({ status: 'failed', prediction_data: { error: errorMessage } }).eq('id', jobId);
            console.log(`Successfully marked job ${jobId} as failed in the database.`);
        } catch (dbError) {
            console.error(`CRITICAL: The main process failed, AND we failed to update the job status to 'failed' for job ${jobId}. DB Error: ${dbError.message}`);
        }
    };

    if (!apiKey) {
        const errorMsg = '[Configuration Error] Server configuration is incomplete. Ensure API_KEY are set.';
        await failJob(errorMsg);
        return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500 });
    }

    try {
        const { teamA, teamB, matchCategory } = body;
        const ai = new GoogleGenAI({ apiKey: apiKey });

        const prompt = `You are a world-class football analyst. Your primary task is to provide a detailed, data-driven analysis for the upcoming ${matchCategory}'s soccer match between ${teamA} and ${teamB}.

**CRITICAL INSTRUCTIONS:**
1.  **Player Availability:** You MUST use your most recent internal knowledge to verify player availability. This includes checking for confirmed injuries, suspensions, players on loan, and starters who are doubtful to play.
2.  **Output Integrity:** Players confirmed to be unavailable for the match (e.g., Cole Palmer injured, Nicolas Jackson on loan) MUST NOT be included in the 'playerStats' or 'goalScorerPredictions' lists.
3.  **Analysis Context:** The impact of these player absences MUST be discussed in the 'analysis' and 'availabilityFactors' sections, explaining how it affects the team's strategy and the match outcome.
4.  **Data Consistency:** The sum of win/draw probabilities must equal 100%. The sum of BTTS probabilities must equal 100%. The sum of Over/Under 2.5 probabilities must equal 100%.

Your response MUST be a single, valid JSON object that strictly adheres to the requested schema. Do not include any text, markdown formatting (like \`\`\`json\`), or any other content outside of the JSON object itself.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: predictionSchema
            },
        });
        
        const predictionText = response.text;
        if (!predictionText) {
             const safetyFeedback = response.candidates?.[0]?.safetyRatings;
             if (safetyFeedback?.some(r => r.blocked)) {
                 throw new Error("[Content Filtered] The analysis was blocked due to safety filters. Please try a different match.");
             }
            throw new Error("[Invalid Response] The AI returned an empty or malformed response.");
        }

        let predictionData = JSON.parse(predictionText);
        // Grounding chunks are not available without the search tool, so sources will be empty.
        predictionData.sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => chunk.web).filter((web: any) => web && web.uri && web.title) || [];

        const { error: updateError } = await supabase
            .from('predictions')
            .update({ prediction_data: predictionData, status: 'pending' })
            .eq('id', jobId);

        if (updateError) {
            throw new Error(`[Database Error] Failed to update job ${jobId} with success: ${updateError.message}`);
        }
        
        return new Response(JSON.stringify({ success: true, jobId }), { status: 200 });

    } catch (error) {
        const errorMessage = error.message || 'An unknown error occurred during AI analysis.';
        await failJob(errorMessage);
        return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
    }
});