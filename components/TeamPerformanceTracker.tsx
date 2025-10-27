import React from 'react';
import { TeamPerformanceStats, HistoryItem } from '../types';
import { ChartPieIcon, CheckCircleIcon, XMarkIcon } from './icons';
import TeamLogo from './TeamLogo';

interface TeamPerformanceTrackerProps {
    teamA: string;
    teamB: string;
    statsA: TeamPerformanceStats;
    statsB: TeamPerformanceStats;
    logoA?: string;
    logoB?: string;
}

const PerformanceStat: React.FC<{ label: string; value: string | number; }> = ({ label, value }) => (
    <div className="text-center">
        <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{value}</p>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
    </div>
);

const RecentOutcomeIcon: React.FC<{ status: HistoryItem['status'] }> = ({ status }) => {
    if (status === 'won') {
        return <CheckCircleIcon className="h-5 w-5 text-green-500" title="Correct Prediction" />;
    }
    if (status === 'lost') {
        return <XMarkIcon className="h-5 w-5 text-red-500" title="Incorrect Prediction" />;
    }
    return null;
};

const TeamCard: React.FC<{ teamName: string; teamLogo?: string; stats: TeamPerformanceStats }> = ({ teamName, teamLogo, stats }) => {
    if (stats.total === 0) {
        return (
            <div className="flex-1 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-center">
                <div className="flex justify-center items-center gap-2 mb-2">
                    <TeamLogo logoUrl={teamLogo} teamName={teamName} sizeClass="h-8 w-8" />
                    <h4 className="text-lg font-bold">{teamName}</h4>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">No prediction history for this team yet.</p>
            </div>
        );
    }

    const winRate = Math.round((stats.wins / stats.total) * 100);

    return (
        <div className="flex-1 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
                <TeamLogo logoUrl={teamLogo} teamName={teamName} sizeClass="h-10 w-10" />
                <h4 className="text-xl font-bold text-gray-900 dark:text-white">{teamName}</h4>
            </div>
            <div className="flex justify-around items-center">
                <PerformanceStat label="Predictions" value={stats.total} />
                <PerformanceStat label="Correct" value={stats.wins} />
                <PerformanceStat label="Win Rate" value={`${winRate}%`} />
            </div>
            {stats.recentOutcomes.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">RECENT RESULTS</p>
                    <div className="flex justify-center items-center gap-2">
                        {stats.recentOutcomes.map((outcome, index) => (
                            <RecentOutcomeIcon key={index} status={outcome} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


const TeamPerformanceTracker: React.FC<TeamPerformanceTrackerProps> = ({ teamA, teamB, statsA, statsB, logoA, logoB }) => {
    // Only render if there's history for at least one team
    if (statsA.total === 0 && statsB.total === 0) {
        return null;
    }

    return (
        <section>
            <div className="flex items-center gap-3 mb-4">
                <ChartPieIcon className="h-7 w-7 text-green-600 dark:text-green-300" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">AI's Track Record</h3>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
                <TeamCard teamName={teamA} teamLogo={logoA} stats={statsA} />
                <TeamCard teamName={teamB} teamLogo={logoB} stats={statsB} />
            </div>
        </section>
    );
};

export default TeamPerformanceTracker;