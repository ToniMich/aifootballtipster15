import React from 'react';
import { WarningIcon, ClipboardIcon, CheckCircleIcon } from './icons';

interface SetupInstructionsProps {
    error: string | null;
}

const envTemplate = `# .env.local

# Supabase credentials for the frontend (get from 'supabase start' output)
VITE_SUPABASE_URL="http://127.0.0.1:54321"
VITE_SUPABASE_ANON_KEY="your_local_anon_key_from_the_terminal"

# Google Gemini API Key for AI Predictions
# Get it from Google AI Studio: https://aistudio.google.com/app/apikey
API_KEY="your_google_gemini_api_key"

# TheSportsDB API Key for Live Scores
# Get it from: https://www.thesportsdb.com/user_reg.php
THESPORTSDB_API_KEY="your_thesportsdb_api_key"
`;

const SetupInstructions: React.FC<SetupInstructionsProps> = ({ error }) => {
    const [isCopied, setIsCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(envTemplate).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 3000);
        });
    };

    return (
        <div className="mb-8 p-6 sm:p-8 bg-red-100 dark:bg-red-900/50 border-2 border-dashed border-red-400 dark:border-red-500 rounded-lg text-red-800 dark:text-red-300 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-4 text-center">
                <WarningIcon className="h-10 w-10 flex-shrink-0" />
                <div>
                    <h3 className="text-2xl font-bold">Action Required: Project Setup Incomplete</h3>
                    <p className="font-semibold text-lg mt-1">{error?.replace(/\[Configuration Error\]\s*/, '')}</p>
                </div>
            </div>

            <div className="mt-6 text-left max-w-4xl mx-auto space-y-6 text-red-900 dark:text-red-200">
                <p>
                    This application requires environment variables to connect to its backend services. To fix this, you need to create a
                    <code className="font-mono bg-red-200 dark:bg-red-800/60 rounded py-0.5 px-1.5 mx-1 text-sm">.env.local</code> file in the project's root directory.
                </p>

                <div className="space-y-4">
                    <h4 className="font-bold text-lg">Step 1: Start Supabase and Get Keys</h4>
                     <p>First, run <code className="font-mono bg-red-200 dark:bg-red-800/60 rounded py-0.5 px-1.5 mx-1 text-sm">supabase start</code> in your terminal. It will print your local credentials. Look for the <code className="font-mono text-sm">API URL</code> and <code className="font-mono text-sm">anon key</code>.</p>
                </div>

                <div className="space-y-4">
                    <h4 className="font-bold text-lg">Step 2: Create and Populate the <code className="font-mono text-base">.env.local</code> File</h4>
                    <p>In the main folder of this project, create a new file named <code className="font-mono bg-red-200 dark:bg-red-800/60 rounded py-0.5 px-1.5 text-sm">.env.local</code>. Copy the code block below and paste it into your new file.</p>
                    <div className="relative bg-red-50 dark:bg-gray-900/50 rounded-lg p-4 border border-red-300 dark:border-red-600">
                        <button
                            onClick={handleCopy}
                            className="absolute top-2 right-2 flex items-center gap-2 px-2 py-1 text-xs font-semibold rounded-md transition-colors bg-gray-500 text-white hover:bg-gray-600"
                            aria-live="polite"
                        >
                            {isCopied ? (
                                <>
                                    <CheckCircleIcon className="h-4 w-4 text-green-300" />
                                    <span>Copied!</span>
                                </>
                            ) : (
                                <>
                                    <ClipboardIcon className="h-4 w-4" />
                                    <span>Copy</span>
                                </>
                            )}
                        </button>
                        <pre className="text-sm text-gray-800 dark:text-gray-300 whitespace-pre-wrap overflow-x-auto">
                            <code>{envTemplate}</code>
                        </pre>
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="font-bold text-lg">Step 3: Add Your Keys</h4>
                    <p>Replace the placeholder values in the file with your actual keys:</p>
                    <ul className="list-disc list-inside space-y-2 pl-2">
                        <li><span className="font-semibold">VITE_SUPABASE_URL/ANON_KEY:</span> Use the values from the `supabase start` terminal output.</li>
                        <li><span className="font-semibold">API_KEY:</span> Get your Gemini API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-red-700 dark:hover:text-red-100">Google AI Studio</a>.</li>
                        <li><span className="font-semibold">THESPORTSDB_API_KEY:</span> Get your key from <a href="https://www.thesportsdb.com/user_reg.php" target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-red-700 dark:hover:text-red-100">TheSportsDB website</a>.</li>
                    </ul>
                </div>

                 <div className="space-y-4 pt-4 border-t-2 border-dashed border-red-300 dark:border-red-600">
                    <h4 className="font-bold text-lg">Step 4: Restart and Refresh</h4>
                    <p>
                        After saving the <code className="font-mono bg-red-200 dark:bg-red-800/60 rounded py-0.5 px-1.5 mx-1 text-sm">.env.local</code> file, you may need to **stop and restart the Vite development server** (`npm run dev`) for the changes to take effect. Then, refresh this page.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SetupInstructions;