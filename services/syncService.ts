/**
 * Calls the secure backend Netlify function to sync prediction statuses.
 * The backend will check for finished matches and update their status to 'won' or 'lost'.
 *
 * @returns {Promise<string>} A promise that resolves to a success message.
 */
export async function syncPredictionStatuses(): Promise<string> {
    const response = await fetch('/api/update-statuses', {
        method: 'POST',
    });

    const data = await response.json();

    if (!response.ok) {
        const errorMessage = data.error || `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
    }

    return data.message || 'Sync operation completed.';
}
