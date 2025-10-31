import React, { useState, useEffect, useCallback } from 'react';
import { HistoryItem, BestBet, UserBet } from '../types';
import { saveUserBet, getUserBetForPrediction } from '../services/supabaseService';
import { TicketIcon, CheckCircleIcon } from './icons';

interface UserBettingPanelProps {
    prediction: HistoryItem;
}

const UserBettingPanel: React.FC<UserBettingPanelProps> = ({ prediction }) => {
    const [selectedBet, setSelectedBet] = useState<BestBet | null>(null);
    const [savedBet, setSavedBet] = useState<UserBet | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isMatchFinished = prediction.status === 'won' || prediction.status === 'lost';

    const fetchSavedBet = useCallback(async () => {
        const userBet = await getUserBetForPrediction(prediction.id);
        setSavedBet(userBet);
    }, [prediction.id]);

    useEffect(() => {
        fetchSavedBet();
    }, [fetchSavedBet]);

    const handleSaveBet = async () => {
        if (!selectedBet) return;
        setIsSaving(true);
        setError(null);
        try {
            const saved = await saveUserBet(prediction.id, selectedBet);
            setSavedBet(saved);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save bet.");
        } finally {
            setIsSaving(false);
        }
    };

    const renderBetItem = (bet: BestBet) => {
        const betIdentifier = `${bet.category}-${bet.value}`;
        const isSelected = selectedBet ? `${selectedBet.category}-${selectedBet.value}` === betIdentifier : false;
        const isSaved = savedBet?.chosen_bet_category === bet.category && savedBet?.chosen_bet_value === bet.value;

        let statusIndicator;
        if (isMatchFinished) {
            if (bet.betStatus === 'won') {
                statusIndicator = <span className="text-xs font-bold text-green-500">WIN</span>;
            } else if (bet.betStatus === 'lost') {
                statusIndicator = <span className="text-xs font-bold text-red-500">LOSS</span>;
            }
        }

        return (
            <div
                key={betIdentifier}
                className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                    isSelected ? 'border-green-500 bg-green-50 dark:bg-green-900/40' : 'border-transparent bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                onClick={() => !isMatchFinished && !savedBet && setSelectedBet(bet)}
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{bet.value}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{bet.category}</p>
                    </div>
                    <div className="text-right">
                        {isSaved && <span className="text-xs font-bold text-blue-500 dark:text-blue-400">YOUR PICK</span>}
                        {statusIndicator}
                    </div>
                </div>
            </div>
        );
    };

    if (!prediction.bestBets || prediction.bestBets.length === 0) return null;

    return (
        <section>
            <div className="flex items-center gap-3 mb-4">
                <TicketIcon className="h-7 w-7 text-green-600 dark:text-green-300" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">My Bet Slip</h3>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {isMatchFinished 
                        ? "Here's the breakdown of the AI's suggestions and how your chosen bet performed."
                        : savedBet 
                        ? "Your bet is locked in! Check back after the match to see the result."
                        : "Select one of the AI's best bets below to track its performance."}
                </p>
                <div className="space-y-2">
                    {prediction.bestBets.map(renderBetItem)}
                </div>

                {!isMatchFinished && !savedBet && (
                    <div className="pt-2">
                        <button
                            onClick={handleSaveBet}
                            disabled={!selectedBet || isSaving}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {isSaving ? 'Saving...' : 'Save My Bet'}
                        </button>
                        {error && <p className="text-xs text-red-500 mt-2 text-center">{error}</p>}
                    </div>
                )}
                
                {isMatchFinished && savedBet && (
                    <div className="pt-2 text-center">
                        {prediction.bestBets.find(b => b.category === savedBet.chosen_bet_category && b.value === savedBet.chosen_bet_value)?.betStatus === 'won' ? (
                             <p className="font-bold text-lg text-green-600 dark:text-green-400">Your bet was a winner!</p>
                        ) : (
                             <p className="font-bold text-lg text-red-600 dark:text-red-400">Your bet did not win.</p>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
};

export default UserBettingPanel;
