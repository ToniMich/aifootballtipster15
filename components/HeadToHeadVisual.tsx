import React from 'react';
import { HeadToHeadStats } from '../types';

interface HeadToHeadVisualProps {
  stats: HeadToHeadStats;
  teamAName: string;
  teamBName: string;
}

const renderSafely = (content: any, fallback: string | number = 'N/A'): string | number => {
    if (typeof content === 'string' || typeof content === 'number') {
        return content;
    }
    return fallback;
};

const HeadToHeadVisual: React.FC<HeadToHeadVisualProps> = ({ stats, teamAName, teamBName }) => {
    const { totalMatches, teamA_wins, draws, teamB_wins } = stats;

    if (!totalMatches || totalMatches === 0) {
        return (
            <div>
                <h4 className="font-semibold mb-2">Head-to-Head</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">No recent H2H data available.</p>
            </div>
        );
    }

    const teamA_percentage = (teamA_wins / totalMatches) * 100;
    const draws_percentage = (draws / totalMatches) * 100;
    const teamB_percentage = (teamB_wins / totalMatches) * 100;
    
    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">Head-to-Head</h4>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    Last {totalMatches} Matches
                </span>
            </div>
            
            <div className="flex w-full h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 mb-2">
                <div
                    className="bg-green-500 transition-all duration-500"
                    style={{ width: `${teamA_percentage}%` }}
                    title={`${renderSafely(teamAName)} Wins: ${teamA_wins}`}
                />
                <div
                    className="bg-gray-400 dark:bg-gray-500 transition-all duration-500"
                    style={{ width: `${draws_percentage}%` }}
                    title={`Draws: ${draws}`}
                />
                <div
                    className="bg-blue-500 transition-all duration-500"
                    style={{ width: `${teamB_percentage}%` }}
                    title={`${renderSafely(teamBName)} Wins: ${teamB_wins}`}
                />
            </div>
            
            <div className="flex justify-between text-xs font-semibold">
                <div className="text-left text-green-600 dark:text-green-400">
                    <span>{teamA_wins}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-1">Wins</span>
                </div>
                <div className="text-center text-gray-500 dark:text-gray-400">
                    <span>{draws} Draws</span>
                </div>
                <div className="text-right text-blue-600 dark:text-blue-400">
                    <span className="text-gray-500 dark:text-gray-400 mr-1">Wins</span>
                    <span>{teamB_wins}</span>
                </div>
            </div>
        </div>
    );
};

export default HeadToHeadVisual;
