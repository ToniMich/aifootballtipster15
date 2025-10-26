import React from 'react';
import { ChartPieIcon, CheckCircleIcon, TicketIcon } from './icons';

interface AccuracyTrackerProps {
    total: number;
    wins: number;
}

const AccuracyTracker: React.FC<AccuracyTrackerProps> = ({ total, wins }) => {
    // Calculate accuracy, handling the case where total is 0 to avoid division by zero.
    const accuracy = total > 0 ? Math.round((wins / total) * 100) : 0;

    const StatItem: React.FC<{ icon: React.ReactNode, value: string | number, label: string }> = ({ icon, value, label }) => (
        <div className="flex flex-col items-center text-center gap-1" title={label}>
            {icon}
            <span className="text-lg font-bold">{value}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
                <ChartPieIcon className="h-7 w-7 text-green-600 dark:text-green-300" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">AI Accuracy</h3>
            </div>
            <div className="flex items-center justify-around gap-4 text-sm text-gray-700 dark:text-gray-300">
                <StatItem 
                    icon={<TicketIcon className="h-6 w-6 text-blue-500" />}
                    value={total}
                    label="Total"
                />
                <div className="h-10 w-px bg-gray-200 dark:bg-gray-600"></div>
                <StatItem 
                    icon={<CheckCircleIcon className="h-6 w-6 text-green-500" />}
                    value={wins}
                    label="Wins"
                />
                <div className="h-10 w-px bg-gray-200 dark:bg-gray-600"></div>
                <StatItem 
                    icon={<ChartPieIcon className="h-6 w-6 text-purple-500" />}
                    value={`${accuracy}%`}
                    label="Win Rate"
                />
            </div>
        </div>
    );
};

export default AccuracyTracker;