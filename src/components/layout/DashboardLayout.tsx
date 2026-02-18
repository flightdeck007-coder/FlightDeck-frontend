'use client';

import { ReactNode, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { organizationsService } from '@/lib/api/organizations.service';

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Sync current user's org role from API on every dashboard load/refresh so sidebar shows correct role without logout
  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;
    const orgId = localStorage.getItem('organizationId');
    if (!orgId) return;

    organizationsService
      .getMembers(orgId)
      .then((members) => {
        const me = members.find((m) => m.user.id === user.id);
        if (me && me.role) {
          const currentStored = localStorage.getItem('organizationRole');
          if (currentStored !== me.role) {
            localStorage.setItem('organizationRole', me.role);
            window.dispatchEvent(new CustomEvent('organizationRoleChanged', { detail: { role: me.role } }));
          }
        }
      })
      .catch(() => {});
  }, [user?.id]);

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Sidebar - 20% */}
      <div className="w-1/5 min-w-[200px] flex-shrink-0">
        <Sidebar />
      </div>
      
      {/* Main Content - 80% */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
