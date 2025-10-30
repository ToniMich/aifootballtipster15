import React, { useState, useEffect } from 'react';
import { getTeamPerformanceStats } from '../services/supabaseService';
import { TeamPerformanceStats, HistoryItem } from '../types';
import { XMarkIcon, FootballIcon, CheckCircleIcon, TicketIcon, ChartPieIcon } from './icons';

interface TeamPerformanceTrackerProps {
    teamName: string;
    onClose: () => void;
}

const TeamPerformanceTracker: React.FC<TeamPerformanceTrackerProps> = ({ teamName, onClose }) => {
    const [stats, setStats] = useState<TeamPerformanceStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            if (!teamName) return;
            setIsLoading(true);
            setError(null);
            try {
                const fetchedStats = await getTeamPerformanceStats(teamName);
                setStats(fetchedStats);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load team stats.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, [teamName]);

    const getOutcomeColor = (result: HistoryItem['status']) => {
        switch (result) {
            case 'won': return 'bg-green-500';
            case 'lost': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };
    
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center h-48">
                    <FootballIcon className="animate-spin h-12 w-12 text-green-500 dark:text-green-400" />
                </div>
            );
        }

        if (error) {
            return <div className="p-6 text-center text-red-600 dark:text-red-400">{error}</div>;
        }

        if (!stats || stats.total === 0) {
            return <div className="p-6 text-center text-gray-500 dark:text-gray-400">No completed prediction data available for this team yet.</div>;
        }

        const winRate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;
        
        return (
            <div className="p-6 space-y-4">
                <div className="flex justify-around text-center">
                    <div title="Total Predictions Involving This Team">
                        <TicketIcon className="h-7 w-7 text-blue-500 mx-auto mb-1" />
                        <p className="text-2xl font-bold">{stats.total}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                    </div>
                    <div title="Correct Predictions for This Team">
                        <CheckCircleIcon className="h-7 w-7 text-green-500 mx-auto mb-1" />
                        <p className="text-2xl font-bold">{stats.wins}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Wins</p>
                    </div>
                    <div title="Win Rate for Predictions Involving This Team">
                        <ChartPieIcon className="h-7 w-7 text-purple-500 mx-auto mb-1" />
                        <p className="text-2xl font-bold">{winRate}%</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Win Rate</p>
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-semibold text-center text-gray-600 dark:text-gray-400 mb-2">Recent Outcomes</h4>
                    <div className="flex justify-center gap-2">
                        {stats.recentOutcomes.map((outcome, index) => (
                             <div 
                                key={index} 
                                className={`h-5 w-8 rounded-md flex items-center justify-center text-white font-bold text-xs shadow-sm ${getOutcomeColor(outcome)}`}
                                title={outcome === 'won' ? 'Won' : 'Lost'}
                            >
                                {outcome === 'won' ? 'W' : 'L'}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div>
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate" title={teamName}>
                    Performance: {teamName}
                </h3>
                <button 
                    onClick={onClose}
                    className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                    aria-label="Close"
                >
                    <XMarkIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                </button>
            </div>
            {renderContent()}
        </div>
    );
};

export default TeamPerformanceTracker;