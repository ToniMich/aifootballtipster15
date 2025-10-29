import React, { useState, useCallback, useEffect, useRef } from 'react';
import { startPredictionJob, getPredictionResult, getPredictionDirectlyFromGemini } from './services/geminiService';
import { HistoryItem } from './types';
import { initializeSupabaseClient, isAppConfigured, mapPredictionToHistoryItem } from './services/supabaseService';
import { getTheme, setTheme as saveTheme } from './services/localStorageService';
import Loader from './components/Loader';
import PredictionResult from './components/PredictionResult';
import { FTLogoIcon, SunIcon, MoonIcon } from './components/icons';
import TeamInput from './components/TeamInput';
import DonationBlock from './components/DonationBlock';
import CategoryToggle from './components/CategoryToggle';
import Footer from './components/Footer';
import LiveScores from './components/LiveScores';

const App: React.FC = () => {
    const [teamA, setTeamA] = useState<string>('');
    const [teamB, setTeamB] = useState<string>('');
    const [predictionResult, setPredictionResult] = useState<HistoryItem | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [appStatus, setAppStatus] = useState<'initializing' | 'ready' | 'failed'>('initializing');
    const [initError, setInitError] = useState<string | null>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>(getTheme());
    const [matchCategory, setMatchCategory] = useState<'men' | 'women'>('men');
    const pollingIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        const initializeApp = async () => {
            try {
                // Initialize Supabase. This is still needed for the Live Scores feature.
                await initializeSupabaseClient();
                
                if (isAppConfigured()) {
                    setAppStatus('ready');
                } else {
                    // If not configured, set a non-blocking notice for features that need it.
                    setInitError("Application backend is not configured. Live scores will be unavailable.");
                    setAppStatus('failed');
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during initialization.';
                console.error("Application initialization failed:", errorMessage);
                setInitError(errorMessage);
                setAppStatus('failed');
            }
        };

        initializeApp();
    }, []);

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
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        setIsLoading(false);
        setError(null);
        setPredictionResult(null);
        setTeamA('');
        setTeamB('');
    };

    const pollForPrediction = (jobId: string) => {
        const pollInterval = 3000; // 3 seconds
        const maxAttempts = 20;   // 20 attempts * 3s = 60s timeout
        let attempt = 0;
    
        const poll = window.setInterval(async () => {
            if (attempt >= maxAttempts) {
                clearInterval(poll);
                pollingIntervalRef.current = null;
                setError("The prediction is taking longer than expected. The AI might be busy. Please try again in a moment.");
                setIsLoading(false);
                return;
            }
    
            try {
                const result = await getPredictionResult(jobId);
                
                if (result && result.status !== 'processing') {
                    clearInterval(poll);
                    pollingIntervalRef.current = null;
                    
                    if (result.status === 'failed') {
                        const errorMessage = result.prediction_data?.error || "The AI failed to generate a prediction for this match.";
                        setError(errorMessage);
                    } else {
                        const historyItem = mapPredictionToHistoryItem(result);
                        setPredictionResult(historyItem);
                    }
                    setIsLoading(false);
                }
            } catch (err) {
                clearInterval(poll);
                pollingIntervalRef.current = null;
                const errorMessage = err instanceof Error ? err.message : "An error occurred while fetching the result.";
                setError(errorMessage);
                setIsLoading(false);
            }
    
            attempt++;
        }, pollInterval);
    
        pollingIntervalRef.current = poll;
    };

    const handlePredict = useCallback(async () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        setIsLoading(true);
        setError(null);
        setPredictionResult(null);
    
        const trimmedA = teamA.trim();
        const trimmedB = teamB.trim();
        
        try {
            // --- Validation Block ---
            const validTeamNameRegex = /^[\p{L}0-9\s.'&()-]+$/u;
            if (!trimmedA || !trimmedB) { throw new Error('Please enter names for both teams.'); }
            if (trimmedA.length < 2 || trimmedA.length > 50 || trimmedB.length < 2 || trimmedB.length > 50) { throw new Error('Team names must be between 2 and 50 characters long.'); }
            if (!validTeamNameRegex.test(trimmedA) || !validTeamNameRegex.test(trimmedB)) { throw new Error("Team names can only include letters, numbers, spaces, and .'-&()"); }
            if (trimmedA.toLowerCase() === trimmedB.toLowerCase()) { throw new Error('Please enter two different team names.'); }

            // --- PRIMARY PATH: Use backend job ---
            console.log(`[AIFootballTipster] Requesting prediction for: ${trimmedA} vs ${trimmedB}`);
            const response = await startPredictionJob(trimmedA, trimmedB, matchCategory);

            if (response.isCached) {
                console.log("[AIFootballTipster] Prediction found in cache.");
                const historyItem = mapPredictionToHistoryItem(response.data);
                setPredictionResult(historyItem);
                setIsLoading(false);
            } else {
                console.log(`[AIFootballTipster] Prediction job started with ID: ${response.data.jobId}`);
                pollForPrediction(response.data.jobId);
            }
        } catch (err) {
            const initialError = err instanceof Error ? err.message : "An unknown error occurred.";
            
            // Check if it's a validation error. If so, display it and stop.
            const isValidationError = ['Please enter names', 'must be between', 'can only include', 'different team names'].some(phrase => initialError.includes(phrase));

            if (isValidationError) {
                setError(initialError);
                setIsLoading(false);
                return;
            }

            // If not a validation error, assume it's a backend issue and try the fallback.
            console.warn(`[AIFootballTipster] Backend prediction failed or is unavailable, falling back to direct Gemini call. Reason: ${initialError}`);
            
            try {
                console.log(`[AIFootballTipster] Starting direct prediction for: ${trimmedA} vs ${trimmedB}`);
                const directResult = await getPredictionDirectlyFromGemini(trimmedA, trimmedB, matchCategory);
                setPredictionResult(directResult);
                setIsLoading(false);
            } catch (geminiErr) {
                const errorMessage = geminiErr instanceof Error ? geminiErr.message : "An unknown error occurred during AI analysis.";
                console.error(`[AIFootballTipster] Direct Gemini prediction failed: ${errorMessage}`);
                setError(errorMessage);
                setIsLoading(false);
            }
        }
    }, [teamA, teamB, matchCategory]);
    
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
                                <PredictionResult result={predictionResult} error={error} teamA={teamA} teamB={teamB} />
                             </div>
                        )}

                    </div>

                    {/* Right column: Live Scores and Sidebar */}
                    <div className="space-y-8 lg:col-span-1">
                        <div className="lg:sticky lg:top-28 space-y-8">
                            <LiveScores disabled={appStatus !== 'ready'} />
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
            
            <Footer />
        </div>
    );
};

export default App;