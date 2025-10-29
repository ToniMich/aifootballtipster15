
export function getTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') {
        return 'dark';
    }
    try {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'light') {
            return 'light';
        }
    } catch (e) {
        console.error('Could not access localStorage for theme:', e);
    }
    // Default to dark theme if localStorage is inaccessible or not set
    return 'dark';
}

export function setTheme(theme: 'light' | 'dark'): void {
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem('theme', theme);
        } catch (e) {
            console.error('Could not access localStorage to set theme:', e);
        }
    }
}

export function getSportsDbKey(): string | null {
    if (typeof window !== 'undefined') {
        try {
            return localStorage.getItem('thesportsdb_api_key');
        } catch (e) {
            console.error('Could not access localStorage for API key:', e);
            return null;
        }
    }
    return null;
}

export function setSportsDbKey(key: string): void {
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem('thesportsdb_api_key', key);
        } catch (e) {
            console.error('Could not access localStorage to set API key:', e);
        }
    }
}
