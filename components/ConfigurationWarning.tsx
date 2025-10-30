import React from 'react';
import { WarningIcon } from './icons';

const ConfigurationWarning: React.FC = () => {
    return (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-400 dark:border-yellow-600 rounded-lg text-yellow-800 dark:text-yellow-200 animate-fade-in mb-6">
            <div className="flex items-start sm:items-center gap-3">
                <WarningIcon className="h-8 w-8 flex-shrink-0" />
                <div>
                    <h3 className="text-lg font-bold">Backend Not Configured</h3>
                    <p className="mt-1 text-sm">
                        The application can't connect to the Supabase backend. Please ensure you have created a <code>.env.local</code> file in the project root with the correct <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
                        <br />
                        <strong>Important:</strong> You must restart the development server (<code>npm run dev</code>) after creating or changing this file.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ConfigurationWarning;