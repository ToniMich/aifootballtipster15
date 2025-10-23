// FIX: Re-implementing theme functions to resolve module error and restore theme persistence.
// The file was previously empty but was still being imported in App.tsx, causing a build error.

export function getTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') {
        return 'light';
    }
    
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || storedTheme === 'light') {
        return storedTheme;
    }
    
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }

    return 'light';
}

export function setTheme(theme: 'light' | 'dark'): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem('theme', theme);
    }
}
