import React from 'react';
import { GoalProbabilities } from '../types';
import { FootballIcon } from './icons';

interface GoalProbabilityChartProps {
  probabilities: GoalProbabilities;
}

const GoalProbabilityChart: React.FC<GoalProbabilityChartProps> = ({ probabilities }) => {
  const data = [
    { label: '0-1 Goals', value: parseInt(probabilities['0-1'] || '0', 10), color: 'bg-yellow-500' },
    { label: '2-3 Goals', value: parseInt(probabilities['2-3'] || '0', 10), color: 'bg-green-500' },
    { label: '4+ Goals', value: parseInt(probabilities['4+'] || '0', 10), color: 'bg-blue-500' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <FootballIcon className="h-7 w-7 text-green-600 dark:text-green-300" />
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Goal Probabilities</h3>
      </div>
      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={index} className="w-full">
            <div className="flex justify-between items-center mb-1 text-sm font-semibold">
              <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
              <span className="text-gray-800 dark:text-gray-200">{item.value}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className={`${item.color} h-4 rounded-full transition-all duration-1000 ease-out`}
                style={{ width: `${item.value}%` }}
                role="progressbar"
                aria-valuenow={item.value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${item.label} probability`}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GoalProbabilityChart;
