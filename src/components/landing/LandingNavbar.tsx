'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { Plane, LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useSettings } from '@/contexts/SettingsContext';

function getInitials(name?: string | null, email?: string) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return '?';
}

export function LandingNavbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { openSettings } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
  };

  const initials = user ? getInitials(user.name, user.email) : '?';

  return (
    <nav className="w-full border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Plane className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold text-foreground">FlightDeck</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="#about" className="text-foreground/70 hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="#features" className="text-foreground/70 hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#faq" className="text-foreground/70 hover:text-foreground transition-colors">
              FAQ
            </Link>
          </div>

          {/* Auth: avatar menu when logged in, Login/Signup when not */}
          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  aria-label="User menu"
                >
                  {initials}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 py-1 rounded-lg border border-border bg-card shadow-lg z-50">
                    <div className="px-4 py-2 border-b border-border">
                      <p className="text-sm font-medium text-foreground truncate">{user.name || user.email}</p>
                      <p className="text-xs text-foreground/60 truncate">{user.email}</p>
                    </div>
                    <Link
                      href={ROUTES.DASHBOARD}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-foreground/10 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); openSettings(); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-foreground/10 transition-colors text-left"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-foreground/10 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <ThemeToggle size="sm" />
                <Link
                  href={ROUTES.LOGIN}
                  className="px-4 py-2 text-foreground hover:text-primary transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href={ROUTES.SIGNUP}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
