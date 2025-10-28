// services/supabaseService.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HistoryItem, RawPrediction, AccuracyStats, PredictionResultData } from '../types';

let supabaseClient: SupabaseClient | null = null;
let isPlaceholderMode = false;
let initializePromise: Promise<void> | null = null;

/**
 * A robust function to get an environment variable from multiple possible sources.
 * It safely checks for Vite's `import.meta.env` and Node's `process.env`
 * without causing a ReferenceError if one does not exist.
 * @param {string} name - The name of the environment variable (e.g., 'VITE_SUPABASE_URL').
 * @returns {string | undefined} The value of the variable, or undefined if not found.
 */
const getEnvVariable = (name: string): string | undefined => {
    // Safely check for Vite's `import.meta.env`
    try {
        // FIX: Cast `import.meta` to `any` to prevent TypeScript errors about the `env` property,
        // which is added by Vite and not known to the standard TS types.
        if (typeof import.meta !== 'undefined' && typeof (import.meta as any).env !== 'undefined' && (import.meta as any).env[name]) {
            return (import.meta as any).env[name];
        }
    } catch (e) {
        // Silently ignore if import.meta is not available
    }

    // Safely check for Node-style `process.env`
    try {
        if (typeof process !== 'undefined' && typeof process.env !== 'undefined' && process.env[name]) {
            return process.env[name];
        }
    } catch (e) {
        // Silently ignore if process is not available
    }
    
    return undefined;
};

export const initializeSupabaseClient = (): Promise<void> => {
    if (initializePromise) {
        return initializePromise;
    }

    initializePromise = new Promise((resolve) => {
        try {
            /**
             * Checks if a given string is a valid HTTP/HTTPS URL.
             * @param {string | undefined} url - The URL to validate.
             * @returns {boolean} True if the URL is valid, false otherwise.
             */
            const isValidUrl = (url: string | undefined): boolean => {
                if (!url) return false;
                try {
                    const newUrl = new URL(url);
                    return newUrl.protocol === 'http:' || newUrl.protocol === 'https:';
                } catch (e) {
                    return false;
                }
            };

            const supabaseUrl = getEnvVariable('VITE_SUPABASE_URL') || getEnvVariable('SUPABASE_URL');
            const supabaseAnonKey = getEnvVariable('VITE_SUPABASE_ANON_KEY') || getEnvVariable('SUPABASE_ANON_KEY');

            if (!isValidUrl(supabaseUrl) || !supabaseAnonKey) {
                isPlaceholderMode = true;
                const errorParts: string[] = [];
                if (!supabaseUrl) {
                    errorParts.push("SUPABASE_URL is missing.");
                } else if (!isValidUrl(supabaseUrl)) {
                    errorParts.push("SUPABASE_URL is not a valid HTTP/HTTPS URL.");
                }
                if (!supabaseAnonKey) {
                    errorParts.push("SUPABASE_ANON_KEY is missing.");
                }

                const detailedError = `Supabase configuration failed: ${errorParts.join(' ')} The application cannot connect to its backend and will run in placeholder mode.`;
                console.warn(detailedError);
                
                // Instead of rejecting, we resolve. The app will enter placeholder mode gracefully.
                resolve();
                return; // Stop execution
            } 
            
            isPlaceholderMode = false;
            supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
            console.log(`Supabase client initialized successfully. Placeholder mode: ${isPlaceholderMode}`);
            resolve();
        } catch (error) {
            console.error("Supabase client initialization crashed:", error);
            isPlaceholderMode = true;
            // Also resolve here to prevent the app from crashing with an unhandled rejection.
            resolve();
        }
    });

    return initializePromise;
};

/**
 * Checks if the application is configured with real Supabase credentials.
 * @returns {boolean} True if the app is configured, false otherwise.
 */
export const isAppConfigured = (): boolean => !isPlaceholderMode;

export const getSupabaseClient = async (): Promise<SupabaseClient> => {
    await initializeSupabaseClient();
    if (!supabaseClient) {
        // This will be true if we are in placeholder mode or if initialization failed
        // in an unexpected way. The calling functions are responsible for checking
        // isAppConfigured() first, so this acts as a failsafe.
        throw new Error('Supabase client is not available. Ensure the app is configured and not in placeholder mode.');
    }
    return supabaseClient;
};

