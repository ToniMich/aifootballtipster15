import React, { useState, useCallback, useEffect, useRef } from 'react';
import { startPredictionJob, getPredictionResult } from './services/geminiService';
import { HistoryItem } from './types';
import { initializeSupabaseClient, getPredictionHistory, getAccuracyStats, updatePredictionStatus } from './services/supabaseService';
import { getTheme, setTheme as saveTheme } from './services/localStorageService';
import { syncPredictionStatuses } from './services/syncService';
import Loader from './components/Loader';
import PredictionResult from './components/PredictionResult';
import { FTLogoIcon, SunIcon, MoonIcon, WarningIcon } from './components/icons';
import TeamInput from './components/TeamInput';
import DonationBlock from './components/DonationBlock';
import CategoryToggle from './components/CategoryToggle';
import PredictionHistory from './components/PredictionHistory';
import LiveScores from './components/LiveScores';
import AccuracyTracker from './components/AccuracyTracker';
import TicketModal from './components/TicketModal';
import TrackRecord from './components/TrackRecord';
import PredictionFeed from './components/PredictionFeed';
import SetupInstructions from './components/SetupInstructions';

interface AccuracyStats {
    total: number;
    wins: number;
}

const mapRawToHistoryItem = (raw: any): HistoryItem => {
    // Ensure prediction_data is an object to prevent errors when spreading
    const predictionData = raw.prediction_data || {};
    return {
        ...predictionData,
        id: raw.id,
        teamA: raw.team_a,
        teamB: raw.team_b,
        matchCategory: raw.match_category,
        timestamp: raw.created_at,
        status: raw.status,
        tally: raw.tally,
    };
};

