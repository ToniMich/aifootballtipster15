import React from 'react';
import { FTLogoIcon, TwitterIcon, GitHubIcon, HeartIcon } from './icons';

const Footer: React.FC = () => {
    return (
        <footer className="bg-gray-100 dark:bg-gray-900/50 mt-12 border-t border-gray-200 dark:border-gray-700">
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                        <FTLogoIcon className="h-8 w-8" />
                        <div>
                            <p className="text-lg font-bold text-gray-800 dark:text-gray-200">AI Football Tipster</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">© {new Date().getFullYear()} All Rights Reserved.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="https://paypal.me/gizahhub" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors font-semibold">
                            <HeartIcon className="h-5 w-5" />
                            Support
                        </a>
                        <a href="https://twitter.com/googledevs" target="_blank" rel="noopener noreferrer" aria-label="Follow on Twitter" className="text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors">
                            <TwitterIcon className="h-6 w-6" />
                        </a>
                        <a href="https://github.com/google/aistudio" target="_blank" rel="noopener noreferrer" aria-label="View on GitHub" className="text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors">
                            <GitHubIcon className="h-6 w-6" />
                        </a>
                    </div>
                </div>
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Disclaimer: This application is for entertainment purposes only and does not constitute financial advice. Please gamble responsibly and only wager what you can afford to lose.
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
