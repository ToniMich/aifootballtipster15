import React from 'react';
import { PredictionResultData, BestBet, PlayerStat, GoalScorerPrediction, TeamPerformanceStats, HistoryItem } from '../types';
import { ChartPieIcon, WarningIcon, LocationMarkerIcon, CalendarIcon, WhistleIcon, FireIcon, LightningBoltIcon, TableCellsIcon, TrophyIcon, AssistIcon, CardIcon, TicketIcon } from './icons';
import TeamLogo from './TeamLogo';
import SocialShare from './SocialShare';
import GoalProbabilityChart from './GoalProbabilityChart';
import TeamPerformanceTracker from './TeamPerformanceTracker';

interface PredictionResultProps {
  result: PredictionResultData | null;
  error: string | null;
  teamA: string;
  teamB: string;
  teamPerformanceStats: { teamA: TeamPerformanceStats; teamB: TeamPerformanceStats } | null;
}

const TeamForm: React.FC<{ form: string }> = ({ form = '' }) => {
    const getFormColor = (result: string) => {
        switch (result.toUpperCase()) {
            case 'W': return 'bg-green-500';
            case 'D': return 'bg-yellow-500';
            case 'L': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };
    
    return (
        <div className="flex gap-1.5">
            {(form || '?????').slice(0, 5).split('').map((result, index) => (
                <div key={index} className={`h-6 w-6 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ${getFormColor(result)}`} title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : result === 'L' ? 'Loss' : 'Unknown'}>
                    {result.toUpperCase()}
                </div>
            ))}
        </div>
    );
};

const ConfidenceBar: React.FC<{ confidence: string }> = ({ confidence }) => {
    const level = confidence?.toLowerCase() || '';
    
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

const ConfidenceRing: React.FC<{ percentage: number }> = ({ percentage }) => {
    const radius = 30;
    const stroke = 5;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative h-20 w-20">
            <svg
                height="100%"
                width="100%"
                viewBox="0 0 70 70"
                className="transform -rotate-90"
            >
                <circle
                    className="text-gray-200 dark:text-gray-600"
                    stroke="currentColor"
                    strokeWidth={stroke}
                    fill="transparent"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                />
                <circle
                    className="text-green-500"
                    stroke="currentColor"
                    strokeWidth={stroke}
                    strokeDasharray={circumference + ' ' + circumference}
                    style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-out' }}
                    strokeLinecap="round"
                    fill="transparent"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-800 dark:text-gray-200">
                {`${percentage}%`}
            </span>
        </div>
    );
};

const InfoCard: React.FC<{ icon: React.ReactNode, title: string, value: string | undefined }> = ({ icon, title, value }) => {
    if (!value) return null;
    return (
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
            <div className="text-green-600 dark:text-green-400">{icon}</div>
            <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{title}</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{value}</p>
            </div>
        </div>
    );
};


const BestBetCard: React.FC<{ bet: BestBet }> = ({ bet }) => (
    <div className="bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700/50 rounded-lg p-4 shadow-sm">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{bet.category}</p>
                <p className="text-lg font-bold text-green-700 dark:text-green-300">{bet.value}</p>
            </div>
            <span className="text-sm font-bold bg-green-200 text-green-800 dark:bg-green-800/60 dark:text-green-200 px-2.5 py-1 rounded-full">{bet.confidence}</span>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-400 mt-2">{bet.reasoning}</p>
    </div>
);

