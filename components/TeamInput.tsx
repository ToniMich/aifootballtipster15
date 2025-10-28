import React, { useState, useEffect, useRef } from 'react';
import { teamNames } from '../data/teams';

interface TeamInputProps {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    disabled: boolean;
    className?: string;
}

const TeamInput: React.FC<TeamInputProps> = ({ id, value, onChange, placeholder, disabled, className }) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsSuggestionsVisible(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        onChange(inputValue);

        if (inputValue.length > 0) {
            const filteredSuggestions = teamNames
                .filter(team =>
                    team.toLowerCase().startsWith(inputValue.toLowerCase())
                )
                .slice(0, 5); // Limit suggestions for performance and UI clarity
            setSuggestions(filteredSuggestions);
            setIsSuggestionsVisible(filteredSuggestions.length > 0);
        } else {
            setSuggestions([]);
            setIsSuggestionsVisible(false);
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        onChange(suggestion);
        setSuggestions([]);
        setIsSuggestionsVisible(false);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <input
                id={id}
                type="text"
                value={value}
                onChange={handleInputChange}
                onFocus={() => {
                    // Show suggestions on focus if there's already text and suggestions exist
                    if (value.length > 0 && suggestions.length > 0) {
                        setIsSuggestionsVisible(true);
                    }
                }}
                placeholder={placeholder}
                disabled={disabled}
                className={className}
                autoComplete="off"
            />
            {isSuggestionsVisible && suggestions.length > 0 && (
                <ul className="absolute z-20 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg animate-fade-in">
                    {suggestions.map((suggestion, index) => (
                        <li
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="px-4 py-2 cursor-pointer hover:bg-green-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                            tabIndex={0}
                            onKeyPress={(e) => e.key === 'Enter' && handleSuggestionClick(suggestion)}
                        >
                            {suggestion}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default TeamInput;
