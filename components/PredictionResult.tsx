import React, { useState, useEffect } from 'react';
import { HistoryItem, HeadToHeadStats, PlayerStat, GoalScorerPrediction } from '../types';
import { ChartPieIcon, WarningIcon, LocationMarkerIcon, CalendarIcon, WhistleIcon, LightningBoltIcon, TableCellsIcon, TrophyIcon, AssistIcon, CardIcon, RefreshIcon } from './icons';
import TeamLogo from './TeamLogo';
import SocialShare from './SocialShare';
import GoalProbabilityChart from './GoalProbabilityChart';
import BestBetsGrid from './BestBetsGrid';
import HeadToHeadVisual from './HeadToHeadVisual';
import UserBettingPanel from './UserBettingPanel';

interface PredictionResultProps {
  result: HistoryItem | null;
  error: string | null;
  teamA: string;
  teamB: string;
  onViewTeamStats: (teamName: string) => void;
  onForceRefresh: (teamA: string, teamB: string, category: 'men' | 'women') => void;
  isProUser: boolean; // Accept a boolean for pro status
  onUpgrade: () => void;
}

// Helper function to safely render content that should be a string or number
const renderSafely = (content: any, fallback: string | number = 'N/A'): string | number => {
    if (typeof content === 'string' || typeof content === 'number') {
        return content;
    }
    // Return the fallback if content is not a renderable primitive
    return fallback;
};

const TeamForm: React.FC<{ form: string }> = ({ form }) => {
    const getFormColor = (result: string) => {
        switch (result.toUpperCase()) {
            case 'W': return 'bg-green-500';
            case 'D': return 'bg-yellow-500';
            case 'L': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };
    
    // Improved robustness: Ensure 'form' is always a string.
    if (typeof form !== 'string') {
        form = '?????';
    }

    return (
        <div className="flex gap-1.5">
            {form.slice(0, 5).split('').map((result, index) => (
                <div key={index} className={`h-6 w-6 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ${getFormColor(result)}`} title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : result === 'L' ? 'Loss' : 'Unknown'}>
                    {result.toUpperCase()}
                </div>
            ))}
        </div>
    );
};

