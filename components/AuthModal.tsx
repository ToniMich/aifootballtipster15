import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { XMarkIcon, WarningIcon } from './icons';

interface AuthModalProps {
  supabaseClient: Promise<SupabaseClient>;
  onClose: () => void;
  isConfigured: boolean;
}

const AuthModal: React.FC<AuthModalProps> = ({ supabaseClient, onClose, isConfigured }) => {
    const [client, setClient] = React.useState<SupabaseClient | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (isConfigured) {
            supabaseClient
                .then(setClient)
                .catch(err => {
                    console.error("Failed to get Supabase client for auth modal:", err);
                    setError("Could not connect to the authentication service. Please try again later.");
                });
        }
    }, [supabaseClient, isConfigured]);

    const renderContent = () => {
        if (!isConfigured) {
            return (
                <div className="text-center">
                    <WarningIcon className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">Authentication Unavailable</h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        This application is not connected to a backend service. Please refer to the setup instructions to configure the Supabase client.
                    </p>
                </div>
            );
        }

        if (error) {
             return (
                <div className="text-center">
                    <WarningIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">Connection Error</h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{error}</p>
                </div>
            );
        }

        if (client) {
            return (
                <Auth
                    supabaseClient={client}
                    appearance={{ theme: ThemeSupa }}
                    providers={['google', 'github']}
                    theme={document.documentElement.classList.contains('dark') ? 'dark' : 'default'}
                    redirectTo={window.location.origin}
                />
            );
        }
        
        return <div className="text-center text-gray-600 dark:text-gray-400">Loading authentication...</div>;
    };

    return (
        <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-sm my-8 animate-fade-in-down p-6 sm:p-8 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button 
                    onClick={onClose}
                    className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                    aria-label="Close"
                >
                    <XMarkIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                </button>
                
                {renderContent()}
            </div>
        </div>
    );
};

export default AuthModal;