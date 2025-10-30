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
    status: string | null; // e.g., "68", "HT", "Finished", "19:00"
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

        // Map the raw data to the LiveMatch format expected by the UI, handling various status texts.
        return rawMatches.map((match): LiveMatch => {
            const rawStatus = match.status || 'Not Started';
            const displayStatus = rawStatus.toUpperCase();
            
            let status: LiveMatch['status'] = 'Not Started';
            let time: string = rawStatus;

            // Handle various in-progress statuses
            if (displayStatus.includes('KICK OFF') || displayStatus.includes('1ST HALF') || displayStatus.includes('2ND HALF') || displayStatus.includes('EXTRA TIME') || displayStatus.includes('PENALTY') || displayStatus.includes('LIVE')) {
                status = 'LIVE';
                time = 'Live';
            } else if (displayStatus.includes('HALFTIME') || displayStatus === 'HT') {
                status = 'HT';
                time = 'HT';
            } else if (displayStatus.includes('FINISHED') || displayStatus === 'FT') {
                status = 'FT';
                time = 'FT';
            // Handle upcoming matches with kickoff times
            } else if (/\d{2}:\d{2}/.test(rawStatus)) {
                status = 'Not Started';
                const timeMatch = rawStatus.match(/\d{2}:\d{2}/);
                time = timeMatch ? timeMatch[0] : 'NS';
            }
            
            // A special check for when the API gives a minute '##' as status
            if (/^\d+'?$/.test(rawStatus)) {
                status = 'LIVE';
                time = rawStatus.endsWith("'") ? rawStatus : `${rawStatus}'`;
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
        }).filter(match => match.status !== 'FT'); // Filter out completed matches

    } catch (err) {
        console.error("Error fetching live scores via Supabase function:", err);
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while fetching scores.';
        throw new Error(errorMessage);
    }
}