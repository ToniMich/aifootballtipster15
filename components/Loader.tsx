import React, { useState, useEffect } from 'react';
import { FootballIcon } from './icons';

const loadingMessages = [
    "Searching historical data...",
    "Comparing team statistics...",
    "Analyzing recent form...",
    "Consulting the AI oracle...",
    "Evaluating key matchups...",
    "Finalizing analysis...",
];

const Loader: React.FC = () => {
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        // Cycle through messages every 2.5 seconds
        const interval = setInterval(() => {
            setMessageIndex((prevIndex) => (prevIndex + 1) % loadingMessages.length);
        }, 2500);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col justify-center items-center p-8 space-y-4">
            <FootballIcon className="animate-spin h-16 w-16 text-green-500 dark:text-green-400" />
            <span className="text-gray-800 dark:text-white text-lg font-medium text-center transition-opacity duration-500">
                {loadingMessages[messageIndex]}
            </span>
        </div>
    );
};

export default Loader;
