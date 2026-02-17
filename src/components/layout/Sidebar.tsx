'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { BarChart3, Calendar, CheckSquare, Target, AlertTriangle, TrendingUp, LogOut } from 'lucide-react';

const sidebarLinks = [
  { href: ROUTES.OVERVIEW, label: 'Overview', icon: BarChart3 },
  { href: ROUTES.MEETINGS, label: 'Meetings', icon: Calendar },
  { href: ROUTES.TODOS, label: 'To-Dos', icon: CheckSquare },
  { href: ROUTES.ROCKS, label: 'Rocks', icon: Target },
  { href: ROUTES.ISSUES, label: 'Issues', icon: AlertTriangle },
  { href: ROUTES.SCORECARD, label: 'Scorecard', icon: TrendingUp },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="h-full bg-card border-r border-border flex flex-col">
      {/* Logo/Header */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">FlightDeck</h1>
        {user && (
          <p className="text-sm text-foreground/70 mt-1">{user.email}</p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {sidebarLinks.map((link) => {
          const isActive = pathname === link.href || pathname?.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-2 rounded-md transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground/70 hover:bg-accent hover:text-foreground'
              }`}
            >
              <link.icon className="w-5 h-5" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-border">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-md text-foreground/70 hover:bg-accent hover:text-foreground transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