export const mapPredictionToHistoryItem = (rawPrediction: RawPrediction): HistoryItem => {
    const predictionData = rawPrediction.prediction_data || {};
    
    // Define a complete default structure. This is the source of truth for the object shape.
    const defaults: PredictionResultData = {
        prediction: 'Prediction not available',
        confidence: 'N/A',
        teamA_winProbability: '0%',
        teamB_winProbability: '0%',
        drawProbability: '0%',
        analysis: 'Analysis not available.',
        keyStats: { teamA_form: '?????', teamB_form: '?????', head_to_head: { totalMatches: 0, teamA_wins: 0, draws: 0, teamB_wins: 0, summary: 'N/A' } },
        bestBets: [],
        sources: [],
        availabilityFactors: 'N/A',
        venue: 'N/A',
        kickoffTime: 'N/A',
        referee: 'N/A',
        teamA_logo: undefined,
        teamB_logo: undefined,
        leagueContext: { leagueName: null, teamA_position: null, teamB_position: null, isRivalry: false, isDerby: false, contextualAnalysis: null },
        playerStats: [],
        goalScorerPredictions: [],
        goalProbabilities: { "0-1": '0%', "2-3": '0%', "4+": '0%' },
        fromCache: false,
        bttsPrediction: { yesProbability: '0%', noProbability: '0%' },
        overUnderPrediction: { over25Probability: '0%', under25Probability: '0%' },
    };

    // Construct the final object property by property, avoiding the ambiguous `...predictionData` spread.
    // This explicitly prevents any malformed data (e.g., a `null` for an object/array) from sneaking through.
    const fullPredictionData: PredictionResultData = {
        prediction: predictionData.prediction ?? defaults.prediction,
        confidence: predictionData.confidence ?? defaults.confidence,
        teamA_winProbability: predictionData.teamA_winProbability ?? defaults.teamA_winProbability,
        teamB_winProbability: predictionData.teamB_winProbability ?? defaults.teamB_winProbability,
        drawProbability: predictionData.drawProbability ?? defaults.drawProbability,
        analysis: predictionData.analysis ?? defaults.analysis,
        availabilityFactors: predictionData.availabilityFactors ?? defaults.availabilityFactors,
        venue: predictionData.venue ?? defaults.venue,
        kickoffTime: predictionData.kickoffTime ?? defaults.kickoffTime,
        referee: predictionData.referee ?? defaults.referee,
        teamA_logo: predictionData.teamA_logo ?? defaults.teamA_logo,
        teamB_logo: predictionData.teamB_logo ?? defaults.teamB_logo,
        fromCache: predictionData.fromCache ?? defaults.fromCache,

        // For nested objects, safely merge them with defaults.
        keyStats: {
            ...defaults.keyStats,
            ...(predictionData.keyStats || {}),
            head_to_head: { ...defaults.keyStats.head_to_head, ...(predictionData.keyStats?.head_to_head || {}) }
        },
        leagueContext: { ...defaults.leagueContext, ...(predictionData.leagueContext || {}) },
        goalProbabilities: { ...defaults.goalProbabilities, ...(predictionData.goalProbabilities || {}) },
        bttsPrediction: { ...defaults.bttsPrediction, ...(predictionData.bttsPrediction || {}) },
        overUnderPrediction: { ...defaults.overUnderPrediction, ...(predictionData.overUnderPrediction || {}) },
        
        // For arrays, ensure they are never null, falling back to an empty array.
        bestBets: predictionData.bestBets || defaults.bestBets,
        sources: predictionData.sources || defaults.sources,
        playerStats: predictionData.playerStats || defaults.playerStats,
        goalScorerPredictions: predictionData.goalScorerPredictions || defaults.goalScorerPredictions,
    };

    return {
        ...fullPredictionData,
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
    if (!isAppConfigured()) return [];

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

export const getAccuracyStats = async (): Promise<AccuracyStats> => {
    if (!isAppConfigured()) return { total: 0, wins: 0 };

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

export async function updatePredictionStatus(id: string, status: 'won' | 'lost'): Promise<void> {
    if (!isAppConfigured()) {
        console.warn("Cannot update prediction status: App is in placeholder mode.");
        return;
    }
    
    const supabase = await getSupabaseClient();
    const { error } = await supabase
        .from('predictions')
        .update({ status: status })
        .eq('id', id)
        .in('status', ['pending', 'processing']); // Can only update pending or processing predictions

    if (error) {
        throw new Error(`[Database Error] Could not update the prediction status: ${error.message}`);
    }
}