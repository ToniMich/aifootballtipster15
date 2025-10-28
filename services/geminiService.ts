import { HistoryItem, RawPrediction } from '../types';
import { getSupabaseClient, isAppConfigured } from './supabaseService';

const createMockPrediction = (teamA: string, teamB: string, matchCategory: 'men' | 'women'): RawPrediction => ({
    id: `mock-${Date.now()}`,
    created_at: new Date().toISOString(),
    team_a: teamA,
    team_b: teamB,
    match_category: matchCategory,
    status: 'pending',
    tally: 1,
    prediction_data: {
        prediction: `${teamA} to Win`,
        confidence: 'High',
        teamA_winProbability: '70%',
        teamB_winProbability: '15%',
        drawProbability: '15%',
        analysis: `This is a mock analysis for the match between ${teamA} and ${teamB}. The AI predicts a victory for the home team based on simulated recent performance and head-to-head data. Please configure the application's backend for real predictions.`,
        keyStats: {
            teamA_form: 'WWLWD',
            teamB_form: 'LDWLL',
            head_to_head: `${teamA} has won 3 of the last 5 meetings.`
        },
        bestBets: [
            { category: 'Match Winner', value: teamA, reasoning: 'Mock data indicates stronger form.', confidence: '80%' },
            { category: 'Total Goals', value: 'Over 2.5', reasoning: 'Simulated data suggests an open, attacking game.', confidence: '65%' }
        ],
        venue: 'Mock Stadium, Placeholder City',
        kickoffTime: '15:00 Local Time',
        referee: 'John Doe',
        teamA_logo: undefined,
        teamB_logo: undefined,
        fromCache: true,
        leagueContext: { leagueName: 'Mock Premier League', teamA_position: '1st', teamB_position: '14th', isRivalry: false, isDerby: false, contextualAnalysis: 'A crucial match for the title race.' },
        playerStats: [],
        goalScorerPredictions: [],
        goalProbabilities: { "0-1": '20%', "2-3": '55%', "4+": '25%' },
    }
});


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
        // --- Placeholder Mode Logic ---
        console.warn("Using mock prediction data: App is in placeholder mode.");
        return new Promise(resolve => {
            setTimeout(() => {
                const mockData = createMockPrediction(teamA, teamB, matchCategory);
                resolve({ isCached: true, data: mockData });
            }, 1500); // Simulate network delay
        });
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
 * Polls the backend to get the result of a prediction job.
 * @param {string} jobId The ID of the prediction job to check.
 * @returns {Promise<HistoryItem>} A promise that resolves to the full prediction data once the job is complete.
 */
export async function getPredictionResult(jobId: string): Promise<any> {
    if (!isAppConfigured()) {
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