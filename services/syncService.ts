import { getSupabaseClient } from './supabaseService';

/**
 * Calls the secure backend Supabase Edge function to sync prediction statuses.
 * The backend will check for finished matches and update their status to 'won' or 'lost'.
 *
 * @returns {Promise<string>} A promise that resolves to a success message from the function.
 */
export async function syncPredictionStatuses(): Promise<string> {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.functions.invoke('update-statuses');

        if (error) {
            throw new Error(error.message || 'Sync operation failed.');
        }

        return data.message || 'Sync operation completed.';
    } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred.';
        throw new Error(`[Sync Error] ${message}`);
    }
}