import { LiveMatch } from '../types';
import { getSupabaseClient } from './supabaseService';

// This interface describes the structure of a single match object
// returned by the updated 'live-scores' Edge Function.
interface RawLiveMatch {
    idEvent: string | null;
    league: string | null;
    home: string | null;
    away: string | null;
    homeScore: number | null;
    awayScore: number | null;
    status: string | null; // e.g., "68", "HT", "Finished"
}

/**
 * Fetches live soccer/football scores by calling the backend Edge Function.
 * - Uses the secure 'live-scores' Supabase Edge Function which sources from TheSportsDB v2 API.
 * @returns {Promise<LiveMatch[]>} A promise that resolves to an array of live matches formatted for the UI.
 */
export async function fetchLiveScores(): Promise<LiveMatch[]> {
    try {
        const supabase = await getSupabaseClient();
        // Invoke the 'live-scores' function.
        // The function returns an object like { cached: boolean, matches: [...] }
        const { data, error } = await supabase.functions.invoke('live-scores');

        if (error) {
            console.error('Supabase function invocation error:', error.message);
            throw new Error(error.message);
        }
        
        // The array of matches is now under the `matches` key.
        const rawMatches: RawLiveMatch[] = data.matches || [];

        // Map the new raw data format to the LiveMatch format expected by the UI
        return rawMatches.map((match): LiveMatch => {
            const displayStatus = (match.status || '').toUpperCase();
            let status: LiveMatch['status'] = 'Not Started';
            let time = match.status || 'NS'; // Default time to the status string

            // Determine the standardized status and time for the UI
            if (displayStatus.includes("'") || /^\d+$/.test(displayStatus) || displayStatus.includes("LIVE")) {
                status = 'LIVE';
                const minuteMatch = displayStatus.match(/\d+/); // Extract numbers
                time = minuteMatch ? `${minuteMatch[0]}'` : 'Live';
            } else if (displayStatus === 'HT' || displayStatus.includes('HALF')) {
                status = 'HT';
                time = 'HT';
            } else if (displayStatus === 'FT' || displayStatus.includes('FINISHED')) {
                status = 'FT';
                time = 'FT';
            }

            return {
                id: match.idEvent || `${match.league}-${match.home}-${match.away}`, // Use event ID if available
                league: match.league || 'Unknown League',
                teamA: match.home || 'Team A',
                teamB: match.away || 'Team B',
                scoreA: match.homeScore,
                scoreB: match.awayScore,
                time: time,
                status: status,
            };
        });

    } catch (err) {
        console.error("Error fetching live scores via Supabase function:", err);
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while fetching scores.';
        throw new Error(errorMessage);
    }
}