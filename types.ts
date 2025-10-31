export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

export interface BestBet {
  category: string;
  value: string;
  reasoning: string;
  confidence: string; // e.g. "75%"
  // New optional fields for Over/Under markets
  overValue?: string; // e.g. "Over 2.5"
  overConfidence?: string; // e.g. "80%"
  underValue?: string; // e.g. "Under 2.5"
  underConfidence?: string; // e.g. "20%"
  betStatus?: 'won' | 'lost' | 'pending';
}

// NEW: For structured H2H data
export interface HeadToHeadStats {
  totalMatches: number;
  teamA_wins: number;
  draws: number;
  teamB_wins: number;
  summary: string;
}

export interface KeyStats {
  teamA_form: string;
  teamB_form: string;
  head_to_head: HeadToHeadStats; // Changed from string
}

export interface LeagueContext {
  leagueName: string | null;
  teamA_position: string | null;
  teamB_position: string | null;
  isRivalry: boolean;
  isDerby: boolean;
  contextualAnalysis: string | null;
}

export interface PlayerStat {
  playerName: string;
  teamName: string; // To help with filtering
  position: string; // e.g., 'Forward', 'Midfielder'
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
}

export interface GoalScorerPrediction {
  playerName: string;
  teamName: string;
  probability: 'High' | 'Medium' | 'Low';
  reasoning: string;
}

export interface GoalProbabilities {
  "0-1": string; // e.g. "25%"
  "2-3": string; // e.g. "45%"
  "4+": string; // e.g. "30%"
}

// NEW: For reliable BTTS data
export interface BttsPrediction {
  yesProbability: string; // "70%"
  noProbability: string; // "30%"
}

// NEW: For reliable Over/Under data
export interface OverUnderPrediction {
  over25Probability: string; // "65%"
  under25Probability: string; // "35%"
}


export interface PredictionResultData {
  prediction: string;
  confidence: string;
  teamA_winProbability: string; // e.g. "60%"
  teamB_winProbability: string; // e.g. "15%"
  drawProbability: string;
  analysis: string;
  keyStats: KeyStats;
  bestBets: BestBet[];
  sources?: GroundingChunk[]; // Sources are optional from the main prediction
  availabilityFactors?: string;
  // New detailed match info
  venue?: string;
  kickoffTime?: string;
  referee?: string;
  teamA_logo?: string;
  teamB_logo?: string;
  leagueContext?: LeagueContext;
  playerStats?: PlayerStat[];
  goalScorerPredictions?: GoalScorerPrediction[];
  goalProbabilities?: GoalProbabilities; // New field for goal chart
  fromCache?: boolean; // Flag to indicate if the result is from cache
  bttsPrediction?: BttsPrediction;
  overUnderPrediction?: OverUnderPrediction;
}

// This type represents a flattened prediction record, combining
// the prediction_data JSON with the main table columns.
export interface HistoryItem extends PredictionResultData {
    id: string; // UUID from the database
    teamA: string;
    teamB: string;
    timestamp: string; // Corresponds to the `created_at` field from the database
    matchCategory: 'men' | 'women';
    status?: 'pending' | 'won' | 'lost' | 'processing' | 'failed' | null;
    tally: number;
    // Fix: Add optional error field to carry messages from failed jobs.
    error?: string;
}

export interface LiveMatch {
    id: string;
    league: string;
    teamA: string;
    teamB: string;
    scoreA: number | null;
    scoreB: number | null;
    time: string;
    status: 'LIVE' | 'HT' | 'FT' | 'Not Started';
}

// This type represents the raw data structure of a prediction
// as it is stored in the Supabase 'predictions' table.
export interface RawPrediction {
    id: string;
    created_at: string;
    team_a: string;
    team_b: string;
    match_category: 'men' | 'women';
    // FIX: Make this partial to reflect that data is not always complete (e.g., during 'processing' or 'failed' states).
    prediction_data: Partial<PredictionResultData> & { error?: string };
    status: 'pending' | 'won' | 'lost' | 'processing' | 'failed' | null;
    tally: number;
}

// This type defines the structure for the accuracy statistics object.
export interface AccuracyStats {
    total: number;
    wins: number;
}

// This type defines the structure for a team's aggregated performance stats.
export interface TeamPerformanceStats {
  total: number;
  wins: number;
  recentOutcomes: Array<HistoryItem['status']>;
}

export interface UserBet {
    id: string;
    prediction_id: string;
    chosen_bet_category: string;
    chosen_bet_value: string;
}

export interface UserProfile {
    id: string; // Corresponds to the user's auth ID
    subscription_status: 'free' | 'pro';
    monthly_prediction_count: number;
    last_prediction_date: string;
}

export interface FeaturedMatch {
  teamA: string;
  teamB: string;
  category: 'men' | 'women';
  description: string;
}