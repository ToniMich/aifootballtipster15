import { LiveMatch } from '../types';

/**
 * Fetches live soccer scores from the secure backend Netlify function.
 * The backend now handles all sorting, filtering, and data mapping.
 * @returns {Promise<LiveMatch[]>} A promise that resolves to an array of live matches.
 */
export async function fetchLiveScores(): Promise<LiveMatch[]> {
    const response = await fetch('/api/fetch-scores');

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error("Received non-JSON response from scores endpoint:", responseText);
        throw new Error(`Live scores server returned an invalid response. This may be a temporary issue. Status: ${response.status}`);
    }

    const data = await response.json();

    if (!response.ok) {
        const errorMessage = data.error || `Could not retrieve live scores. Server responded with status ${response.status}`;
        throw new Error(errorMessage);
    }

    // The backend now returns a clean `matches` array, so no client-side processing is needed.
    return data.matches || [];
}