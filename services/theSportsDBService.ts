import { LiveMatch } from '../types';
import { getSupabaseClient, isAppConfigured } from './supabaseService';
import { mockLiveScores } from '../data/liveScores';

/**
 * Fetches live soccer/football scores.
 * - Tries to use the secure 'fetch-scores' Supabase Edge Function.
 * - If the backend is not configured, it gracefully falls back to mock data.
 * @returns {Promise<LiveMatch[]>} A promise that resolves to an array of live matches.
 */
export async function fetchLiveScores(): Promise<LiveMatch[]> {
    if (!isAppConfigured()) {
        console.warn("Backend not configured. Falling back to mock data for live scores.");
        // Use a timeout to simulate a network request
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(mockLiveScores);
            }, 500);
        });
    }
    
    try {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase.functions.invoke('fetch-scores');

        if (error) {
            console.error('Supabase function invocation error:', error.message);
            throw new Error(error.message);
        }
        
        // The edge function returns data in the shape { matches: LiveMatch[] }
        return data.matches || [];

    } catch (err) {
        console.error("Error fetching live scores via Supabase function:", err);
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while fetching scores.';
        throw new Error(errorMessage);
    }
}
