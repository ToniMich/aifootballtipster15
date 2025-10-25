// FIX: Re-implementing theme functions to resolve module error and restore theme persistence.
// The file was previously empty but was still being imported in App.tsx, causing a build error.

export function getTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') {
        return 'dark';
    }
    
    const storedTheme = localStorage.getItem('theme');
    // If the user has explicitly chosen light, use it.
    if (storedTheme === 'light') {
        return 'light';
    }
    
    // Otherwise, default to dark. This covers cases where the theme is 'dark' or not set at all.
    return 'dark';
}

export function setTheme(theme: 'light' | 'dark'): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem('theme', theme);
    }
}