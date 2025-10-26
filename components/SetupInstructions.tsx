import React from 'react';
import { WarningIcon } from './icons';

interface SetupInstructionsProps {
    error: string | null;
}

const SetupInstructions: React.FC<SetupInstructionsProps> = ({ error }) => {
    // This component now displays a simple error message instead of detailed setup instructions.
    // The detailed instructions have been removed as per the user's request.
    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="p-4 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-500 rounded-lg text-red-800 dark:text-red-300 text-center animate-fade-in flex items-center justify-center gap-3">
                <WarningIcon className="h-6 w-6" />
                <p className="font-semibold">{error}</p>
            </div>
        </div>
    );
};

export default SetupInstructions;
