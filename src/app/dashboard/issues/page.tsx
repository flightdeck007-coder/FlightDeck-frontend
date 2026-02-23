'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function IssuesPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-foreground mb-6">Turbulence (Issues)</h1>
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-foreground/70">Turbulence list coming soon...</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
