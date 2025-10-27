// This file no longer needs a manual declaration for Vite's environment variables,
// as we are now using the platform's standard secret management.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HistoryItem, RawPrediction, AccuracyStats, PredictionResultData } from '../types';

// Singleton Supabase client instance to avoid re-creating it.
let supabaseClient: SupabaseClient | null = null;
// Promise to ensure initialization only runs once.
let initializePromise: Promise<void> | null = null;

/**
 * Initializes the singleton Supabase client.
 * This function now uses `process.env` to securely load credentials, which is
 * the standard method for this execution environment.
 *
 * @returns {Promise<void>} A promise that resolves when the client is initialized.
 * @throws {Error} If credentials cannot be obtained.
 */
const initializeSupabaseClient = (): Promise<void> => {
    // If the promise already exists, return it to prevent re-initialization.
    if (initializePromise) {
        return initializePromise;
    }

    // Create a new promise and store it. This ensures the initialization
    // logic runs only once.
    initializePromise = new Promise((resolve, reject) => {
        // If the client is already created, resolve immediately.
        if (supabaseClient) {
            return resolve();
        }

        try {
            // FIX: The execution environment provides secrets on `process.env`.
            // Switched from `window.aistudio.getSecrets` to `process.env`.
            // The `(process as any)` cast is used to satisfy TypeScript in a browser-like environment.
            const supabaseUrl = (process as any).env.VITE_SUPABASE_URL;
            const supabaseAnonKey = (process as any).env.VITE_SUPABASE_ANON_KEY;

            if (!supabaseUrl || !supabaseAnonKey) {
                throw new Error("[Configuration Error] Supabase URL/Key are missing. Please ensure they are configured in the environment.");
            }

            supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
            console.log("Supabase client initialized successfully.");
            resolve();
        } catch (error) {
            console.error("Supabase client initialization failed:", error.message);
            // In case of failure, reset the promise to allow for future retries.
            initializePromise = null;
            reject(error);
        }
    });

    return initializePromise;
};


/**
 * Returns the initialized singleton Supabase client, awaiting initialization if necessary.
 * @returns {Promise<SupabaseClient>} A promise resolving to the Supabase client instance.
 * @throws {Error} If the client fails to initialize.
 */
const getSupabaseClient = async (): Promise<SupabaseClient> => {
    // This ensures that initialization is triggered if it hasn't been already.
    // It will wait for the existing `initializePromise` to complete.
    await initializeSupabaseClient();
    if (!supabaseClient) {
        // This line should not be reachable if `initializeSupabaseClient` resolves,
        // but it's a good safeguard.
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
    const supabase = await getSupabaseClient();
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
    const supabase = await getSupabaseClient();
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
    const supabase = await getSupabaseClient();
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