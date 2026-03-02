'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '@/contexts/ThemeContext';

interface ThemeToggleProps {
  /** Optional class for the wrapper */
  className?: string;
  /** Optional size: 'sm' (default for nav), 'md' */
  size?: 'sm' | 'md';
  /** Controlled mode: when provided, toggle uses this and calls onToggle instead of context */
  theme?: Theme;
  onToggle?: () => void;
}

export function ThemeToggle({ className = '', size = 'sm', theme: controlledTheme, onToggle }: ThemeToggleProps) {
  const context = useTheme();
  const theme = controlledTheme ?? context.theme;
  const handleClick = onToggle ?? context.toggleTheme;
  const isDark = theme === 'dark';

  const iconClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const trackClass = size === 'sm' ? 'w-12 h-6' : 'w-14 h-7';
  const knobBase = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  const knobLight = size === 'sm' ? 'left-0.5' : 'left-1';
  const knobDark = size === 'sm' ? 'left-[1.625rem]' : 'left-[1.75rem]';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={handleClick}
      className={`${trackClass} rounded-full border border-border bg-accent relative inline-block transition-colors hover:bg-accent/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${className}`}
    >
      <span
        className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground shadow-sm transition-all duration-200 ease-out z-10 flex items-center justify-center ${knobBase} ${isDark ? knobDark : knobLight}`}
        aria-hidden
      >
        {isDark ? (
          <Moon className={iconClass} />
        ) : (
          <Sun className={iconClass} />
        )}
      </span>
    </button>
  );
}
