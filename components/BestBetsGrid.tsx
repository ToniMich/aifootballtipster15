import React from 'react';
import { PredictionResultData, BestBet } from '../types';
import { LightningBoltIcon, FireIcon, FootballIcon, ChartPieIcon } from './icons';

interface BestBetsGridProps {
  result: PredictionResultData;
  teamA: string;
  teamB: string;
}

const renderSafely = (content: any, fallback: string | number = 'N/A'): string | number => {
    if (typeof content === 'string' || typeof content === 'number') {
        return content;
    }
    return fallback;
};

const BetCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg shadow-sm h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
            <div className="text-green-600 dark:text-green-400">{icon}</div>
            <h4 className="font-bold text-gray-800 dark:text-white">{title}</h4>
        </div>
        <div className="flex-grow flex flex-col justify-center">{children}</div>
    </div>
);

const ProbabilityGlider: React.FC<{ 
    labelA: string; 
    probA: number; 
    colorA: string;
    labelB: string; 
    probB: number; 
    colorB: string;
    centerLabel?: string;
}> = ({ labelA, probA, colorA, labelB, probB, colorB, centerLabel }) => (
    <div>
        <div className="flex justify-between items-center text-xs font-bold mb-1">
            <span className="text-gray-700 dark:text-gray-300">{labelA}</span>
            <span className="text-gray-700 dark:text-gray-300">{labelB}</span>
        </div>
        <div className="relative flex w-full h-5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
            <div
                className={`${colorA} transition-all duration-500`}
                style={{ width: `${probA}%` }}
                title={`${labelA}: ${probA}%`}
            />
            <div
                className={`${colorB} transition-all duration-500`}
                style={{ width: `${probB}%` }}
                title={`${labelB}: ${probB}%`}
            />
            {centerLabel && (
                <div className="absolute inset-0 flex justify-center items-center">
                    <div className="bg-white/80 dark:bg-black/80 px-2 py-0.5 rounded-full text-xs font-semibold text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600">
                        {centerLabel}
                    </div>
                </div>
            )}
        </div>
        <div className="flex justify-between items-center text-sm font-semibold mt-1">
            <span className={`${colorA.replace('bg-','text-').replace('-500', '-600')} dark:${colorA.replace('bg-','text-').replace('-500', '-400')}`}>{probA}%</span>
            <span className={`${colorB.replace('bg-','text-').replace('-500', '-600')} dark:${colorB.replace('bg-','text-').replace('-500', '-400')}`}>{probB}%</span>
        </div>
    </div>
);


const BestBetsGrid: React.FC<BestBetsGridProps> = ({ result, teamA, teamB }) => {
    const probA = parseInt(String(result.teamA_winProbability), 10) || 0;
    const probB = parseInt(String(result.teamB_winProbability), 10) || 0;

    // 1. Upset Probability
    const underdog = probA < probB ? teamA : teamB;
    const upsetProb = Math.min(probA, probB);

    // 2. Both Teams to Score (BTTS)
    const bttsYesProb = result.bttsPrediction ? parseInt(result.bttsPrediction.yesProbability, 10) : null;

    // 3. Total Goals (Over/Under 2.5)
    const over25Prob = result.overUnderPrediction ? parseInt(result.overUnderPrediction.over25Probability, 10) : null;
    
    // 4. Top AI Pick
    const topBet = result.bestBets?.[0];

    return (
        <section>
             <div className="flex items-center gap-3 mb-4">
                <ChartPieIcon className="h-7 w-7 text-green-600 dark:text-green-300" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Visual Insights</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Upset Probability */}
                <BetCard icon={<LightningBoltIcon className="h-5 w-5" />} title="Upset Alert">
                    <div className="text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Underdog</p>
                        <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{renderSafely(underdog)}</p>
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{upsetProb}%</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">Win Probability</p>
                    </div>
                </BetCard>

                {/* Both Teams to Score */}
                <BetCard icon={<FireIcon className="h-5 w-5" />} title="Both Teams to Score">
                    {bttsYesProb !== null ? (
                        <ProbabilityGlider 
                            labelA="Yes" probA={bttsYesProb} colorA="bg-green-500"
                            labelB="No" probB={100 - bttsYesProb} colorB="bg-blue-500"
                        />
                    ) : (
                        <div className="text-center text-sm text-gray-500 dark:text-gray-400 my-auto">
                            Data not available.
                        </div>
                    )}
                </BetCard>

                {/* Total Goals */}
                <BetCard icon={<FootballIcon className="h-5 w-5" />} title="Total Goals">
                     {over25Prob !== null ? (
                        <ProbabilityGlider 
                            labelA="Under" probA={100 - over25Prob} colorA="bg-purple-500"
                            labelB="Over" probB={over25Prob} colorB="bg-orange-500"
                            centerLabel="2.5"
                        />
                     ) : (
                        <div className="text-center text-sm text-gray-500 dark:text-gray-400 my-auto">
                             Data not available.
                        </div>
                     )}
                </BetCard>

                {/* Top AI Pick */}
                <BetCard icon={<ChartPieIcon className="h-5 w-5" />} title="Top AI Pick">
                    {topBet ? (
                        <div className="text-center">
                            <p className="text-sm text-gray-600 dark:text-gray-400">{renderSafely(topBet.category)}</p>
                            <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{renderSafely(topBet.value)}</p>
                             <div className="mt-2 inline-block text-sm font-bold bg-green-200 text-green-800 dark:bg-green-800/60 dark:text-green-200 px-2.5 py-1 rounded-full">
                                {renderSafely(topBet.confidence)} Confidence
                             </div>
                        </div>
                    ) : (
                        <div className="text-center text-sm text-gray-500 dark:text-gray-400 my-auto">
                            No specific best bet provided.
                        </div>
                    )}
                </BetCard>
            </div>
        </section>
    );
};

export default BestBetsGrid;