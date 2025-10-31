// supabase/functions/gemini-predict/index.ts

import { supabaseAdminClient as supabase } from '../shared/init.ts'
import { GoogleGenAI, Type } from '@google/genai';

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
    const geminiApiKey = Deno.env.get('API_KEY');
    
    let jobId: string | null = null;
    let body;
    try {
        body = await req.json();
        jobId = body.jobId;
    } catch (e) {
        console.error("Gemini-predict function called with invalid body:", e.message);
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

    if (!geminiApiKey) {
        const errorMsg = '[Configuration Error] Server configuration is incomplete. Ensure API_KEY is set.';
        await failJob(errorMsg);
        return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500 });
    }

    try {
        const { teamA, teamB, matchCategory } = body;
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });

        // --- STEP 1: Research Call ---
        const researchPrompt = `You are a world-class football analyst. Your task is to gather comprehensive, up-to-date information for the upcoming ${matchCategory}'s soccer match between ${teamA} and ${teamB}.

**CRITICAL INSTRUCTIONS:**
1.  **Use Google Search:** You MUST use Google Search to find the absolute latest information.
2.  **Current Context:** The current year is ${new Date().getFullYear()}. All information must be for the present or near future.
3.  **Gather Comprehensive Data:** Collect the following details:
    *   Team form (last 5-6 matches).
    *   Head-to-head history (last 5-10 matches).
    *   Key player statistics (goals, assists, cards for 2-3 important players per team).
    *   Player availability (injuries, suspensions). Exclude unavailable players from stats.
    *   Match context (league name, table positions, importance of the match, rivalries).
    *   Match details (venue, kickoff time, referee if available).
4.  **Synthesize Findings:** Based on your research, provide a detailed analysis of the match dynamics, tactical outlook, and likely outcome. Propose a final prediction, win/draw/loss probabilities, and several "best bet" ideas with confidence levels. Also predict likely goalscorers, goal totals (0-1, 2-3, 4+), BTTS, and Over/Under 2.5 probabilities.

Return your findings as a detailed text block. Do not use JSON format for this step.`;

        const researchResult = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: researchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const analysisText = researchResult.text;
        if (!analysisText) {
            throw new Error("AI failed to gather information in the research step. The response was empty.");
        }
        const sources = researchResult.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

        // --- STEP 2: Formatting Call ---
        const formattingPrompt = `Based *only* on the following football match analysis, your task is to populate the provided JSON schema. Do not add any new information or search for more data. Adhere strictly to the data provided in the text.

**Analysis Text:**
---
${analysisText}
---

**Task:** Fill out the JSON object according to the schema.`;
        
        const formatResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: formattingPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: predictionSchema,
            },
        });

        const predictionText = formatResponse.text;
        if (!predictionText) {
             const safetyFeedback = formatResponse.candidates?.[0]?.safetyRatings;
             if (safetyFeedback?.some(r => r.blocked)) {
                 throw new Error("[Content Filtered] The analysis was blocked due to safety filters during the formatting step.");
             }
            throw new Error("[Invalid Response] The AI failed to format the analysis into JSON.");
        }

        let predictionData = JSON.parse(predictionText);
        predictionData.sources = sources; // Add the sources from the first call

        // --- STEP 3: Update Database ---
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