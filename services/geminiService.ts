import { HistoryItem } from '../types';
import { getSupabaseClient } from './supabaseService';

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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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