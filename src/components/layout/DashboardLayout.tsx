'use client';

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export function DashboardLayout({ children }: { children: ReactNode }) {
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
