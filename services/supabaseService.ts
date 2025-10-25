import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HistoryItem, RawPrediction, AccuracyStats, PredictionResultData } from '../types';

// Singleton Supabase client instance to avoid re-creating it.
let supabaseClient: SupabaseClient | null = null;

/**
 * Initializes the singleton Supabase client using environment variables.
 * This is the standard and most robust method for Vite applications.
 * @throws {Error} If the required VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY are not set.
 */
export const initializeSupabaseClient = (): void => {
    if (supabaseClient) {
        return;
    }
    
    // Safely access Vite environment variables.
    const env = (import.meta as any).env;

    // Check if the env object or the specific keys are missing.
    if (!env || !env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
        // This specific error message is caught by App.tsx to display setup instructions.
        throw new Error('[Configuration Error] Supabase URL/Key missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.');
    }

    const supabaseUrl = env.VITE_SUPABASE_URL;
    const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

    try {
        supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    } catch (error) {
        console.error("Supabase client initialization failed:", error);
        throw new Error(`Failed to create Supabase client: ${error.message}`);
    }
};

/**
 * Returns the initialized singleton Supabase client.
 * @returns {SupabaseClient} The Supabase client instance.
 * @throws {Error} If the client has not been initialized yet.
 */
export const getSupabaseClient = (): SupabaseClient => {
    if (!supabaseClient) {
        throw new Error('Supabase client has not been initialized. Call initializeSupabaseClient first.');
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