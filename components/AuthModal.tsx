import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { XMarkIcon } from './icons';

interface AuthModalProps {
  supabaseClient: Promise<SupabaseClient>;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ supabaseClient, onClose }) => {
    // This component is designed to resolve the promise internally
    // to avoid suspense/boundary issues with the Auth component.
    const [client, setClient] = React.useState<SupabaseClient | null>(null);

    React.useEffect(() => {
        supabaseClient.then(setClient);
    }, [supabaseClient]);

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
                
                {client ? (
                    <Auth
                        supabaseClient={client}
                        appearance={{ theme: ThemeSupa }}
                        providers={['google', 'github']}
                        theme={document.documentElement.classList.contains('dark') ? 'dark' : 'default'}
                    />
                ) : (
                    <div>Loading...</div> // Fallback while client promise resolves
                )}
            </div>
        </div>
    );
};

export default AuthModal;