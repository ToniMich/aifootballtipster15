// supabase/functions/shared/teamNameNormalizer.ts

/**
 * This file contains the logic for standardizing team names.
 * It ensures that variations like "Man Utd", "Manchester United", and "Man United"
 * are all treated as the same entity. This is crucial for accurate caching,
 * data retrieval, and matching against external APIs.
 */

const teamNameMapping: Record<string, string> = {
    // Premier League
    'arsenal': 'Arsenal',
    'aston villa': 'Aston Villa',
    'bournemouth': 'Bournemouth',
    'brentford': 'Brentford',
    'brighton & hove albion': 'Brighton',
    'brighton': 'Brighton',
    'chelsea': 'Chelsea',
    'crystal palace': 'Crystal Palace',
    'everton': 'Everton',
    'fulham': 'Fulham',
    'ipswich town': 'Ipswich',
    'ipswich': 'Ipswich',
    'leicester city': 'Leicester',
    'leicester': 'Leicester',
    'liverpool': 'Liverpool',
    'manchester city': 'Manchester City',
    'man city': 'Manchester City',
    'mancity': 'Manchester City',
    'manchester united': 'Manchester United',
    'man utd': 'Manchester United',
    'man united': 'Manchester United',
    'newcastle united': 'Newcastle',
    'newcastle': 'Newcastle',
    'nottingham forest': 'Nottingham Forest',
    'southampton': 'Southampton',
    'tottenham hotspur': 'Tottenham',
    'spurs': 'Tottenham',
    'tottenham': 'Tottenham',
    'west ham united': 'West Ham',
    'west ham': 'West Ham',
    'wolverhampton wanderers': 'Wolves',
    'wolves': 'Wolves',
    
    // La Liga
    'alavés': 'Alavés',
    'athletic bilbao': 'Athletic Bilbao',
    'atlético madrid': 'Atlético Madrid',
    'atletico madrid': 'Atlético Madrid',
    'fc barcelona': 'Barcelona',
    'barcelona': 'Barcelona',
    'celta vigo': 'Celta Vigo',
    'getafe': 'Getafe',
    'girona': 'Girona',
    'mallorca': 'Mallorca',
    'osasuna': 'Osasuna',
    'rayo vallecano': 'Rayo Vallecano',
    'real betis': 'Real Betis',
    'real madrid': 'Real Madrid',
    'real sociedad': 'Real Sociedad',
    'sevilla': 'Sevilla',
    'valencia': 'Valencia',
    'villarreal': 'Villarreal',
    
    // Serie A
    'ac milan': 'AC Milan',
    'milan': 'AC Milan',
    'as roma': 'Roma',
    'roma': 'Roma',
    'atalanta': 'Atalanta',
    'bologna': 'Bologna',
    'fiorentina': 'Fiorentina',
    'inter milan': 'Inter Milan',
    'internazionale': 'Inter Milan',
    'inter': 'Inter Milan',
    'juventus': 'Juventus',
    'lazio': 'Lazio',
    'napoli': 'Napoli',
    'torino': 'Torino',
    'udinese': 'Udinese',
    
    // Bundesliga
    'bayer leverkusen': 'Bayer Leverkusen',
    'bayern munich': 'Bayern Munich',
    'bayern': 'Bayern Munich',
    'borussia dortmund': 'Borussia Dortmund',
    'dortmund': 'Borussia Dortmund',
    'borussia mönchengladbach': 'Borussia Mönchengladbach',
    'eintracht frankfurt': 'Eintracht Frankfurt',
    'rb leipzig': 'RB Leipzig',
    'sc freiburg': 'SC Freiburg',
    'tsg hoffenheim': 'TSG Hoffenheim',
    'union berlin': 'Union Berlin',
    'vfb stuttgart': 'VfB Stuttgart',
    'vfl bochum': 'VfL Bochum',
    'vfl wolfsburg': 'VfL Wolfsburg',

    // Ligue 1
    'as monaco': 'Monaco',
    'monaco': 'Monaco',
    'lens': 'Lens',
    'lille': 'Lille',
    'lyon': 'Lyon',
    'marseille': 'Marseille',
    'nice': 'Nice',
    'paris saint-germain': 'Paris Saint-Germain',
    'psg': 'Paris Saint-Germain',
    'reims': 'Reims',
    'rennes': 'Rennes',
    'strasbourg': 'Strasbourg',
    
    // Other major clubs
    'ajax': 'Ajax',
    'benfica': 'Benfica',
    'celtic': 'Celtic',
    'fc porto': 'Porto',
    'porto': 'Porto',
    'psv eindhoven': 'PSV Eindhoven',
    'psv': 'PSV Eindhoven',
    'rangers': 'Rangers',
    'sporting cp': 'Sporting CP',
    'sporting lisbon': 'Sporting CP',

    // International
    'united states': 'USA',
    'england': 'England',
    'brazil': 'Brazil',
    'germany': 'Germany',
    'argentina': 'Argentina',
    'france': 'France',
    'spain': 'Spain',
    'italy': 'Italy',
    'portugal': 'Portugal',
    'belgium': 'Belgium',
    'netherlands': 'Netherlands',
};

/**
 * Normalizes a team name to a standard format.
 * @param {string} name - The raw team name.
 * @returns {string} The standardized team name.
 */
export function normalizeTeamName(name: string): string {
    if (!name || typeof name !== 'string') {
        return '';
    }
    const lowerCaseName = name.toLowerCase().trim();
    // Return the mapped name if it exists, otherwise return the original name.
    return teamNameMapping[lowerCaseName] || name.trim();
}
