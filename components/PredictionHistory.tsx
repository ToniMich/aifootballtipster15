import React from 'react';
import { HistoryItem, AccuracyStats } from '../types';
import AccuracyTracker from './AccuracyTracker';
import TeamLogo from './TeamLogo';
import { RefreshIcon, TrashIcon, FootballIcon } from './icons';

interface PredictionHistoryProps {
    history: HistoryItem[];
    stats: AccuracyStats;
    onSync: () => void;
    isSyncing: boolean;
    onDelete: (id: string) => void;
    onViewDetails: (item: HistoryItem) => void;
    onViewTeamStats: (teamName: string) => void;
}

const StatusBadge: React.FC<{ status: HistoryItem['status'] }> = ({ status }) => {
    const statusMap = {
        won: { text: 'Won', color: 'bg-green-100 text-green-800 dark:bg-green-900/70 dark:text-green-300' },
        lost: { text: 'Lost', color: 'bg-red-100 text-red-800 dark:bg-red-900/70 dark:text-red-300' },
        pending: { text: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/70 dark:text-yellow-300' },
        processing: { text: 'Processing', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-300' },
        failed: { text: 'Failed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
    };

    const currentStatus = status ? statusMap[status] : null;
    if (!currentStatus) return null;

    return (
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${currentStatus.color}`}>
            {currentStatus.text}
        </span>
    );
};


const PredictionHistory: React.FC<PredictionHistoryProps> = ({ history, stats, onSync, isSyncing, onDelete, onViewDetails, onViewTeamStats }) => {
    return (
        <div className="w-full space-y-8">
            <AccuracyTracker total={stats.total} wins={stats.wins} isPersonalized={true} />

            <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg animate-fade-in">
                <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <FootballIcon className="h-7 w-7 text-green-600 dark:text-green-300" />
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">My Prediction History</h3>
                    </div>
                    <button
                        onClick={onSync}
                        disabled={isSyncing}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Check for match results to update pending predictions"
                    >
                        <RefreshIcon className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>{isSyncing ? 'Syncing...' : 'Sync Results'}</span>
                    </button>
                </div>
                
                {history.length === 0 ? (
                    <div className="p-10 text-center text-gray-500 dark:text-gray-400">
                        <p>You haven't made any predictions yet.</p>
                        <p className="text-sm">Use the predictor above to build your history!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {history.map(item => (
                            <div key={item.id} className="p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                                    <div className="md:col-span-2">
                                        <div className="flex items-center gap-3">
                                            <TeamLogo logoUrl={item.teamA_logo} teamName={item.teamA} sizeClass="h-8 w-8" />
                                            <span 
                                                className="font-bold cursor-pointer hover:underline"
                                                onClick={() => onViewTeamStats(item.teamA)}
                                            >
                                                {item.teamA}
                                            </span>
                                            <span className="text-gray-400">vs</span>
                                            <span 
                                                className="font-bold cursor-pointer hover:underline"
                                                onClick={() => onViewTeamStats(item.teamB)}
                                            >
                                                {item.teamB}
                                            </span>
                                            <TeamLogo logoUrl={item.teamB_logo} teamName={item.teamB} sizeClass="h-8 w-8" />
                                        </div>
                                        <p className="text-sm text-green-600 dark:text-green-400 font-semibold mt-1 truncate" title={item.prediction}>{item.prediction}</p>
                                    </div>
                                    <div className="flex items-center gap-4 justify-start md:justify-center">
                                        <StatusBadge status={item.status} />
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(item.timestamp).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-2 justify-start md:justify-end">
                                        <button 
                                            onClick={() => onViewDetails(item)}
                                            className="px-3 py-1.5 text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                                        >
                                            View Analysis
                                        </button>
                                        <button 
                                            onClick={() => onDelete(item.id)}
                                            className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                            aria-label="Delete prediction"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PredictionHistory;