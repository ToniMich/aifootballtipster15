import React, { useState, useEffect } from 'react';
import { FootballIcon } from './icons';

interface TeamLogoProps {
    logoUrl?: string;
    teamName: string;
    sizeClass?: string;
}

const TeamLogo: React.FC<TeamLogoProps> = ({ logoUrl, teamName, sizeClass = "h-12 w-12" }) => {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setHasError(false);
    }, [logoUrl]);

    if (!logoUrl || hasError) {
        return <FootballIcon className={`${sizeClass} text-gray-400 dark:text-gray-500`} />;
    }

    return (
        <img
            src={logoUrl}
            alt={`${teamName} logo`}
            className={`${sizeClass} object-contain`}
            onError={() => setHasError(true)}
        />
    );
};

export default TeamLogo;
