'use client';

import { ReactNode } from 'react';

export function MeetingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {children}
    </div>
  );
}
