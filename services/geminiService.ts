import { getSupabaseClient, isAppConfigured, mapPredictionToHistoryItem } from './supabaseService';
import { HistoryItem, RawPrediction } from '../types';

interface StartJobResponse {
    isCached: boolean;
    data: HistoryItem | { jobId: string };
}

/**
 * Starts a prediction job by calling the backend Edge Function.
 * It returns either a cached result or a new job ID to poll.
 *
 * @param {string} teamA - The name of the first team.
 * @param {string} teamB - The name of the second team.
 * @param {'men' | 'women'} matchCategory - The category of the match.
 * @returns {Promise<StartJobResponse>} A promise that resolves to the job start response.
 */
export async function startPredictionJob(teamA: string, teamB: string, matchCategory: 'men' | 'women'): Promise<StartJobResponse> {
    if (!isAppConfigured()) {
        throw new Error("Cannot connect to our service. The application backend is not configured.");
    }
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('request-prediction', {
        body: { teamA, teamB, matchCategory },
    });

    if (error) {
        const errorMessage = error.message.includes('Failed to fetch') 
            ? 'The prediction service is currently unavailable. Please try again later.'
            : error.message;
        throw new Error(`[Service Error] ${errorMessage}`);
    }
    
    // If the result is cached, the data is a full RawPrediction object. We need to map it.
    if (data.isCached) {
        data.data = mapPredictionToHistoryItem(data.data as RawPrediction);
    }
    
    return data;
}

/**
 * Polls the backend for the result of a specific prediction job.
 *
 * @param {string} jobId - The ID of the job to check.
 * @returns {Promise<HistoryItem>} A promise that resolves to the full prediction result.
 */
export async function getPredictionResult(jobId: string): Promise<HistoryItem> {
     if (!isAppConfigured()) {
        throw new Error("Cannot retrieve result. The application backend is not configured.");
    }
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('get-prediction', {
        body: { jobId },
    });

    if (error) {
        throw new Error(`[Service Error] Could not retrieve prediction result: ${error.message}`);
    }
    
    // The raw prediction data from the DB needs to be mapped to the UI-friendly HistoryItem type.
    return mapPredictionToHistoryItem(data as RawPrediction);
}