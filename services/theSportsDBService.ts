import { LiveMatch } from '../types';
import { getSupabaseClient, isAppConfigured } from './supabaseService';

// This is the type returned by the new 'live-scores' function
interface RawLiveScore {
    league: string;
    status: string; // e.g., "Live 68'", "HT", "FT"
    minute: string | null; // e.g., "68'"
    home: string;
    away: string;
    score_home: number | null;
    score_away: number | null;
}

/**
 * Fetches live soccer/football scores.
 * - Uses the secure 'live-scores' Supabase Edge Function which sources from TheSportsDB v2 API.
 * - Throws an error if the backend is not configured.
 * @returns {Promise<LiveMatch[]>} A promise that resolves to an array of live matches formatted for the UI.
 */
export async function fetchLiveScores(): Promise<LiveMatch[]> {
    if (!isAppConfigured()) {
        console.warn("Backend not configured. Live scores service is unavailable.");
        // Throw an error to be handled by the UI component, instead of showing placeholder data.
        throw new Error("The live scores service is currently unavailable because the backend is not configured.");
    }
    
    try {
        const supabase = await getSupabaseClient();
        // Invoke the new 'live-scores' function
        const { data, error } = await supabase.functions.invoke('live-scores');

        if (error) {
            console.error('Supabase function invocation error:', error.message);
            throw new Error(error.message);
        }
        
        // The new function returns { data: RawLiveScore[] }
        const rawScores: RawLiveScore[] = data.data || [];

        // Map the raw data to the LiveMatch format expected by the UI
        return rawScores.map((score): LiveMatch => {
            const displayStatus = (score.status || '').toUpperCase();
            let status: LiveMatch['status'] = 'Not Started';
            if (displayStatus.startsWith('LIVE')) {
                status = 'LIVE';
            } else if (displayStatus === 'HT') {
                status = 'HT';
            } else if (displayStatus === 'FT') {
                status = 'FT';
            }

            return {
                id: `${score.league}-${score.home}-${score.away}`, // Create a stable key
                league: score.league,
                teamA: score.home,
                teamB: score.away,
                scoreA: score.score_home,
                scoreB: score.score_away,
                time: score.minute || score.status, // Use minute if available, otherwise the short status
                status: status,
            };
        });

    } catch (err) {
        console.error("Error fetching live scores via Supabase function:", err);
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while fetching scores.';
        throw new Error(errorMessage);
    }
}
