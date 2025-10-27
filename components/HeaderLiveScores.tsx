import React, { useState, useRef, useEffect } from 'react';
import LiveScores from './LiveScores';

const LiveIndicator: React.FC = () => (
    <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
        <span className="text-sm font-semibold">Live</span>
    </div>
);

const HeaderLiveScores: React.FC<{ disabled?: boolean }> = ({ disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                aria-label="Toggle live scores"
                aria-expanded={isOpen}
            >
                <LiveIndicator />
            </button>
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl z-50 animate-fade-in-down">
                    {/* The LiveScores component has its own internal padding and structure */}
                    <LiveScores disabled={disabled} />
                </div>
            )}
        </div>
    );
};

export default HeaderLiveScores;
