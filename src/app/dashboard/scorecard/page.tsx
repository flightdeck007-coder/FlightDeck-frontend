'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { InstrumentsSegmentView } from '@/components/meeting/InstrumentsSegmentView';
import { Plus } from 'lucide-react';

export default function ScorecardPage() {
  const teamName = 'Leadership Team';
  return (
    <DashboardLayout>
      <div className="p-6 flex flex-col min-h-0 h-full">
        <div className="flex items-start justify-between gap-4 mb-6 shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Instrument Panel – {teamName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Record and evaluate key metrics, streamlined for strategic success.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium">
              GS
            </div>
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Create
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <InstrumentsSegmentView teamName={teamName} />
        </div>
      </div>
    </DashboardLayout>
  );
}