const ConfidenceBar: React.FC<{ confidence: string }> = ({ confidence }) => {
    const level = String(confidence || '').toLowerCase();
    
    const levels = [
        { name: 'Low', color: 'bg-orange-500', textColor: 'text-orange-600 dark:text-orange-400' },
        { name: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400' },
        { name: 'High', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400' },
    ];

    const currentLevelIndex = levels.findIndex(l => l.name.toLowerCase() === level);
    const activeLevel = levels[currentLevelIndex] || { name: 'N/A', color: 'bg-gray-400', textColor: 'text-gray-500' };

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Confidence</span>
                <span className={`text-sm font-bold ${activeLevel.textColor}`}>{activeLevel.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                {levels.map((l, index) => (
                    <div
                        key={l.name}
                        className={`h-2.5 rounded-full transition-colors ${
                            index <= currentLevelIndex ? activeLevel.color : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                    ></div>
                ))}
            </div>
        </div>
    );
};

const InfoCard: React.FC<{ icon: React.ReactNode, title: string, value: any }> = ({ icon, title, value }) => {
    const safeValue = renderSafely(value);
    if (!safeValue || safeValue === 'N/A') return null;

    return (
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
            <div className="text-green-600 dark:text-green-400">
                {icon}
            </div>
            <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{title}</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{safeValue}</p>
            </div>
        </div>
    );
};


const PlayerStatsTable: React.FC<{ players: PlayerStat[], teamName: string }> = ({ players, teamName }) => {
    const teamPlayers = players.filter(p => p && p.teamName === teamName);
    if (teamPlayers.length === 0) return null;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                    <tr>
                        <th scope="col" className="px-4 py-2">Player</th>
                        <th scope="col" className="px-2 py-2 text-center" title="Goals"><TrophyIcon className="h-4 w-4 mx-auto"/></th>
                        <th scope="col" className="px-2 py-2 text-center" title="Assists"><AssistIcon className="h-4 w-4 mx-auto"/></th>
                        <th scope="col" className="px-2 py-2 text-center" title="Cards"><CardIcon className="h-4 w-4 mx-auto"/></th>
                    </tr>
                </thead>
                <tbody>
                    {teamPlayers.map(p => (
                        <tr key={String(p.playerName)} className="border-b dark:border-gray-700">
                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{renderSafely(p.playerName)}</td>
                            <td className="px-2 py-2 text-center">{renderSafely(p.goals, 0)}</td>
                            <td className="px-2 py-2 text-center">{renderSafely(p.assists, 0)}</td>
                            <td className="px-2 py-2 text-center">{`${renderSafely(p.yellowCards, 0)}/${renderSafely(p.redCards, 0)}`}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const GoalScorerCard: React.FC<{ prediction: GoalScorerPrediction }> = ({ prediction }) => (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <div>
            <p className="font-semibold text-gray-800 dark:text-gray-200">{renderSafely(prediction.playerName)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{renderSafely(prediction.reasoning, '')}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
            prediction.probability === 'High' ? 'bg-green-200 text-green-800 dark:bg-green-800/60 dark:text-green-200' :
            prediction.probability === 'Medium' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800/60 dark:text-yellow-200' :
            'bg-orange-200 text-orange-800 dark:bg-orange-800/60 dark:orange-200'
        }`}>{renderSafely(prediction.probability)}</span>
    </div>
);


const PredictionResult: React.FC<PredictionResultProps> = ({ result, error, teamA, teamB, onViewTeamStats, onForceRefresh, isProUser, onUpgrade }) => {
    const [showRefreshButton, setShowRefreshButton] = useState(false);

    useEffect(() => {
        if (!result || !result.fromCache || !result.kickoffTime || typeof result.kickoffTime !== 'string' || !isProUser) {
            setShowRefreshButton(false);
            return;
        }

        try {
            const parsableDateString = result.kickoffTime.replace(/ [A-Z]{3,4}$/, '');
            const kickoffDate = new Date(parsableDateString);
            
            if (isNaN(kickoffDate.getTime())) {
                setShowRefreshButton(false);
                return;
            }

            const now = new Date();
            const twoHours = 2 * 60 * 60 * 1000;
            const timeDifference = kickoffDate.getTime() - now.getTime();

            setShowRefreshButton(timeDifference > 0 && timeDifference <= twoHours);

        } catch (e) {
            console.error("Failed to parse kickoffTime for refresh check:", result.kickoffTime, e);
            setShowRefreshButton(false);
        }
    }, [result, isProUser]);

    if (error) {
        return (
            <div className="p-6 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-500 rounded-lg text-red-800 dark:text-red-300 animate-fade-in">
                <div className="flex items-center gap-3">
                    <WarningIcon className="h-8 w-8" />
                    <div>
                        <h3 className="text-xl font-bold">Prediction Failed</h3>
                        <p className="mt-1">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!result) {
        return null;
    }
    
    const teamsAreSwapped = result.teamA !== teamA;

    const probA = parseInt(String(teamsAreSwapped ? result.teamB_winProbability : result.teamA_winProbability), 10) || 0;
    const probB = parseInt(String(teamsAreSwapped ? result.teamA_winProbability : result.teamB_winProbability), 10) || 0;
    const probDraw = parseInt(String(result.drawProbability), 10) || 0;

    const logoA = teamsAreSwapped ? result.teamB_logo : result.teamA_logo;
    const logoB = teamsAreSwapped ? result.teamA_logo : result.teamB_logo;

    const keyStats = result.keyStats || { teamA_form: '?????', teamB_form: '?????', head_to_head: { totalMatches: 0, teamA_wins: 0, draws: 0, teamB_wins: 0, summary: 'N/A' } };
    const h2hData = keyStats.head_to_head || { totalMatches: 0, teamA_wins: 0, draws: 0, teamB_wins: 0, summary: 'N/A' };
    
    const formA = teamsAreSwapped ? keyStats.teamB_form : keyStats.teamA_form;
    const formB = teamsAreSwapped ? keyStats.teamA_form : keyStats.teamB_form;

    const h2hStats: HeadToHeadStats = teamsAreSwapped ? {
        ...h2hData,
        teamA_wins: h2hData.teamB_wins,
        teamB_wins: h2hData.teamA_wins,
    } : h2hData;
    
    return (
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg animate-fade-in overflow-hidden">
            {/* Refresh Banner */}
            {showRefreshButton && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/40 border-b border-blue-200 dark:border-blue-800 animate-fade-in">
                    <div className="flex flex-col sm:flex-row items-center justify-center text-center sm:text-left gap-2 sm:gap-4">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            <span className="font-semibold">Game Day!</span> Lineups may have changed. Get the latest analysis.
                        </p>
                        <button
                            onClick={() => onForceRefresh(teamA, teamB, result.matchCategory)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm flex-shrink-0"
                        >
                            <RefreshIcon className="h-4 w-4" />
                            Refresh Analysis
                        </button>
                    </div>
                </div>
            )}
            
            {/* Header */}
            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <div className="space-y-4">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
                        <div className="flex flex-col items-center justify-start gap-3 min-w-0">
                            <TeamLogo logoUrl={logoA} teamName={String(teamA)} sizeClass="h-16 w-16" />
                            <h3 
                                className="text-xl font-bold text-gray-800 dark:text-gray-200 break-words cursor-pointer hover:underline"
                                onClick={() => onViewTeamStats(teamA)}
                                title={`View stats for ${teamA}`}
                            >
                                {renderSafely(teamA)}
                            </h3>
                        </div>
                        
                        <span className="text-2xl font-light text-gray-400 dark:text-gray-500">vs</span>

                        <div className="flex flex-col items-center justify-start gap-3 min-w-0">
                            <TeamLogo logoUrl={logoB} teamName={String(teamB)} sizeClass="h-16 w-16" />
                            <h3 
                                className="text-xl font-bold text-gray-800 dark:text-gray-200 break-words cursor-pointer hover:underline"
                                onClick={() => onViewTeamStats(teamB)}
                                title={`View stats for ${teamB}`}
                            >
                                {renderSafely(teamB)}
                            </h3>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center text-sm font-semibold text-gray-800 dark:text-gray-200 px-1 mb-1">
                            <span style={{ width: `${probA}%` }} className="text-center">{probA}%</span>
                            <span style={{ width: `${probDraw}%` }} className="text-center">{probDraw}% Draw</span>
                            <span style={{ width: `${probB}%` }} className="text-center">{probB}%</span>
                        </div>
                        <div className="flex w-full h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                        <div
                            className="bg-green-500 transition-all duration-500"
                            style={{ width: `${probA}%` }}
                            title={`${renderSafely(teamA)} Win Probability: ${probA}%`}
                        />
                        <div
                            className="bg-gray-400 dark:bg-gray-500 transition-all duration-500"
                            style={{ width: `${probDraw}%` }}
                            title={`Draw Probability: ${probDraw}%`}
                        />
                        <div
                            className="bg-blue-500 transition-all duration-500"
                            style={{ width: `${probB}%` }}
                            title={`${renderSafely(teamB)} Win Probability: ${probB}%`}
                        />
                        </div>
                    </div>
                </div>
                {result.leagueContext && (
                    <p className="text-center text-sm font-semibold text-gray-500 dark:text-gray-400 mt-4">{renderSafely(result.leagueContext.leagueName, '')}</p>
                )}
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
                    <InfoCard icon={<LocationMarkerIcon className="h-5 w-5" />} title="Venue" value={result.venue} />
                    <InfoCard icon={<CalendarIcon className="h-5 w-5" />} title="Kickoff" value={result.kickoffTime} />
                    <InfoCard icon={<WhistleIcon className="h-5 w-5" />} title="Referee" value={result.referee} />
                </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-8">
                <section>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI Prediction</p>
                        <h2 className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400 my-2">{renderSafely(result.prediction, 'Prediction Unavailable')}</h2>
                        <ConfidenceBar confidence={result.confidence} />
                    </div>
                </section>
                
                <BestBetsGrid result={result} teamA={teamA} teamB={teamB} />

                {isProUser && <UserBettingPanel prediction={result} />}

                {result.keyStats && (
                    <section>
                         <div className="flex items-center gap-3 mb-4">
                            <LightningBoltIcon className="h-7 w-7 text-green-600 dark:text-green-300" />
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Key Stats</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg">
                                <h4 className="font-semibold mb-2">Recent Form</h4>
                                <div className="flex justify-between items-center">
                                    <span 
                                        className="cursor-pointer hover:underline"
                                        onClick={() => onViewTeamStats(teamA)}
                                    >{renderSafely(teamA)}</span>
                                    <TeamForm form={formA} />
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <span 
                                        className="cursor-pointer hover:underline"
                                        onClick={() => onViewTeamStats(teamB)}
                                    >{renderSafely(teamB)}</span>
                                    <TeamForm form={formB} />
                                </div>
                            </div>
                             <div className="p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg">
                                 <HeadToHeadVisual stats={h2hStats} teamAName={teamA} teamBName={teamB} />
                            </div>
                        </div>
                    </section>
                )}
                
                <section>
                     <div className="relative p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <h4 className="font-bold text-gray-800 dark:text-white mb-2">Analyst's Breakdown</h4>
                        <p className={`text-gray-700 dark:text-gray-300 text-base leading-relaxed ${!isProUser ? 'blur-sm select-none' : ''}`}>{renderSafely(result.analysis, 'Analysis not available.')}</p>
                        {!isProUser && (
                            <div className="absolute inset-0 flex flex-col justify-center items-center bg-white/70 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg">
                                <p className="font-bold text-lg text-gray-800 dark:text-white">This is a Pro Feature</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Unlock the full analysis and more.</p>
                                <button 
                                    onClick={onUpgrade}
                                    className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-colors"
                                >
                                    Upgrade to Pro
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {result.goalProbabilities && <GoalProbabilityChart probabilities={result.goalProbabilities} />}

                 {(result.playerStats || result.goalScorerPredictions) && (
                    <section>
                         <div className="flex items-center gap-3 mb-4">
                            <TableCellsIcon className="h-7 w-7 text-green-600 dark:text-green-300" />
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Player Impact</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {result.playerStats && result.playerStats.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-lg mb-2 text-center">{renderSafely(teamA)} Key Players</h4>
                                    <PlayerStatsTable players={result.playerStats.filter(Boolean)} teamName={teamA} />
                                     <h4 className="font-bold text-lg mb-2 mt-4 text-center">{renderSafely(teamB)} Key Players</h4>
                                    <PlayerStatsTable players={result.playerStats.filter(Boolean)} teamName={teamB} />
                                </div>
                            )}
                             {result.goalScorerPredictions && result.goalScorerPredictions.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-lg mb-2 text-center">Likely Goalscorers</h4>
                                    <div className="space-y-2">
                                        {result.goalScorerPredictions.filter(Boolean).map(p => <GoalScorerCard key={String(p.playerName)} prediction={p} />)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}
                
                {result.availabilityFactors && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <h4 className="font-bold text-gray-800 dark:text-white mb-2">Availability Factors</h4>
                        <p className="text-gray-700 dark:text-gray-300 text-sm">{renderSafely(result.availabilityFactors, '')}</p>
                    </div>
                )}
                
                {result.sources && result.sources.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Sources</h4>
                        <div className="flex flex-wrap gap-2">
                            {result.sources.filter(s => s && s.web).map((source, index) => (
                                <a key={index} href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 px-2 py-1 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                    {renderSafely(source.web.title)}
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            <SocialShare result={result} teamA={teamA} teamB={teamB} />
        </div>
    );
};

export default PredictionResult;