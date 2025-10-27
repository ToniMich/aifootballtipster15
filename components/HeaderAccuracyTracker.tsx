import React from 'react';
import { ChartPieIcon } from './icons';

interface HeaderAccuracyTrackerProps {
    total: number;
    wins: number;
}

const HeaderAccuracyTracker: React.FC<HeaderAccuracyTrackerProps> = ({ total, wins }) => {
    const accuracy = total > 0 ? Math.round((wins / total) * 100) : 0;

    if (total === 0) {
        return null;
    }

    return (
        <div 
            className="hidden sm:flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-help"
            title={`AI has correctly predicted ${wins} out of ${total} completed matches.`}
        >
            <ChartPieIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div className="text-left">
                <span className="font-bold">{accuracy}%</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 leading-tight">{wins}/{total} Wins</span>
            </div>
        </div>
    );
};

export default HeaderAccuracyTracker;
