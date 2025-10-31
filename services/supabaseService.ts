
// services/supabaseService.ts
import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { HistoryItem, RawPrediction, AccuracyStats, PredictionResultData, TeamPerformanceStats, UserBet, BestBet, UserProfile } from '../types';
import { getSupabaseCredentials } from './localStorageService';

let supabaseClient: SupabaseClient | null = null;
let isPlaceholderMode = false;
let initializePromise: Promise<void> | null = null;

/**
 * Initializes the Supabase client. This function is designed to run once and be reused.
 * It robustly checks for environment variables and sets the application's configuration status.
 */
export const initializeSupabaseClient = (): Promise<void> => {
    if (initializePromise) {
        return initializePromise;
    }

    initializePromise = new Promise((resolve) => {
        const { url: supabaseUrl, key: supabaseAnonKey } = getSupabaseCredentials();

        const isValidUrl = (url: string | undefined | null): boolean => {
            if (!url) return false;
            try {
                new URL(url);
                return true;
            } catch (e) {
                return false;
            }
        };

        if (!isValidUrl(supabaseUrl) || !supabaseAnonKey) {
            console.warn(
                "Supabase credentials not found in localStorage. The application needs to be configured."
            );
            isPlaceholderMode = true;
            supabaseClient = null;
        } else {
            try {
                isPlaceholderMode = false;
                supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
                console.log("Supabase client initialized successfully.");
            } catch (error) {
                 console.error("Supabase client creation failed with provided credentials.", error);
                 isPlaceholderMode = true;
                 supabaseClient = null;
            }
        }
        resolve();
    });

    return initializePromise;
};


/**
 * Checks if the application is configured with real Supabase credentials.
 * @returns {boolean} True if the app is configured, false otherwise.
 */
export const isAppConfigured = (): boolean => !isPlaceholderMode;

/**
 * Gets the singleton Supabase client instance, ensuring it's initialized first.
 * @throws {Error} If the Supabase client is not available or configured.
 * @returns {Promise<SupabaseClient>} The initialized Supabase client.
 */
export const getSupabaseClient = async (): Promise<SupabaseClient> => {
    await initializeSupabaseClient();
    if (!supabaseClient || isPlaceholderMode) {
        throw new Error('Supabase client is not available. Ensure the app is configured and not in placeholder mode.');
    }
    return supabaseClient;
};

// --- Auth Functions ---

export const getSession = async (): Promise<Session | null> => {
    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session;
};

export const onAuthStateChange = (callback: (event: string, session: Session | null) => void) => {
    // This function must run after client initialization
    if (!supabaseClient) {
        console.error("Cannot subscribe to auth state change before Supabase client is initialized.");
        return { subscription: null };
    }
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(callback);
    return { subscription };
};

export const signOut = async () => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Error signing out:", error);
    }
};

/**
 * Fetches the profile data for the currently authenticated user.
 * @returns {Promise<UserProfile | null>} The user's profile or null if not found/logged out.
 */
export const getUserProfile = async (): Promise<UserProfile | null> => {
    if (!isAppConfigured()) return null;

    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (error) {
        // It's common for a profile to not exist immediately after signup,
        // so we don't want to throw a hard error here. The trigger should handle it.
        console.warn(`Could not fetch user profile: ${error.message}`);
        return null;
    }

    return data;
};

/**
 * Safely maps a raw prediction from the database to the HistoryItem type used by the UI.
 * This function is defensive and provides default values for all fields to prevent crashes
 * from incomplete or malformed data.
 * @param {RawPrediction} rawPrediction - The raw data object from the 'predictions' table.
 * @returns {HistoryItem} A complete and safe-to-render HistoryItem object.
 */
export const mapPredictionToHistoryItem = (rawPrediction: RawPrediction): HistoryItem => {
    const predictionData = rawPrediction.prediction_data || {};
    
    // Define a complete default structure. This acts as a "scaffold" to ensure the final object has all required properties.
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

    // Construct the final object by safely merging the actual data with the defaults.
    const fullPredictionData: PredictionResultData = {
        ...defaults,
        ...predictionData,
        // For nested objects, explicitly merge them to prevent them from being overwritten by a null/undefined value.
        keyStats: {
            ...defaults.keyStats,
            ...(predictionData.keyStats || {}),
            head_to_head: { ...defaults.keyStats.head_to_head, ...(predictionData.keyStats?.head_to_head || {}) }
        },
        leagueContext: { ...defaults.leagueContext, ...(predictionData.leagueContext || {}) },
        goalProbabilities: { ...defaults.goalProbabilities, ...(predictionData.goalProbabilities || {}) },
        bttsPrediction: { ...defaults.bttsPrediction, ...(predictionData.bttsPrediction || {}) },
        overUnderPrediction: { ...defaults.overUnderPrediction, ...(predictionData.overUnderPrediction || {}) },
        // Ensure arrays are always arrays, not null.
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
        // Carry over any error message from a failed prediction job.
        error: predictionData.error,
    };
};

