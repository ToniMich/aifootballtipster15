import { HistoryItem } from '../types';

/**
 * Starts the prediction process by calling a secure backend function.
 * This is the "something in between" that connects the frontend to the backend.
 * 
 * HOW IT WORKS:
 * 1. The frontend (App.tsx) calls this function.
 * 2. This function sends a POST request to the URL `/api/request-prediction`.
 * 3. The Netlify server sees this URL and routes the request to the `netlify/functions/request-prediction.js` function.
 * 4. That backend function is the entry point. It will either:
 *    a) Return a cached result immediately.
 *    b) Create a new "processing" job in the database and return that job's info.
 *
 * @param {string} teamA - The name of the first team.
 * @param {string} teamB - The name of the second team.
 * @param {'men' | 'women'} matchCategory - The category of the match.
 * @returns {Promise<any>} A promise that resolves to either a full prediction or a processing job.
 */
export async function requestPrediction(teamA: string, teamB: string, matchCategory: 'men' | 'women'): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout

    try {
        const response = await fetch('/api/request-prediction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ teamA, teamB, matchCategory }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const responseText = await response.text();
            console.error("Received non-JSON response from prediction endpoint:", responseText);
            throw new Error(`[Network Error] Expected a JSON response but received HTML/Text. This indicates a server-side issue or a routing problem. Status: ${response.status}`);
        }

        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw new Error(errorMessage);
        }

        return data;

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('[Network Error] The request to the server timed out. This may be due to a network issue or the server being temporarily unavailable. Please try again.');
        }
        // Re-throw other errors to be handled by the caller
        throw error;
    }
}

/**
 * Fetches the status and data of a specific prediction by its ID.
 * This is used for polling after a "processing" job has been started.
 *
 * HOW IT WORKS:
 * 1. After `requestPrediction` returns a "processing" job, the frontend calls this function every few seconds.
 * 2. It sends a GET request to `/api/get-prediction` with the job ID.
 * 3. The Netlify server routes this to the `netlify/functions/get-prediction.js` function.
 * 4. That backend function simply checks the database for the specified job and returns its current status and data.
 * 5. Polling stops once the status is no longer 'processing'.
 * 
 * @param {string} id - The ID of the prediction to fetch.
 * @returns {Promise<any>} A promise that resolves to the full prediction record.
 */
export async function getPrediction(id: string): Promise<any> {
    const response = await fetch(`/api/get-prediction?id=${id}`);
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error("Received non-JSON response from get-prediction endpoint:", responseText);
        throw new Error(`[Network Error] Failed to poll for prediction result. Server returned non-JSON. Status: ${response.status}`);
    }

    const data = await response.json();

    if (!response.ok) {
        const errorMessage = data.error || `Failed to fetch prediction with status ${response.status}`;
        throw new Error(errorMessage);
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