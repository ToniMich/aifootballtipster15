import React, { useState, useCallback, useEffect, useRef } from 'react';
import { startPredictionJob, getPredictionResult } from './services/geminiService';
import { HistoryItem, TeamPerformanceStats } from './types';
import { initializeSupabaseClient, getPredictionHistory, getAccuracyStats, updatePredictionStatus } from './services/supabaseService';
import { getTheme, setTheme as saveTheme } from './services/localStorageService';
import { syncPredictionStatuses } from './services/syncService';
import Loader from './components/Loader';
import PredictionResult from './components/PredictionResult';
import { FTLogoIcon, SunIcon, MoonIcon } from './components/icons';
import TeamInput from './components/TeamInput';
import DonationBlock from './components/DonationBlock';
import CategoryToggle from './components/CategoryToggle';
import PredictionHistory from './components/PredictionHistory';
import PredictionFeed from './components/PredictionFeed';
import TicketModal from './components/TicketModal';
import TrackRecord from './components/TrackRecord';
import Footer from './components/Footer';
import HeaderAccuracyTracker from './components/HeaderAccuracyTracker';
import LiveScores from './components/LiveScores';

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
    const [appStatus, setAppStatus] = useState<'initializing' | 'ready' | 'failed'>('initializing');
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [accuracyStats, setAccuracyStats] = useState<AccuracyStats>({ total: 0, wins: 0 });
    const [theme, setTheme] = useState<'light' | 'dark'>(getTheme());
    const [matchCategory, setMatchCategory] = useState<'men' | 'women'>('men');
    const [selectedTicket, setSelectedTicket] = useState<HistoryItem | null>(null);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [teamPerformanceStats, setTeamPerformanceStats] = useState<{ teamA: TeamPerformanceStats; teamB: TeamPerformanceStats } | null>(null);

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
                await initializeSupabaseClient();
                await refreshData();
                setAppStatus('ready');
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Initialization failed.';
                console.error("Application initialization failed:", errorMessage);
                // Set status to failed, but we won't show a blocking UI error.
                // The app will render, but some features might be disabled.
                setAppStatus('failed');
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
    
    useEffect(() => {
        if (predictionResult && history.length > 0) {
            const calculateStatsForTeam = (teamName: string): TeamPerformanceStats => {
                const teamHistory = history.filter(item => 
                    (item.teamA === teamName || item.teamB === teamName) && (item.status === 'won' || item.status === 'lost')
                );
                
                const wins = teamHistory.filter(item => item.status === 'won').length;
                
                const recentOutcomes = teamHistory.slice(0, 5).map(item => item.status);
    
                return {
                    total: teamHistory.length,
                    wins: wins,
                    recentOutcomes: recentOutcomes
                };
            };
    
            setTeamPerformanceStats({
                teamA: calculateStatsForTeam(predictionResult.teamA),
                teamB: calculateStatsForTeam(predictionResult.teamB),
            });
        } else {
            setTeamPerformanceStats(null);
        }
    }, [predictionResult, history]);

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
        try {
            await syncPredictionStatuses();
            await refreshData();
        } catch (err) {
            console.error("Sync failed:", err);
        } finally {
            setIsSyncing(false);
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
        
        return (
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Left column: Predictor and History */}
                    <div className="space-y-8 lg:col-span-3">
                        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-6 sm:p-8 animate-fade-in-down">
                            <h2 className="text-center text-3xl font-bold text-gray-900 dark:text-white mb-2">
                                The Predictor
                            </h2>
                            <p className="text-center text-gray-600 dark:text-gray-400 mb-6">Enter two teams to get an AI-powered match analysis.</p>
                            
                            <div className="space-y-4">
                                <CategoryToggle selectedCategory={matchCategory} onSelectCategory={setMatchCategory} />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="teamA-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Home Team</label>
                                        <TeamInput
                                            id="teamA-input"
                                            value={teamA}
                                            onChange={setTeamA}
                                            placeholder="e.g., Manchester United"
                                            disabled={isLoading}
                                            className="w-full px-4 py-2 text-base bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors disabled:opacity-50"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="teamB-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Away Team</label>
                                        <TeamInput
                                            id="teamB-input"
                                            value={teamB}
                                            onChange={setTeamB}
                                            placeholder="e.g., Liverpool"
                                            disabled={isLoading}
                                            className="w-full px-4 py-2 text-base bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors disabled:opacity-50"
                                        />
                                    </div>
                                </div>
                                
                                <div className="pt-2">
                                    {isLoading ? (
                                        <div className="flex items-center gap-4">
                                            <button
                                                disabled
                                                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg opacity-50 cursor-not-allowed"
                                            >
                                                Getting Prediction...
                                            </button>
                                            <button
                                                onClick={handleStopOrReset}
                                                className="flex-shrink-0 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-4 focus:ring-red-500/50"
                                            >
                                                Stop
                                            </button>
                                        </div>
                                    ) : predictionResult || error ? (
                                        <button
                                            onClick={handleStopOrReset}
                                            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg focus:outline-none focus:ring-4 focus:ring-gray-500/50"
                                        >
                                            Start New Prediction
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handlePredict}
                                            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-green-500/40 focus:outline-none focus:ring-4 focus:ring-green-500/50 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                                            disabled={!teamA || !teamB}
                                        >
                                            Get AI Prediction
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {isLoading && <Loader />}
                        
                        {(error || predictionResult) && !isLoading && (
                             <div className="animate-fade-in-down">
                                <PredictionResult result={predictionResult} error={error} teamA={teamA} teamB={teamB} teamPerformanceStats={teamPerformanceStats} />
                             </div>
                        )}

                        <PredictionFeed tickets={history} />
                        <TrackRecord history={history} />
                        <PredictionHistory tickets={history} onUpdateStatus={handleUpdatePredictionStatus} onSelectTicket={setSelectedTicket} onSync={handleSync} isSyncing={isSyncing} />
                    </div>

                    {/* Right column: Live Scores and Sidebar */}
                    <div className="space-y-8 lg:col-span-1">
                        <div className="lg:sticky lg:top-28 space-y-8">
                            <LiveScores disabled={appStatus === 'failed'} />
                            <DonationBlock />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-300 flex flex-col">
            <header className="py-4 shadow-md bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700">
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <FTLogoIcon className="h-10 w-10" />
                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                                AI Football Tipster
                            </h1>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4">
                            <HeaderAccuracyTracker total={accuracyStats.total} wins={accuracyStats.wins} />
                            <div className="h-6 w-px bg-gray-200 dark:bg-gray-600 hidden sm:block"></div>
                            <button
                                onClick={toggleTheme}
                                className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                            >
                                {theme === 'light' ? <MoonIcon className="h-6 w-6" /> : <SunIcon className="h-6 w-6" />}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="py-8 sm:py-10 flex-grow">
               {renderAppContent()}
            </main>

            <TicketModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
            <Footer />
        </div>
    );
};

export default App;