/**
 * Fetches the logged-in user's prediction history from the database.
 * @returns {Promise<HistoryItem[]>} A promise that resolves to an array of the user's prediction history items.
 */
export const getPredictionHistory = async (): Promise<HistoryItem[]> => {
    if (!isAppConfigured()) return [];

    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return []; // Return empty if no user is logged in

    const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        throw new Error(`[Database Error] Could not fetch your prediction history: ${error.message}`);
    }
    return (data || []).map(mapPredictionToHistoryItem);
};

/**
 * Deletes a specific prediction from the user's history.
 * @param {string} id - The UUID of the prediction to delete.
 */
export const deletePrediction = async (id: string): Promise<void> => {
    if (!isAppConfigured()) {
        throw new Error("Cannot delete prediction: App is not configured.");
    }

    const supabase = await getSupabaseClient();
    const { error } = await supabase
        .from('predictions')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(`[Database Error] Could not delete prediction: ${error.message}`);
    }
};

/**
 * Calculates the AI's prediction accuracy based on the logged-in user's historical data.
 * @returns {Promise<AccuracyStats>} A promise that resolves to the user's accuracy statistics.
 */
export const getAccuracyStats = async (): Promise<AccuracyStats> => {
    if (!isAppConfigured()) {
        return { total: 0, wins: 0 };
    }

    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { total: 0, wins: 0 };

    const { data, error } = await supabase
        .from('predictions')
        .select('status')
        .in('status', ['won', 'lost']); // RLS handles filtering by user_id

    if (error) {
        throw new Error(`[Database Error] Could not calculate your accuracy stats: ${error.message}`);
    }

    return {
        total: data.length,
        wins: data.filter(p => p.status === 'won').length,
    };
};

/**
 * Fetches aggregated performance statistics for a specific team.
 * @param {string} teamName - The name of the team to fetch stats for.
 * @returns {Promise<TeamPerformanceStats>} A promise that resolves to the team's performance stats.
 */
export const getTeamPerformanceStats = async (teamName: string): Promise<TeamPerformanceStats> => {
    if (!isAppConfigured()) {
        throw new Error("Cannot fetch team stats. The application backend is not configured.");
    }
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('get-team-stats', {
        body: { teamName },
    });

    if (error) {
        const errorMessage = error.message.includes('Failed to fetch') 
            ? 'The stats service is currently unavailable.'
            : error.message;
        throw new Error(`[Service Error] ${errorMessage}`);
    }
    
    return data;
};

// --- User Bet Tracking Functions ---

/**
 * Saves or updates a user's chosen bet for a specific prediction.
 * @param {string} predictionId - The ID of the prediction.
 * @param {BestBet} chosenBet - The bet object chosen by the user.
 * @returns {Promise<UserBet>} The saved user bet data.
 */
export const saveUserBet = async (predictionId: string, chosenBet: BestBet): Promise<UserBet> => {
    const supabase = await getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required to save a bet.");

    const betToSave = {
        user_id: user.id,
        prediction_id: predictionId,
        chosen_bet_category: chosenBet.category,
        chosen_bet_value: chosenBet.value,
    };

    const { data, error } = await supabase
        .from('user_bets')
        .upsert(betToSave, { onConflict: 'user_id, prediction_id' })
        .select()
        .single();
        
    if (error) {
        throw new Error(`[Database Error] Could not save your bet: ${error.message}`);
    }
    return data;
};

/**
 * Retrieves the user's chosen bet for a specific prediction.
 * @param {string} predictionId - The ID of the prediction to check.
 * @returns {Promise<UserBet | null>} The user's bet, or null if none exists.
 */
export const getUserBetForPrediction = async (predictionId: string): Promise<UserBet | null> => {
    const supabase = await getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('user_bets')
        .select('*')
        .eq('prediction_id', predictionId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.error(`[Database Error] Could not retrieve user bet: ${error.message}`);
        return null;
    }
    return data;
};
