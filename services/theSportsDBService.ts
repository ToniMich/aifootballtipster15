import { LiveMatch } from '../types';
import { getSupabaseClient } from './supabaseService';

/**
 * Fetches live soccer scores from the secure backend Supabase Edge Function.
 * The backend handles all API key usage, sorting, filtering, and data mapping.
 * @returns {Promise<LiveMatch[]>} A promise that resolves to an array of live matches.
 */
export async function fetchLiveScores(): Promise<LiveMatch[]> {
    try {
        const supabase = await getSupabaseClient();
        // The body is optional for a GET-like request but is included for consistency.
        const { data, error } = await supabase.functions.invoke('fetch-scores');

        if (error) {
            // The error object from invoke might contain more details
            throw new Error(error.message || 'An unknown error occurred when invoking the function.');
        }

        // The Edge function returns a specific structure, { matches: [] }
        if (data && Array.isArray(data.matches)) {
            return data.matches;
        }
        
        // Handle cases where the function returns an unexpected structure but doesn't throw an error.
        console.warn("Received unexpected data structure from 'fetch-scores' function:", data);
        return [];

    } catch (error) {
        // Construct a more informative error message for the UI.
        const message = error instanceof Error ? error.message : 'Failed to retrieve server configuration.';
        // Re-throw the error with a more specific message for the UI to catch.
        throw new Error(`[Network Error] Failed to fetch scores: ${message}`);
    }
}