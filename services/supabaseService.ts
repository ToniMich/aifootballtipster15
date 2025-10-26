import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HistoryItem, RawPrediction, AccuracyStats, PredictionResultData } from '../types';

// Singleton Supabase client instance to avoid re-creating it.
let supabaseClient: SupabaseClient | null = null;
// Promise to ensure initialization only runs once.
let initializePromise: Promise<void> | null = null;

/**
 * Initializes the singleton Supabase client.
 * It first tries to fetch credentials from a secure backend endpoint.
 * As a fallback for local development, it checks for Vite environment variables.
 *
 * @returns {Promise<void>} A promise that resolves when the client is initialized.
 * @throws {Error} If credentials cannot be obtained.
 */
const initializeSupabaseClient = (): Promise<void> => {
    if (supabaseClient) {
        return Promise.resolve();
    }
    if (initializePromise) {
        return initializePromise;
    }

    initializePromise = (async () => {
        let supabaseUrl: string | undefined;
        let supabaseAnonKey: string | undefined;

        try {
            // Production-first approach: Fetch config from the backend.
            // This assumes a reverse proxy forwards /functions/v1/* to the Supabase instance.
            const response = await fetch('/functions/v1/get-config');
            if (response.ok) {
                const config = await response.json();
                if (config.supabaseUrl && config.supabaseAnonKey) {
                    supabaseUrl = config.supabaseUrl;
                    supabaseAnonKey = config.supabaseAnonKey;
                } else {
                     console.warn("Fetched config from backend is incomplete.");
                }
            } else {
                 console.warn(`Failed to fetch config from backend (status: ${response.status}), falling back to local environment variables.`);
            }
        } catch (error) {
            console.warn("Could not fetch config from backend, falling back to local environment variables. Error:", error);
        }

        // Fallback for local development using Vite's env variables.
        if (!supabaseUrl || !supabaseAnonKey) {
            supabaseUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL;
            supabaseAnonKey = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY;
        }

        if (!supabaseUrl || !supabaseAnonKey) {
            initializePromise = null; // Reset for future retries
            throw new Error("[Configuration Error] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing. Please create a .env.local file in the project root and add these values. Refer to the README.md for setup instructions.");
        }

        try {
            supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
        } catch (error) {
             initializePromise = null;
             console.error("Supabase client initialization failed:", error.message);
             throw error;
        }

    })();

    return initializePromise;
};


/**
 * Returns the initialized singleton Supabase client.
 * @returns {SupabaseClient} The Supabase client instance.
 * @throws {Error} If the client has not been initialized yet.
 */
const getSupabaseClient = (): SupabaseClient => {
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


const getPredictionHistory = async (): Promise<HistoryItem[]> => {
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

const getAccuracyStats = async (): Promise<AccuracyStats> => {
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

const updatePredictionStatus = async (id: string, status: 'won' | 'lost'): Promise<void> => {
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

export {
    initializeSupabaseClient,
    getSupabaseClient,
    getPredictionHistory,
    getAccuracyStats,
    updatePredictionStatus,
};