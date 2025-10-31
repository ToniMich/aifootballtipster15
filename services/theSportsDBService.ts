import { LiveMatch } from '../types';
import { isAppConfigured } from './supabaseService';
import { getSupabaseCredentials } from './localStorageService';

export async function fetchLiveScores(): Promise<LiveMatch[]> {
  if (!isAppConfigured()) {
    throw new Error('Supabase is not configured. Cannot fetch live scores.');
  }

  const { url, key: anonKey } = getSupabaseCredentials();
  if (!url || !anonKey) {
    throw new Error('Supabase credentials not found for live scores service.');
  }
  
  const functionUrl = `${url}/functions/v1/live-scores`;

  try {
    const response = await fetch(functionUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
      },
    });

    if (!response.ok) {
      // Try to parse the error from the function to provide a more specific message.
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        throw new Error(`The live scores service returned an invalid response: ${response.status} ${response.statusText}`);
      }
      console.error('Error response from live-scores function:', errorData);
      throw new Error(errorData?.error || `The live scores service returned an error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data && Array.isArray(data.matches)) {
      return data.matches;
    }
  
    console.warn('Response from live-scores did not contain a valid "matches" array.', data);
    return [];

  } catch (err) {
    // This will catch both network errors from fetch() itself and the errors we throw above.
    console.error('Failed to fetch scores:', err);
    // Re-throw a user-friendly message that the frontend can display.
    if (err instanceof Error) {
        // Pass through specific, user-friendly errors from the function if available.
        if (!err.message.toLowerCase().includes('failed to fetch')) {
            throw err;
        }
    }
    throw new Error('The live scores service is currently unavailable. Please check your connection.');
  }
}