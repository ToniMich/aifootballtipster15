import React, { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { UserProfile } from '../types';
import { getUserProfile, signOut } from '../services/supabaseService';
import { XMarkIcon, WarningIcon, LightningBoltIcon, UserCircleIcon } from './icons';

interface ProfileModalProps {
  session: Session;
  onClose: () => void;
}

const FREE_TIER_LIMIT = 12;

const ProfileModal: React.FC<ProfileModalProps> = ({ session, onClose }) => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const userProfile = await getUserProfile();
                if (userProfile) {
                    setProfile(userProfile);
                } else {
                    // This can happen if the DB trigger hasn't fired yet for a new user.
                    // We'll show a friendly message instead of a harsh error.
                     setError("Your profile is being created. Please check back in a moment.");
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Could not load your profile data.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, []);

    const handleLogout = async () => {
        await signOut();
        onClose(); // Close the modal after signing out
    };
    
    const renderContent = () => {
        if (isLoading) {
            return <div className="text-center p-8">Loading profile...</div>;
        }

        if (error || !profile) {
            return (
                <div className="text-center p-6">
                    <WarningIcon className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
                    <p className="font-semibold">Could Not Load Profile</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{error || "An unknown error occurred."}</p>
                </div>
            );
        }

        const usagePercentage = (profile.monthly_prediction_count / FREE_TIER_LIMIT) * 100;

        return (
            <div className="p-2 space-y-6">
                <div className="text-center border-b border-gray-200 dark:border-gray-700 pb-4">
                    <UserCircleIcon className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-500 mb-2" />
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white truncate">{session.user.email}</h3>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Subscription Plan</p>
                        <p className="text-lg font-bold text-green-600 dark:text-green-400 capitalize">{profile.subscription_status}</p>
                    </div>

                    {profile.subscription_status === 'free' && (
                        <div>
                            <div className="flex justify-between items-baseline mb-1">
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Monthly Predictions</p>
                                <p className="text-sm font-bold">{profile.monthly_prediction_count} / {FREE_TIER_LIMIT}</p>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${usagePercentage}%` }}></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-3 pt-4">
                    <button 
                        onClick={() => alert('Pro subscription coming soon!')}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-2.5 px-4 rounded-lg transition-all shadow-md"
                    >
                        <LightningBoltIcon className="h-5 w-5" />
                        Upgrade to Pro
                    </button>
                    <button 
                        onClick={handleLogout}
                        className="w-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 font-bold py-2.5 px-4 rounded-lg transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-sm my-8 animate-fade-in-down p-4 relative"
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

export default ProfileModal;