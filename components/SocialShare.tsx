import React, { useState, useMemo } from 'react';
import { PredictionResultData } from '../types';
import ShareButtons from './ShareButtons';

interface SocialShareProps {
  result: PredictionResultData;
  teamA: string;
  teamB: string;
}

const SocialShare: React.FC<SocialShareProps> = ({ result, teamA, teamB }) => {
  const [copied, setCopied] = useState(false);

  // Memoize share text generation to avoid re-computing on every render.
  const shareDetails = useMemo(() => {
    const appUrl = "https://aifootballtipster.app";
    const bestBets = result.bestBets || [];
    const topBet = bestBets.find(b => b.category === "Match Winner") || bestBets[0];

    // Safely access prediction, ensuring it's a string to prevent rendering errors.
    const predictionText = typeof result.prediction === 'string' ? result.prediction : 'See analysis';

    let baseText;
    if (topBet) {
      baseText = `🔮 AI Prediction: ${teamA} vs ${teamB} ➡️ ${predictionText}!\n\nTop Bet: '${topBet.value}' (${topBet.confidence} confidence).\n\nAnalysis by #AIFootballTipster.`;
    } else {
      baseText = `🔮 AI Prediction: ${teamA} vs ${teamB} ➡️ ${predictionText}!\n\nAnalysis by #AIFootballTipster.`;
    }
    
    const textToCopy = `${baseText}\n\nGet your own predictions: ${appUrl}`;
    const encodedShareText = encodeURIComponent(baseText);
    const encodedAppUrl = encodeURIComponent(appUrl);

    return {
      textToCopy,
      twitterUrl: `https://twitter.com/intent/tweet?url=${encodedAppUrl}&text=${encodedShareText}&hashtags=AIFootballTipster,FootballPrediction,AI`,
      facebookUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodedAppUrl}&quote=${encodedShareText}`,
    };
  }, [result, teamA, teamB]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareDetails.textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="p-6 border-t border-gray-200 dark:border-gray-700">
      <h4 className="text-center font-semibold text-gray-700 dark:text-gray-300 mb-4">Share this Prediction</h4>
      <ShareButtons
        twitterUrl={shareDetails.twitterUrl}
        facebookUrl={shareDetails.facebookUrl}
        isCopied={copied}
        onCopy={handleCopy}
      />
    </div>
  );
};

export default SocialShare;
