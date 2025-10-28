import { GoogleGenAI, Type } from '@google/genai';
import { HistoryItem, RawPrediction, PredictionResultData } from '../types';
import { getSupabaseClient, isAppConfigured } from './supabaseService';

// Schema for Gemini, ensuring a structured JSON response.
// This is replicated from the backend function for the fallback mechanism.
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
            properties: { teamA_form: { type: Type.STRING, description: 'Recent form for Team A as a 5-character string (e.g., "WWDLD").' }, teamB_form: { type: Type.STRING, description: 'Recent form for Team B as a 5-character string (e.g., "LWWWL").' }, head_to_head: { type: Type.STRING, description: 'A summary of the last few head-to-head results between the two teams.' } },
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
        }
    },
    required: ['prediction', 'confidence', 'teamA_winProbability', 'teamB_winProbability', 'drawProbability', 'analysis', 'keyStats', 'bestBets', 'availabilityFactors', 'venue', 'kickoffTime', 'referee', 'leagueContext', 'playerStats', 'goalScorerPredictions', 'goalProbabilities']
};


/**
 * Starts the prediction process by calling the secure Supabase Edge Function.
 * This function initiates a background job for AI analysis if a cached result isn't available.
 *
 * @param {string} teamA - The name of the first team.
 * @param {'men' | 'women'} matchCategory - The category of the match.
 * @param {string} teamB - The name of the second team.
 * @returns {Promise<{ isCached: boolean; data: any }>} A promise that resolves to either the cached prediction data or a job ID for polling.
 */
export async function startPredictionJob(teamA: string, teamB: string, matchCategory: 'men' | 'women'): Promise<{ isCached: boolean; data: any }> {
    if (!isAppConfigured()) {
        // If the backend isn't configured, we throw an error. This signals the App
        // component to attempt the direct-to-Gemini fallback.
        throw new Error("Application backend is not configured.");
    }

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('request-prediction', {
        body: { teamA, teamB, matchCategory },
    });

    if (error) {
        throw new Error(`[Network Error] Failed to invoke 'request-prediction' function: ${error.message}`);
    }
    return data;
}

/**
 * A fallback function to get a prediction directly from the Gemini API.
 * This is used only when the primary backend (Supabase function) fails.
 *
 * @param {string} teamA - The name of the first team.
 * @param {string} teamB - The name of the second team.
 * @param {'men' | 'women'} matchCategory - The category of the match.
 * @returns {Promise<HistoryItem>} A promise that resolves to a complete prediction result.
 */
export async function getPredictionDirectlyFromGemini(teamA: string, teamB: string, matchCategory: 'men' | 'women'): Promise<HistoryItem> {
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
        throw new Error("Cannot connect to AI service. API Key is not configured for direct fallback access on the frontend.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are a world-class football analyst. Use Google Search to find the most current and relevant information possible and analyze the upcoming ${matchCategory}'s soccer match between ${teamA} and ${teamB}. Your analysis must cover team news, form, historical data, injuries, suspensions, league context (table position, rivalries), and key player statistics. Your response must be a single, valid JSON object that strictly adheres to the provided schema. Populate all fields with accurate, well-researched data from your search results. The sum of teamA_winProbability, teamB_winProbability, and drawProbability must equal 100%. Do not include any text, markdown, or any other content outside of the JSON object itself.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
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

    let predictionData: PredictionResultData = JSON.parse(predictionText);
    predictionData.sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => chunk.web).filter((web: any) => web && web.uri && web.title) || [];
    predictionData.fromCache = false;

    // Manually construct a HistoryItem, as this result is not coming from the database.
    const historyItem: HistoryItem = {
        ...predictionData,
        id: `gemini-direct-${Date.now()}`,
        teamA: teamA,
        teamB: teamB,
        matchCategory: matchCategory,
        timestamp: new Date().toISOString(),
        status: 'pending',
        tally: 1,
    };

    return historyItem;
}


/**
 * Polls the backend to get the result of a prediction job.
 * @param {string} jobId The ID of the prediction job to check.
 * @returns {Promise<HistoryItem>} A promise that resolves to the full prediction data once the job is complete.
 */
export async function getPredictionResult(jobId: string): Promise<any> {
    if (!isAppConfigured()) {
        // This path should ideally not be hit if the fallback works, but serves as a safeguard.
        throw new Error("Prediction feature is disabled. The application has not been configured with a backend service.");
    }
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('get-prediction', {
        body: { jobId },
    });

    if (error) {
        throw new Error(`[Network Error] Failed to invoke 'get-prediction' function: ${error.message}`);
    }
    return data;
}


/**
 * The Gemini client is no longer initialized on the frontend.
 * This function is kept for compatibility but will always return undefined.
 * All Gemini calls are now handled by the secure backend function.
 * @returns {undefined}
 */
export function getInitializationError(): Error | undefined {
    return undefined;
}