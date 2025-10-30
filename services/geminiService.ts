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
    console.log(`[DEBUG] geminiService.startPredictionJob: Initiating job for ${teamA} vs ${teamB} (${matchCategory})`);
    if (!isAppConfigured()) {
        throw new Error("Cannot connect to our service. The application backend is not configured.");
    }
    const supabase = await getSupabaseClient();
    
    console.log('[DEBUG] geminiService.startPredictionJob: Invoking "request-prediction" Edge Function...');
    const { data, error } = await supabase.functions.invoke('request-prediction', {
        body: { teamA, teamB, matchCategory },
    });

    if (error) {
        console.error('[DEBUG] geminiService.startPredictionJob: Received ERROR from "request-prediction" function.', error);
        const errorMessage = error.message.includes('Failed to fetch') 
            ? 'The prediction service is currently unavailable. Please try again later.'
            : error.message;
        throw new Error(`[Service Error] ${errorMessage}`);
    }
    
    console.log('[DEBUG] geminiService.startPredictionJob: Received SUCCESS response from "request-prediction" function.', data);
    
    // If the result is cached, the data is a full RawPrediction object. We need to map it.
    if (data.isCached) {
        console.log('[DEBUG] geminiService.startPredictionJob: Response is a cached result. Mapping data.');
        data.data = mapPredictionToHistoryItem(data.data as RawPrediction);
    } else {
        console.log('[DEBUG] geminiService.startPredictionJob: Response is a new job. Job ID:', data.data.jobId);
    }
    
    console.log('[DEBUG] geminiService.startPredictionJob: Returning final response.', data);
    return data;
}

/**
 * Polls the backend for the result of a specific prediction job.
 *
 * @param {string} jobId - The ID of the job to check.
 * @returns {Promise<HistoryItem>} A promise that resolves to the full prediction result.
 */
export async function getPredictionResult(jobId: string): Promise<HistoryItem> {
     console.log(`[DEBUG] geminiService.getPredictionResult: Polling for job ID: ${jobId}`);
     if (!isAppConfigured()) {
        throw new Error("Cannot retrieve result. The application backend is not configured.");
    }
    const supabase = await getSupabaseClient();

    console.log('[DEBUG] geminiService.getPredictionResult: Invoking "get-prediction" Edge Function...');
    const { data, error } = await supabase.functions.invoke('get-prediction', {
        body: { jobId },
    });

    if (error) {
        console.error(`[DEBUG] geminiService.getPredictionResult: Received ERROR from "get-prediction" for job ID ${jobId}.`, error);
        throw new Error(`[Service Error] Could not retrieve prediction result: ${error.message}`);
    }
    
    console.log(`[DEBUG] geminiService.getPredictionResult: Received SUCCESS response for job ID ${jobId}. Raw data:`, data);
    
    // The raw prediction data from the DB needs to be mapped to the UI-friendly HistoryItem type.
    const mappedData = mapPredictionToHistoryItem(data as RawPrediction);
    console.log(`[DEBUG] geminiService.getPredictionResult: Mapped data for job ID ${jobId}.`, mappedData);
    return mappedData;
}