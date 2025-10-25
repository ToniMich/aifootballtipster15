import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HistoryItem, RawPrediction, AccuracyStats, PredictionResultData } from '../types';

// Singleton Supabase client instance to avoid re-creating it.
let supabaseClient: SupabaseClient | null = null;

/**
 * Initializes the singleton Supabase client by fetching configuration from the backend.
 * This should be called once when the application starts.
 * @throws {Error} If the client cannot be initialized.
 */
export const initializeSupabaseClient = async (): Promise<void> => {
    if (supabaseClient) {
        return;
    }

    try {
        // This relative path works for both local dev (via Vite proxy) and production.
        const response = await fetch('/functions/v1/get-config');
        
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Failed to fetch server config:', errorBody);
            throw new Error(`The backend configuration endpoint returned an error (Status: ${response.status}).`);
        }
        
        const config = await response.json();

        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            throw new Error('Invalid configuration received from the server.');
        }

        supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);

    } catch (error) {
        console.error("Supabase client initialization failed:", error);
        // This specific error message is caught by App.tsx to display the setup instructions.
        throw new Error(`[Configuration Error] Could not connect to the backend. Please ensure your Supabase project is running and you have deployed its functions.`);
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