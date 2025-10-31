

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

export function getSupabaseCredentials(): { url: string | null; key: string | null } {
    if (typeof window === 'undefined') {
        return { url: null, key: null };
    }
    try {
        const url = localStorage.getItem('supabase_url');
        const key = localStorage.getItem('supabase_anon_key');
        return { url, key };
    } catch (e) {
        console.error('Could not access localStorage for Supabase credentials:', e);
        return { url: null, key: null };
    }
}

export function setSupabaseCredentials(url: string, key: string): void {
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem('supabase_url', url);
            localStorage.setItem('supabase_anon_key', key);
        } catch (e) {
            console.error('Could not access localStorage to set Supabase credentials:', e);
        }
    }
}
