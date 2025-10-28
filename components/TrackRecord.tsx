import React from 'react';
import { HistoryItem } from '../types';
import { TicketIcon, FireIcon, LightningBoltIcon, TrophyIcon } from './icons';

interface TrackRecordProps {
  history: HistoryItem[];
}

const StatCard: React.FC<{ icon: React.ReactNode; value: string; label: string; sublabel?: string; colorClass: string }> = ({ icon, value, label, sublabel, colorClass }) => (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg flex items-center gap-4 shadow-sm">
        <div className={`p-3 rounded-full ${colorClass}`}>
            {icon}
        </div>
        <div>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{value}</p>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">{label}</p>
            {sublabel && <p className="text-xs text-gray-500 dark:text-gray-500">{sublabel}</p>}
        </div>
    </div>
);

const TrackRecord: React.FC<TrackRecordProps> = ({ history }) => {
  const completedPredictions = history.filter(item => item.status === 'won' || item.status === 'lost');

  // --- Calculate Stats ---

  // 1. Recent Form (Last 10)
  const recentOutcomes = completedPredictions.slice(0, 10);
  const totalRecent = recentOutcomes.length;
  const winsRecent = recentOutcomes.filter(item => item.status === 'won').length;

  // 2. Current Streak
  let streak = 0;
  let streakType: 'W' | 'L' | null = null;
  if (completedPredictions.length > 0) {
    const firstStatus = completedPredictions[0].status;
    if (firstStatus === 'won' || firstStatus === 'lost') {
        streakType = firstStatus === 'won' ? 'W' : 'L';
        streak = 1;
        for (let i = 1; i < completedPredictions.length; i++) {
            if (completedPredictions[i].status === firstStatus) {
                streak++;
            } else {
                break;
            }
        }
    }
  }

  // 3. Best Bet Accuracy (for "Match Winner" bets)
  const matchWinnerBets = completedPredictions.filter(item => 
    item.bestBets?.some(bet => bet.category === 'Match Winner')
  );
  const correctMatchWinnerBets = matchWinnerBets.filter(item => item.status === 'won').length;
  const bestBetAccuracy = matchWinnerBets.length > 0 
    ? Math.round((correctMatchWinnerBets / matchWinnerBets.length) * 100) 
    : 0;
    
  if (completedPredictions.length === 0) {
    return (
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
                <TicketIcon className="h-7 w-7 text-green-600 dark:text-green-300" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Recent Performance</h3>
            </div>
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                <p>Make a prediction to see the AI's performance track record.</p>
            </div>
        </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <TicketIcon className="h-7 w-7 text-green-600 dark:text-green-300" />
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Recent Performance</h3>
      </div>
      <div className="flex flex-col md:flex-row gap-4">
        <StatCard 
            icon={<FireIcon className="h-6 w-6 text-white" />}
            value={streak > 0 ? `${streakType}${streak}` : 'N/A'}
            label="Current Streak"
            sublabel={streak > 0 ? (streakType === 'W' ? 'Winning Streak' : 'Losing Streak') : 'No active streak'}
            colorClass={streakType === 'W' ? 'bg-green-500' : streakType === 'L' ? 'bg-red-500' : 'bg-gray-500'}
        />
         <StatCard 
            icon={<LightningBoltIcon className="h-6 w-6 text-white" />}
            value={`${winsRecent}/${totalRecent}`}
            label="Recent Form"
            sublabel={totalRecent > 0 ? `Wins in last ${totalRecent} games` : 'No recent games'}
            colorClass="bg-blue-500"
        />
        <StatCard 
            icon={<TrophyIcon className="h-6 w-6 text-white" />}
            value={`${bestBetAccuracy}%`}
            label="Best Bet Acc."
            sublabel={matchWinnerBets.length > 0 ? `'Match Winner' picks` : 'No winner bets yet'}
            colorClass="bg-purple-500"
        />
      </div>
    </div>
  );
};

export default TrackRecord;