const PlayerStatsTable: React.FC<{ players: PlayerStat[], teamName: string }> = ({ players, teamName }) => {
    const teamPlayers = players.filter(p => p.teamName === teamName);
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
                        <tr key={p.playerName} className="border-b dark:border-gray-700">
                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{p.playerName}</td>
                            <td className="px-2 py-2 text-center">{p.goals}</td>
                            <td className="px-2 py-2 text-center">{p.assists}</td>
                            <td className="px-2 py-2 text-center">{p.yellowCards}/{p.redCards}</td>
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
            <p className="font-semibold text-gray-800 dark:text-gray-200">{prediction.playerName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{prediction.reasoning}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
            prediction.probability === 'High' ? 'bg-green-200 text-green-800 dark:bg-green-800/60 dark:text-green-200' :
            prediction.probability === 'Medium' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800/60 dark:text-yellow-200' :
            'bg-orange-200 text-orange-800 dark:bg-orange-800/60 dark:text-orange-200'
        }`}>{prediction.probability}</span>
    </div>
);


const PredictionResult: React.FC<PredictionResultProps> = ({ result, error, teamA, teamB, teamPerformanceStats }) => {
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
    
    const probA = parseInt(result.teamA_winProbability, 10) || 0;
    const probB = parseInt(result.teamB_winProbability, 10) || 0;
    const probDraw = parseInt(result.drawProbability, 10) || 0;

    return (
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg animate-fade-in overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                {result.fromCache && (
                    <div className="mb-4 text-xs font-semibold text-center text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 py-1 px-3 rounded-full w-fit mx-auto">
                        Retrieved from recent history
                    </div>
                )}
                <div className="space-y-4">
                    {/* Team Info */}
                    <div className="flex justify-between items-center text-center">
                        <div className="flex-1 flex flex-col items-center gap-2">
                        <TeamLogo logoUrl={result.teamA_logo} teamName={teamA} sizeClass="h-14 w-14 md:h-16 md:w-16" />
                        <h3 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-200">{teamA}</h3>
                        </div>
                        <span className="text-2xl font-light text-gray-400 dark:text-gray-500 mx-2">vs</span>
                        <div className="flex-1 flex flex-col items-center gap-2">
                        <TeamLogo logoUrl={result.teamB_logo} teamName={teamB} sizeClass="h-14 w-14 md:h-16 md:w-16" />
                        <h3 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-200">{teamB}</h3>
                        </div>
                    </div>

                    {/* Probability Bar */}
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
                            title={`${teamA} Win Probability: ${probA}%`}
                        />
                        <div
                            className="bg-gray-400 dark:bg-gray-500 transition-all duration-500"
                            style={{ width: `${probDraw}%` }}
                            title={`Draw Probability: ${probDraw}%`}
                        />
                        <div
                            className="bg-blue-500 transition-all duration-500"
                            style={{ width: `${probB}%` }}
                            title={`${teamB} Win Probability: ${probB}%`}
                        />
                        </div>
                    </div>
                </div>
                {result.leagueContext && (
                    <p className="text-center text-sm font-semibold text-gray-500 dark:text-gray-400 mt-4">{result.leagueContext.leagueName}</p>
                )}
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
                    <InfoCard icon={<LocationMarkerIcon className="h-5 w-5" />} title="Venue" value={result.venue} />
                    <InfoCard icon={<CalendarIcon className="h-5 w-5" />} title="Kickoff" value={result.kickoffTime} />
                    <InfoCard icon={<WhistleIcon className="h-5 w-5" />} title="Referee" value={result.referee} />
                </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-8">
                {/* Prediction & Analysis */}
                <section>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI Prediction</p>
                        <h2 className="text-3xl md:text-4xl font-bold text-green-600 dark:text-green-400 my-2">{result.prediction}</h2>
                        <ConfidenceBar confidence={result.confidence} />
                    </div>
                    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <h4 className="font-bold text-gray-800 dark:text-white mb-2">Analyst's Breakdown</h4>
                        <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed">{result.analysis}</p>
                    </div>
                </section>
                
                {/* Key Stats */}
                <section>
                     <div className="flex items-center gap-3 mb-4">
                        <LightningBoltIcon className="h-7 w-7 text-green-600 dark:text-green-300" />
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Key Stats</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg">
                            <h4 className="font-semibold mb-2">Recent Form</h4>
                            <div className="flex justify-between items-center"><span>{teamA}</span><TeamForm form={result.keyStats.teamA_form} /></div>
                            <div className="flex justify-between items-center mt-2"><span>{teamB}</span><TeamForm form={result.keyStats.teamB_form} /></div>
                        </div>
                         <div className="p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg">
                            <h4 className="font-semibold mb-2">Head-to-Head</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{result.keyStats.head_to_head}</p>
                        </div>
                    </div>
                </section>

                {/* AI Team Performance */}
                {teamPerformanceStats && (
                    <TeamPerformanceTracker 
                        teamA={teamA} 
                        teamB={teamB} 
                        statsA={teamPerformanceStats.teamA} 
                        statsB={teamPerformanceStats.teamB} 
                        logoA={result.teamA_logo}
                        logoB={result.teamB_logo}
                    />
                )}

                {/* Best Bets */}
                {result.bestBets && result.bestBets.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-4">
                            <ChartPieIcon className="h-7 w-7 text-green-600 dark:text-green-300" />
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Best Bets</h3>
                        </div>
                        <div className="space-y-3">
                            {result.bestBets.map((bet, index) => <BestBetCard key={index} bet={bet} />)}
                        </div>
                    </section>
                )}

                {/* Goal Probabilities */}
                {result.goalProbabilities && <GoalProbabilityChart probabilities={result.goalProbabilities} />}

                {/* Player Impact */}
                 {(result.playerStats || result.goalScorerPredictions) && (
                    <section>
                         <div className="flex items-center gap-3 mb-4">
                            <TableCellsIcon className="h-7 w-7 text-green-600 dark:text-green-300" />
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Player Impact</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {result.playerStats && result.playerStats.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-lg mb-2 text-center">{teamA} Key Players</h4>
                                    <PlayerStatsTable players={result.playerStats} teamName={teamA} />
                                     <h4 className="font-bold text-lg mb-2 mt-4 text-center">{teamB} Key Players</h4>
                                    <PlayerStatsTable players={result.playerStats} teamName={teamB} />
                                </div>
                            )}
                             {result.goalScorerPredictions && result.goalScorerPredictions.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-lg mb-2 text-center">Likely Goalscorers</h4>
                                    <div className="space-y-2">
                                        {result.goalScorerPredictions.map(p => <GoalScorerCard key={p.playerName} prediction={p} />)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}
                
                {/* Availability */}
                {result.availabilityFactors && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <h4 className="font-bold text-gray-800 dark:text-white mb-2">Availability Factors</h4>
                        <p className="text-gray-700 dark:text-gray-300 text-sm">{result.availabilityFactors}</p>
                    </div>
                )}
                
                {/* Sources */}
                {result.sources && result.sources.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Sources</h4>
                        <div className="flex flex-wrap gap-2">
                            {result.sources.map((source, index) => (
                                <a key={index} href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 px-2 py-1 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                    {source.web.title}
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