'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ROUTES } from '@/lib/constants/routes';
import { FLIGHT_TERMS } from '@/lib/constants/flightTerminology';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart3,
  Calendar,
  CheckSquare,
  Target,
  AlertTriangle,
  TrendingUp,
  LogOut,
  Building2,
  Users,
  UserCog,
  Settings,
} from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';

const sidebarLinks = [
  { href: ROUTES.OVERVIEW, label: FLIGHT_TERMS.OVERVIEW, icon: BarChart3 },
  { href: ROUTES.MEETINGS, label: FLIGHT_TERMS.MEETINGS, icon: Calendar },
  { href: ROUTES.ORGANIZATIONS, label: FLIGHT_TERMS.ORGANIZATIONS, icon: Building2 },
  { href: ROUTES.ORGANIZATIONS_MEMBERS, label: FLIGHT_TERMS.MEMBERS, icon: UserCog },
  { href: ROUTES.TEAMS, label: FLIGHT_TERMS.TEAMS, icon: Users },
  { href: ROUTES.TODOS, label: FLIGHT_TERMS.TODOS, icon: CheckSquare },
  { href: ROUTES.ROCKS, label: FLIGHT_TERMS.ROCKS, icon: Target },
  { href: ROUTES.ISSUES, label: FLIGHT_TERMS.ISSUES, icon: AlertTriangle },
  { href: ROUTES.SCORECARD, label: FLIGHT_TERMS.SCORECARD, icon: TrendingUp },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { openSettings } = useSettings();
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgRole, setOrgRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const loadOrgInfo = () => {
      const name = localStorage.getItem('organizationName');
      const role = localStorage.getItem('organizationRole');
      if (name) setOrgName(name);
      if (role) setOrgRole(role);
    };
    
    loadOrgInfo();
    
    // Listen for role changes
    const handleRoleChange = (event: CustomEvent) => {
      if (event.detail?.role) {
        setOrgRole(event.detail.role);
      }
    };
    
    window.addEventListener('organizationRoleChanged', handleRoleChange as EventListener);
    
    return () => {
      window.removeEventListener('organizationRoleChanged', handleRoleChange as EventListener);
    };
  }, []);

  return (
    <div className="h-full bg-card border-r border-border flex flex-col">
      {/* Logo/Header - clickable, goes to home; then user email, org name and role */}
      <div className="p-6 border-b border-border">
        <Link href="/" className="block focus:outline-none focus:ring-2 focus:ring-primary/50 rounded">
          <h1 className="text-xl font-semibold text-foreground hover:text-primary transition-colors">FlightDeck</h1>
        </Link>
        {user && (
          <p className="text-sm text-foreground/70 mt-1">{user.email}</p>
        )}
        {(orgName || orgRole) && (
          <p className="text-sm text-foreground/70 mt-1">
            {orgName && <span className="font-medium text-foreground">{orgName}</span>}
            {orgName && ' · '}
            <span>{orgRole ?? 'MEMBER'}</span>
          </p>
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
                  : 'text-foreground/70 hover:bg-primary/10 hover:text-primary'
              }`}
            >
              <link.icon className="w-5 h-5" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Settings + Logout */}
      <div className="p-4 border-t border-border space-y-1">
        <button
          type="button"
          onClick={openSettings}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-md text-foreground hover:bg-foreground/10 transition-colors"
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-md text-foreground hover:bg-foreground/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
