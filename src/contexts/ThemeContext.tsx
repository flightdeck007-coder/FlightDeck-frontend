'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const STORAGE_KEY = 'theme';
const PRIMARY_STORAGE_KEY = 'themePrimary';

export type Theme = 'light' | 'dark';

const DEFAULT_PRIMARY = '#C47F19';

/** Derive a lighter accent color from primary (for backgrounds) */
function lighterAccent(hex: string, amount = 0.85): string {
  const n = hex.replace('#', '');
  let r = parseInt(n.slice(0, 2), 16) / 255;
  let g = parseInt(n.slice(2, 4), 16) / 255;
  let b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  const newL = Math.min(1, l + (1 - l) * amount);
  const newS = s * 0.4;
  const c = (1 - Math.abs(2 * newL - 1)) * newS;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = newL - c / 2;
  let nr = 0, ng = 0, nb = 0;
  if (h < 1/6) { nr = c; ng = x; nb = 0; } else if (h < 2/6) { nr = x; ng = c; nb = 0; } else if (h < 3/6) { nr = 0; ng = c; nb = x; } else if (h < 4/6) { nr = 0; ng = x; nb = c; } else if (h < 5/6) { nr = x; ng = 0; nb = c; } else { nr = c; ng = 0; nb = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  primaryColor: string;
  setPrimaryColor: (hex: string) => void;
  applyAppearance: (opts: { theme?: Theme; primaryColor?: string }) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  if (document.documentElement.classList.contains('dark')) return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function getInitialPrimary(): string {
  if (typeof window === 'undefined') return DEFAULT_PRIMARY;
  const stored = localStorage.getItem(PRIMARY_STORAGE_KEY);
  if (stored && /^#[0-9A-Fa-f]{6}$/.test(stored)) return stored;
  return DEFAULT_PRIMARY;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

function applyPrimaryColor(hex: string) {
  const root = document.documentElement;
  root.style.setProperty('--primary', hex);
  root.style.setProperty('--accent', lighterAccent(hex));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());
  const [primaryColor, setPrimaryColorState] = useState<string>(() => getInitialPrimary());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    applyPrimaryColor(primaryColor);
    localStorage.setItem(PRIMARY_STORAGE_KEY, primaryColor);
  }, [primaryColor, mounted]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(() => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')), []);

  const setPrimaryColor = useCallback((hex: string) => {
    const normalized = hex.startsWith('#') ? hex : `#${hex}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(normalized)) setPrimaryColorState(normalized);
  }, []);

  const applyAppearance = useCallback((opts: { theme?: Theme; primaryColor?: string }) => {
    if (opts.theme !== undefined) setThemeState(opts.theme);
    if (opts.primaryColor !== undefined) {
      const hex = opts.primaryColor.startsWith('#') ? opts.primaryColor : `#${opts.primaryColor}`;
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) setPrimaryColorState(hex);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, primaryColor, setPrimaryColor, applyAppearance }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx === undefined) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