const App: React.FC = () => {
    const [teamA, setTeamA] = useState<string>('');
    const [teamB, setTeamB] = useState<string>('');
    const [predictionResult, setPredictionResult] = useState<HistoryItem | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [appStatus, setAppStatus] = useState<'initializing' | 'ready' | 'config_error'>('initializing');
    const [initError, setInitError] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [accuracyStats, setAccuracyStats] = useState<AccuracyStats>({ total: 0, wins: 0 });
    const [theme, setTheme] = useState<'light' | 'dark'>(getTheme());
    const [matchCategory, setMatchCategory] = useState<'men' | 'women'>('men');
    const [selectedTicket, setSelectedTicket] = useState<HistoryItem | null>(null);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    // Ref to hold the polling interval ID and polling timeout ID
    const pollingIntervalRef = useRef<number | null>(null);
    const pollingTimeoutRef = useRef<number | null>(null);

    const clearPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
        }
    }, []);

    const refreshData = useCallback(async () => {
        try {
            const [fetchedHistory, fetchedStats] = await Promise.all([
                getPredictionHistory(),
                getAccuracyStats()
            ]);
            setHistory(fetchedHistory);
            setAccuracyStats(fetchedStats);
        } catch (err) {
            // Re-throw to be handled by the caller
            throw err;
        }
    }, []);
    
    useEffect(() => {
        const initializeApp = async () => {
            try {
                // Step 1: Initialize the Supabase client by fetching config from the backend.
                await initializeSupabaseClient();
                
                // Step 2: Once the client is ready, fetch the initial data.
                await refreshData();
                setAppStatus('ready');
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Initialization failed.';
                // If it's a configuration error from our new initializer, show the setup instructions.
                if (errorMessage.startsWith('[Configuration Error]')) {
                    setInitError(errorMessage);
                    setAppStatus('config_error');
                } else {
                    // For any other initialization errors, log them and show the main app with an error banner.
                    console.error("Initialization failed:", err);
                    setInitError(errorMessage);
                    setAppStatus('ready');
                }
            }
        };

        initializeApp();

        // Cleanup polling on component unmount
        return () => clearPolling();
    }, [refreshData, clearPolling]);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        saveTheme(theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };
    
    const handleStopOrReset = () => {
        clearPolling();
        setIsLoading(false);
        setError(null);
        setPredictionResult(null);
        setTeamA('');
        setTeamB('');
    };

    const handleUpdatePredictionStatus = async (id: string, status: 'won' | 'lost') => {
        try {
            await updatePredictionStatus(id, status);
            await refreshData();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred while updating status.';
            setError(errorMessage);
        }
    };
    
    const handlePredict = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setPredictionResult(null);
        clearPolling();
    
        try {
            const trimmedA = teamA.trim();
            const trimmedB = teamB.trim();
            
            // --- Validation Block ---
            const validTeamNameRegex = /^[\p{L}0-9\s.'&()-]+$/u;
            if (!trimmedA || !trimmedB) { throw new Error('Please enter names for both teams.'); }
            if (trimmedA.length < 2 || trimmedA.length > 50 || trimmedB.length < 2 || trimmedB.length > 50) { throw new Error('Team names must be between 2 and 50 characters long.'); }
            if (!validTeamNameRegex.test(trimmedA) || !validTeamNameRegex.test(trimmedB)) { throw new Error("Team names can only include letters, numbers, spaces, and .'-&()"); }
            if (trimmedA.toLowerCase() === trimmedB.toLowerCase()) { throw new Error('Please enter two different team names.'); }
            
            console.log(`[AIFootballTipster] Starting prediction for: ${trimmedA} vs ${trimmedB}`);
            const { isCached, data } = await startPredictionJob(trimmedA, trimmedB, matchCategory);

            if (isCached) {
                console.log("[AIFootballTipster] Cache hit. Displaying result.");
                setPredictionResult(mapRawToHistoryItem(data));
                setIsLoading(false); // Stop loading immediately
                try {
                    await refreshData(); // Refresh history in the background
                } catch (refreshError) {
                    console.warn("Failed to refresh history after cache hit, but showing result anyway:", refreshError);
                }
            } else {
                console.log(`[AIFootballTipster] Background job started with ID: ${data.jobId}. Starting to poll.`);
                // --- Polling Logic ---
                const jobId = data.jobId;

                const poll = async () => {
                    try {
                        const result = await getPredictionResult(jobId);
                        if (result && result.status && result.status !== 'processing') {
                            clearPolling();
                            if (result.status === 'failed') {
                                const errorMsg = result.prediction_data?.error || "The AI failed to generate a prediction. Please try again.";
                                throw new Error(errorMsg);
                            }
                            console.log("[AIFootballTipster] Polling successful. Displaying result.");
                            
                            // CORE FIX: Stop loading and show result *before* refreshing history.
                            setPredictionResult(mapRawToHistoryItem(result));
                            setIsLoading(false); 
                            
                            // Now, refresh the history list in the background. Even if this fails, the user sees their result.
                            try {
                                await refreshData();
                            } catch (refreshError) {
                                console.warn("Failed to refresh history after prediction, but showing result anyway:", refreshError);
                            }
                        }
                    } catch (pollError) {
                         clearPolling();
                         setError(pollError.message);
                         setIsLoading(false);
                    }
                };
                
                // Start polling immediately and then every 3 seconds.
                poll(); 
                pollingIntervalRef.current = window.setInterval(poll, 3000);

                // Set a 90-second timeout for the entire polling process.
                // This gives the Gemini Pro model ample time for complex analyses.
                pollingTimeoutRef.current = window.setTimeout(() => {
                    if (pollingIntervalRef.current) { // Check if it's still running
                        clearPolling();
                        setError("The request timed out. The server might be busy. Please try again later.");
                        setIsLoading(false);
                    }
                }, 90000); 
            }
        } catch (err) {
            clearPolling();
            setError(err.message);
            setIsLoading(false);
        }
    }, [teamA, teamB, matchCategory, refreshData, clearPolling]);
    
    const handleSync = async () => {
        setIsSyncing(true);
        setSyncMessage("Checking for results...");
        try {
            const result = await syncPredictionStatuses();
            setSyncMessage(result);
            await refreshData();
        } catch (err) {
            setSyncMessage(err.message);
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncMessage(null), 5000);
        }
    };

    const renderAppContent = () => {
        if (appStatus === 'initializing') {
            return (
                <div className="flex justify-center items-center h-64">
                    <Loader />
                </div>
            );
        }

        if (appStatus === 'config_error') {
            return <SetupInstructions error={initError} />;
        }

        // appStatus is 'ready' from here on.
        return (
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {initError && (
                    <div className="mb-8 p-4 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-500 rounded-lg text-red-800 dark:text-red-300 text-center animate-fade-in flex items-center gap-3">
                        <WarningIcon className="h-6 w-6" />
                        <p className="font-semibold">{initError}</p>
                    </div>
                )}
                
                <div className="lg:grid lg:grid-cols-3 lg:gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-6 sm:p-8 animate-fade-in-down">
                            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center sm:text-left">Get a New Prediction</h2>
                                <AccuracyTracker total={accuracyStats.total} wins={accuracyStats.wins} />
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <TeamInput
                                        value={teamA}
                                        onChange={setTeamA}
                                        placeholder="Enter Home Team"
                                        disabled={isLoading}
                                        className="w-full px-4 py-2 text-base bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors disabled:opacity-50"
                                    />
                                    <TeamInput
                                        value={teamB}
                                        onChange={setTeamB}
                                        placeholder="Enter Away Team"
                                        disabled={isLoading}
                                        className="w-full px-4 py-2 text-base bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors disabled:opacity-50"
                                    />
                                </div>
                                <CategoryToggle selectedCategory={matchCategory} onSelectCategory={setMatchCategory} />
                                <div className="pt-2">
                                    {!isLoading ? (
                                        <button
                                            onClick={handlePredict}
                                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-green-500/40 focus:outline-none focus:ring-4 focus:ring-green-500/50 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                                            disabled={!teamA || !teamB}
                                        >
                                            Get AI Prediction
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleStopOrReset}
                                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-4 focus:ring-red-500/50"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {isLoading && <Loader />}
                        
                        {(error || predictionResult) && !isLoading && (
                            <PredictionResult result={predictionResult} error={error} teamA={teamA} teamB={teamB} />
                        )}

                        <PredictionFeed tickets={history} />
                        
                        <TrackRecord history={history} />

                        <PredictionHistory tickets={history} onUpdateStatus={handleUpdatePredictionStatus} onSelectTicket={setSelectedTicket} onSync={handleSync} isSyncing={isSyncing} />

                    </div>
                    <div className="lg:col-span-1 space-y-8 mt-8 lg:mt-0">
                        <LiveScores disabled={appStatus === 'config_error'} />
                        <DonationBlock />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-300">
            <header className="py-4 shadow-md bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700">
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <FTLogoIcon className="h-10 w-10" />
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                            AI Football Tipster
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                         {syncMessage && (
                            <span className="hidden md:inline-block text-sm text-gray-600 dark:text-gray-400 font-medium animate-fade-in">{syncMessage}</span>
                         )}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                        >
                            {theme === 'light' ? <MoonIcon className="h-6 w-6" /> : <SunIcon className="h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </header>

            <main className="py-8">
               {renderAppContent()}
            </main>

            <TicketModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
        </div>
    );
};

export default App;