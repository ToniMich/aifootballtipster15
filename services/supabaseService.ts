// Manually define types for Vite's environment variables. This is a robust way to
// handle cases where TypeScript's default type resolution for 'vite/client' fails,
// which can occur in some editor or build environments.
declare global {
    interface ImportMeta {
        readonly env: {
            readonly VITE_SUPABASE_URL: string;
            readonly VITE_SUPABASE_ANON_KEY: string;
        }
    }
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HistoryItem, RawPrediction, AccuracyStats, PredictionResultData } from '../types';

// Singleton Supabase client instance to avoid re-creating it.
let supabaseClient: SupabaseClient | null = null;
// Promise to ensure initialization only runs once.
let initializePromise: Promise<void> | null = null;

/**
 * Initializes the singleton Supabase client.
 * This function now exclusively uses Vite's environment variables, which is the
 * standard and most reliable method for both local development (via .env.local)
 * and production builds (via hosting provider's environment variables).
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
        // Use Vite's import.meta.env to access environment variables on the client-side.
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        // Check if the environment variables are loaded correctly.
        if (!supabaseUrl || !supabaseAnonKey) {
            initializePromise = null; // Reset for future retries
            // Provide a clear error message that aligns with the project's setup instructions.
            throw new Error("[Configuration Error] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing. Please create a .env.local file in the project root, add the values, and restart your development server.");
        }

        try {
            // Create the Supabase client instance.
            supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
        } catch (error) {
             initializePromise = null; // Reset on failure
             console.error("Supabase client initialization failed:", error.message);
             // Re-throw the original error to be caught by the App component.
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