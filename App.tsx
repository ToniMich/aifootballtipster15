// Fix: Add a triple-slash directive to include the DOM library, which defines global browser APIs like 'document', 'window', 'setInterval', etc.
/// <reference lib="dom" />

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { startPredictionJob, getPredictionResult } from './services/geminiService';
import { HistoryItem, AccuracyStats } from './types';
import { initializeSupabaseClient, isAppConfigured, getPredictionHistory, getAccuracyStats, deletePrediction, getSession, onAuthStateChange, signOut, getSupabaseClient } from './services/supabaseService';
import { syncPredictionStatuses } from './services/syncService';
import { getTheme, setTheme as saveTheme } from './services/localStorageService';
import Loader from './components/Loader';
import PredictionResult from './components/PredictionResult';
import { FTLogoIcon, SunIcon, MoonIcon } from './components/icons';
import TeamInput from './components/TeamInput';
import DonationBlock from './components/DonationBlock';
import CategoryToggle from './components/CategoryToggle';
import Footer from './components/Footer';
import PredictionHistory from './components/PredictionHistory';
import HeaderAccuracyTracker from './components/HeaderAccuracyTracker';
import LiveScores from './components/LiveScores';
import TeamPerformanceTracker from './components/TeamPerformanceTracker';
import AuthModal from './components/AuthModal';
import type { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
    const [teamA, setTeamA] = useState<string>('');
    const [teamB, setTeamB] = useState<string>('');
    const [predictionResult, setPredictionResult] = useState<HistoryItem | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [appStatus, setAppStatus] = useState<'initializing' | 'ready'>('initializing');
    const [isConfigured, setIsConfigured] = useState<boolean>(false);
    const [theme, setTheme] = useState<'light' | 'dark'>(getTheme());
    const [matchCategory, setMatchCategory] = useState<'men' | 'women'>('men');
    const [jobId, setJobId] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [accuracyStats, setAccuracyStats] = useState<AccuracyStats>({ total: 0, wins: 0 });
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);
    const [selectedTeamForStats, setSelectedTeamForStats] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [session, setSession] = useState<Session | null>(null);
    const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

    const pollIntervalId = useRef<number | null>(null);
    const pollTimeoutId = useRef<number | null>(null);

     const fetchHistoryAndStats = useCallback(async () => {
        if (!isAppConfigured()) return;
        try {
            const [historyData, statsData] = await Promise.all([getPredictionHistory(), getAccuracyStats()]);
            setHistory(historyData);
            setAccuracyStats(statsData);
        } catch (err) {
            console.error("Failed to fetch history or stats:", err);
        }
    }, []);

    useEffect(() => {
        let authSubscription: { unsubscribe: () => void; } | null = null;

        const initializeApp = async () => {
            try {
                await initializeSupabaseClient();
                const configured = isAppConfigured();
                setIsConfigured(configured);
                
                if (configured) {
                    const currentSession = await getSession();
                    setSession(currentSession);
                    
                    if (currentSession) {
                        await fetchHistoryAndStats();
                    }

                    const { subscription } = onAuthStateChange((_event, session) => {
                        setSession(session);
                        if (session) {
                            fetchHistoryAndStats();
                            setShowAuthModal(false); // Close modal on successful login/signup
                        } else {
                            setHistory([]);
                            setAccuracyStats({ total: 0, wins: 0 });
                        }
                    });
                    authSubscription = subscription;

                } else {
                     console.warn("Application backend is not configured. Features like predictions and live scores will be unavailable.");
                }
            } catch (err) {
                console.error("Application initialization failed:", err);
                setIsConfigured(false);
            } finally {
                setAppStatus('ready');
            }
        };

        initializeApp();

        return () => {
            authSubscription?.unsubscribe();
        };

    }, [fetchHistoryAndStats]);

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
    
    const clearPolling = useCallback(() => {
        if (pollIntervalId.current) {
            clearInterval(pollIntervalId.current);
            pollIntervalId.current = null;
        }
        if (pollTimeoutId.current) {
            clearTimeout(pollTimeoutId.current);
            pollTimeoutId.current = null;
        }
    }, []);

    const handleStopOrReset = () => {
        setIsLoading(false);
        setError(null);
        setPredictionResult(null);
        setTeamA('');
        setTeamB('');
        setJobId(null);
        clearPolling();
    };

    const pollForPrediction = useCallback((id: string) => {
        console.log(`[DEBUG] App.pollForPrediction: Starting polling process for job ID: ${id}`);
        const POLLING_INTERVAL = 4000; // 4 seconds
        const POLLING_TIMEOUT = 60000; // 60 seconds

        clearPolling(); // Ensure no other polls are running

        pollIntervalId.current = window.setInterval(async () => {
            console.log(`[DEBUG] App.pollForPrediction: Polling attempt for job ID: ${id}...`);
            try {
                const result = await getPredictionResult(id);
                console.log(`[DEBUG] App.pollForPrediction: Poll successful for job ID ${id}. Current status: ${result.status}`);

                if (result.status && result.status !== 'processing') {
                    console.log(`[DEBUG] App.pollForPrediction: Job ${id} is complete with status '${result.status}'. Stopping poll.`);
                    clearPolling();
                    if (result.status === 'failed') {
                        const errorMessage = result.error || 'The AI failed to generate a prediction for this match.';
                        console.error(`[DEBUG] App.pollForPrediction: Job ${id} failed. Error: ${errorMessage}`);
                        setError(errorMessage);
                    } else {
                        setPredictionResult(result);
                        fetchHistoryAndStats(); // Refresh history and stats after a successful prediction
                    }
                    setIsLoading(false);
                }
            } catch (err) {
                console.error(`[DEBUG] App.pollForPrediction: Polling for job ${id} caught an error. Stopping poll.`, err);
                clearPolling();
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while polling for results.';
                setError(errorMessage);
                setIsLoading(false);
            }
        }, POLLING_INTERVAL);

        pollTimeoutId.current = window.setTimeout(() => {
            console.warn(`[DEBUG] App.pollForPrediction: Polling for job ${id} timed out after ${POLLING_TIMEOUT / 1000} seconds. Stopping poll.`);
            clearPolling();
            setError('The prediction is taking longer than expected. The service might be busy. Please try again in a moment.');
            setIsLoading(false);
        }, POLLING_TIMEOUT);
    }, [clearPolling, fetchHistoryAndStats]);


    const handlePredict = useCallback(async () => {
        if (!session) {
            setShowAuthModal(true);
            return;
        }

        console.log('[DEBUG] App.handlePredict: "Get AI Prediction" button clicked.');
        setIsLoading(true);
        setError(null);
        setPredictionResult(null);
        setJobId(null);
    
        const trimmedA = teamA.trim();
        const trimmedB = teamB.trim();
        
        try {
            console.log('[DEBUG] App.handlePredict: Validating inputs...');
            // --- Validation Block ---
            const validTeamNameRegex = /^[\p{L}0-9\s.'&()-]+$/u;
            if (!trimmedA || !trimmedB) { throw new Error('Please enter names for both teams.'); }
            if (trimmedA.length < 2 || trimmedA.length > 50 || trimmedB.length < 2 || trimmedB.length > 50) { throw new Error('Team names must be between 2 and 50 characters long.'); }
            if (!validTeamNameRegex.test(trimmedA) || !validTeamNameRegex.test(trimmedB)) { throw new Error("Team names can only include letters, numbers, spaces, and .'-&()"); }
            if (trimmedA.toLowerCase() === trimmedB.toLowerCase()) { throw new Error('Please enter two different team names.'); }

            console.log('[DEBUG] App.handlePredict: Validation passed. Calling startPredictionJob...');
            const response = await startPredictionJob(trimmedA, trimmedB, matchCategory);
            console.log('[DEBUG] App.handlePredict: Response from startPredictionJob:', response);

            if (response.isCached) {
                console.log("[DEBUG] App.handlePredict: Cached prediction found, displaying immediately.");
                setPredictionResult(response.data as HistoryItem);
                fetchHistoryAndStats(); // Refresh history to show updated tally
                setIsLoading(false);
            } else {
                const { jobId: newJobId } = response.data as { jobId: string };
                console.log(`[DEBUG] App.handlePredict: Started new prediction job: ${newJobId}. Starting to poll.`);
                setJobId(newJobId);
                pollForPrediction(newJobId);
            }
            
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during AI analysis.";
            console.error(`[DEBUG] App.handlePredict: Caught an error during prediction request.`, err);
            // Handle specific error for usage limit
            if (errorMessage.includes("Usage limit reached")) {
                setError("You've reached your monthly prediction limit. Please upgrade to Pro for unlimited predictions.");
                // Here you could trigger an upgrade modal
            } else {
                setError(errorMessage);
            }
            setIsLoading(false);
        }
    }, [teamA, teamB, matchCategory, pollForPrediction, fetchHistoryAndStats, session]);
    
    const handleForceRefresh = useCallback(async (teamA: string, teamB: string, category: 'men' | 'women') => {
        if (!session) {
            setShowAuthModal(true);
            return;
        }

        console.log(`[DEBUG] App.handleForceRefresh: Forcing refresh for ${teamA} vs ${teamB}`);
        setIsLoading(true);
        setError(null);
        setPredictionResult(null);
        setJobId(null);
        if (selectedHistoryItem) setSelectedHistoryItem(null); // Close modal if open

        // Update main state so the UI reflects the teams being processed
        setTeamA(teamA);
        setTeamB(teamB);
        setMatchCategory(category);

        try {
            // Call startPredictionJob with the forceRefresh flag set to true
            const response = await startPredictionJob(teamA, teamB, category, true);
            console.log('[DEBUG] App.handleForceRefresh: Response from startPredictionJob:', response);

            if (response.isCached) {
                console.warn("[DEBUG] App.handleForceRefresh: Received cached result despite forcing refresh. This should not happen. Displaying it anyway.");
                setPredictionResult(response.data as HistoryItem);
                setIsLoading(false);
            } else {
                const { jobId: newJobId } = response.data as { jobId: string };
                console.log(`[DEBUG] App.handleForceRefresh: Started new job: ${newJobId}. Polling.`);
                setJobId(newJobId);
                pollForPrediction(newJobId);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during the refresh request.";
            console.error(`[DEBUG] App.handleForceRefresh: Caught an error.`, err);
            setError(errorMessage);
            setIsLoading(false);
        }
    }, [pollForPrediction, selectedHistoryItem, session]);

    const handleSyncResults = useCallback(async () => {
        setIsSyncing(true);
        try {
            await syncPredictionStatuses();
            await fetchHistoryAndStats();
        } catch (err) {
            console.error("Sync failed:", err);
            // Optionally, show an error to the user
        } finally {
            setIsSyncing(false);
        }
    }, [fetchHistoryAndStats]);

    const handleDeletePrediction = useCallback(async (id: string) => {
        if (window.confirm("Are you sure you want to delete this prediction from your history?")) {
            try {
                await deletePrediction(id);
                await fetchHistoryAndStats();
                 if (predictionResult?.id === id) {
                    setPredictionResult(null);
                }
            } catch (err) {
                console.error("Delete failed:", err);
            }
        }
    }, [fetchHistoryAndStats, predictionResult]);

    // Cleanup effect to stop polling if the component unmounts
    useEffect(() => {
        return () => clearPolling();
    }, [clearPolling]);
    
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
                    {/* Left column: Predictor */}
                    <div className="space-y-8 lg:col-span-3">
                        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-6 sm:p-8 animate-fade-in-down">
                            <h2 className="text-center text-3xl font-bold text-gray-900 dark:text-white mb-6">
                                The Predictor
                            </h2>
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
                                            title={!session ? "Login to get your FREE prediction" : "Get AI Prediction"}
                                        >
                                            {!session ? 'Login to Get FREE Prediction' : 'Get AI Prediction'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {isLoading && <Loader />}
                        
                        {(error || predictionResult) && !isLoading && (
                             <div className="animate-fade-in-down">
                                <PredictionResult 
                                    result={predictionResult} 
                                    error={error} 
                                    teamA={teamA} 
                                    teamB={teamB}
                                    onViewTeamStats={setSelectedTeamForStats}
                                    onForceRefresh={handleForceRefresh}
                                    session={session}
                                    onUpgrade={() => setShowAuthModal(true)}
                                />
                             </div>
                        )}
                        
                        {session && (
                            <PredictionHistory
                                history={history}
                                stats={accuracyStats}
                                onSync={handleSyncResults}
                                isSyncing={isSyncing}
                                onDelete={handleDeletePrediction}
                                onViewDetails={setSelectedHistoryItem}
                                onViewTeamStats={setSelectedTeamForStats}
                            />
                        )}

                    </div>

                    {/* Right column: Sidebar */}
                    <div className="space-y-8 lg:col-span-1">
                        <div className="lg:sticky lg:top-28 space-y-8">
                             <LiveScores />
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
                            {session && <HeaderAccuracyTracker total={accuracyStats.total} wins={accuracyStats.wins} />}
                            {session ? (
                                <button onClick={() => signOut()} className="px-4 py-2 text-sm font-semibold bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                    Logout
                                </button>
                            ) : (
                                <button onClick={() => setShowAuthModal(true)} className="px-4 py-2 text-sm font-semibold bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">
                                    Login / Sign Up
                                </button>
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
                </div>
            </header>

            <main className="py-8 sm:py-10 flex-grow">
               {renderAppContent()}
            </main>
            
            {selectedHistoryItem && (
                <div 
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-start p-4 overflow-y-auto"
                    onClick={() => setSelectedHistoryItem(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="prediction-details-title"
                >
                    <div 
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl my-8 animate-fade-in-down"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <PredictionResult 
                            result={selectedHistoryItem} 
                            error={null} 
                            teamA={selectedHistoryItem.teamA} 
                            teamB={selectedHistoryItem.teamB}
                            onViewTeamStats={setSelectedTeamForStats}
                            onForceRefresh={handleForceRefresh}
                            session={session}
                            onUpgrade={() => setShowAuthModal(true)}
                        />
                    </div>
                </div>
            )}

            {selectedTeamForStats && (
                <div 
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4"
                    onClick={() => setSelectedTeamForStats(null)}
                    role="dialog"
                    aria-modal="true"
                >
                    <div 
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md my-8 animate-fade-in-down"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <TeamPerformanceTracker teamName={selectedTeamForStats} onClose={() => setSelectedTeamForStats(null)} />
                    </div>
                </div>
            )}
            
            {showAuthModal && isConfigured && <AuthModal supabaseClient={getSupabaseClient()} onClose={() => setShowAuthModal(false)} />}

            <Footer />
        </div>
    );
};

export default App;