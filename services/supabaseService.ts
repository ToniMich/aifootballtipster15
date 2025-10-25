import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HistoryItem, RawPrediction, AccuracyStats, PredictionResultData } from '../types';

// Singleton Supabase client instance to avoid re-creating it.
let supabaseClient: SupabaseClient | null = null;
// Promise to ensure initialization only runs once.
let initializePromise: Promise<void> | null = null;

/**
 * Initializes the singleton Supabase client. It first tries to use environment variables,
 * then falls back to fetching the configuration from the local Supabase instance
 * during development, making the setup more resilient.
 * @returns {Promise<void>} A promise that resolves when the client is initialized.
 */
export const initializeSupabaseClient = (): Promise<void> => {
    // If the client is already initialized or initialization is in progress, return the existing promise.
    if (supabaseClient) {
        return Promise.resolve();
    }
    if (initializePromise) {
        return initializePromise;
    }

    initializePromise = (async () => {
        try {
            const env = (import.meta as any).env;
            let supabaseUrl = env.VITE_SUPABASE_URL;
            let supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

            // If environment variables are not set in development, try fetching from the local dev server.
            // This makes local setup smoother, as only `supabase start` is required for the frontend to connect.
            if ((!supabaseUrl || !supabaseAnonKey) && env.DEV) {
                console.log("VITE_SUPABASE vars not found. Attempting to fetch config from local Supabase instance...");
                const localConfigUrl = 'http://127.0.0.1:54321/functions/v1/get-config';
                try {
                    const response = await fetch(localConfigUrl);
                    if (!response.ok) {
                        throw new Error(`Local config server responded with status ${response.status}`);
                    }
                    const config = await response.json();
                    if (config.supabaseUrl && config.supabaseAnonKey) {
                        supabaseUrl = config.supabaseUrl;
                        supabaseAnonKey = config.supabaseAnonKey;
                        console.log("Successfully fetched config from local Supabase instance.");
                    } else {
                        throw new Error("Invalid config object received from local server.");
                    }
                } catch (fetchError) {
                    console.warn("Could not fetch config from local Supabase instance. Please ensure it's running via `supabase start`.", fetchError);
                    // Proceed to the final check, which will likely fail and show the setup instructions.
                }
            }

            if (!supabaseUrl || !supabaseAnonKey) {
                throw new Error('[Configuration Error] Supabase URL/Key missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file, or ensure `supabase start` is running correctly.');
            }
            
            supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

        } catch (error) {
            console.error("Supabase client initialization failed:", error);
            initializePromise = null; // Allow retries on subsequent calls
            throw error; // Re-throw to be caught by the App component
        }
    })();

    return initializePromise;
};

/**
 * Returns the initialized singleton Supabase client.
 * @returns {SupabaseClient} The Supabase client instance.
 * @throws {Error} If the client has not been initialized yet.
 */
export const getSupabaseClient = (): SupabaseClient => {
    if (!supabaseClient) {
        throw new Error('Supabase client has not been initialized. Call initializeSupabaseClient and await its result first.');
    }
    return supabaseClient;
};

const mapPredictionToHistoryItem = (rawPrediction: RawPrediction): HistoryItem => {
    const predictionData = rawPrediction.prediction_data || {};
    return {
        prediction: '', confidence: '', drawProbability: '', analysis: '',
        keyStats: { teamA_form: '', teamB_form: '', head_to_head: '' },
        bestBets: [],
        ...(predictionData as PredictionResultData),
        id: rawPrediction.id,
        teamA: rawPrediction.team_a,
        teamB: rawPrediction.team_b,
        matchCategory: rawPrediction.match_category,
        timestamp: rawPrediction.created_at,
        status: rawPrediction.status,
        tally: rawPrediction.tally,
    };
};


export const getPredictionHistory = async (): Promise<HistoryItem[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        throw new Error(`[Database Error] Could not fetch prediction history: ${error.message}`);
    }
    return (data || []).map(mapPredictionToHistoryItem);
};

export const getAccuracyStats = async (): Promise<AccuracyStats> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('predictions')
        .select('status');

    if (error) {
        throw new Error(`[Database Error] Could not calculate accuracy stats: ${error.message}`);
    }

    const completedPredictions = (data || []).filter(p => p.status === 'won' || p.status === 'lost');
    return {
        total: completedPredictions.length,
        wins: completedPredictions.filter(p => p.status === 'won').length,
    };
};

export const updatePredictionStatus = async (id: string, status: 'won' | 'lost'): Promise<void> => {
    const supabase = getSupabaseClient();
    const { error } = await supabase
        .from('predictions')
        .update({ status: status })
        .eq('id', id)
        .eq('status', 'pending');

    if (error) {
        throw new Error(`[Database Error] Could not update the prediction status: ${error.message}`);
    }
};
