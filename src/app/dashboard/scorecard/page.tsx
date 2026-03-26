'use client';

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MeetingSocketProvider } from '@/contexts/MeetingSocketContext';
import { InstrumentsSegmentView } from '@/components/meeting/InstrumentsSegmentView';
import { CreatePopup } from '@/components/meeting/CreatePopup';
import { useMeetingsData } from '@/hooks/useMeetingsData';
import { meetingsService } from '@/lib/api/meetings.service';

export default function ScorecardPage() {
  const {
    organizationId,
    teams,
    selectedTeamId,
    meetings,
    isLoading: teamsLoading,
    selectedTeam,
    currentUserId,
    refetch,
  } = useMeetingsData();
  const [selectedMeeting, setSelectedMeeting] = useState<Awaited<ReturnType<typeof meetingsService.findOne>> | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message' | undefined>(undefined);

  const teamName = selectedTeam?.name ?? 'No team found';
  const fallbackMeetingId = useMemo(
    () => meetings.find((m) => m.teamId === selectedTeamId)?.id,
    [meetings, selectedTeamId]
  );

  useEffect(() => {
    if (!organizationId || !fallbackMeetingId) {
      setSelectedMeeting(null);
      return;
    }
    meetingsService
      .findOne(organizationId, fallbackMeetingId)
      .then(setSelectedMeeting)
      .catch(() => setSelectedMeeting(null));
  }, [organizationId, fallbackMeetingId]);

  if (!organizationId || teamsLoading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
          <div className="h-64 bg-muted/30 rounded-xl animate-pulse" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 flex flex-col min-h-0 h-full">
        <div className="-mx-6 -mt-6 px-6 pt-6 pb-4 border-b border-border bg-white shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Flight Desk</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Key metrics and measurables for your flight crew dashboard.
            </p>
          </div>
        </div>
        </div>

        {!fallbackMeetingId ? (
          <div className="flex-1 flex items-center justify-center rounded-xl border border-border bg-muted/20">
            <p className="text-muted-foreground">No flight review found for this crew yet.</p>
          </div>
        ) : (
          <MeetingSocketProvider meetingId={fallbackMeetingId} organizationId={organizationId}>
            <div className="flex-1 min-h-0 flex flex-col">
              <InstrumentsSegmentView
                teamName={teamName}
                teamId={selectedTeamId || undefined}
                meetingId={fallbackMeetingId}
                organizationId={organizationId}
                currentUserId={currentUserId}
                canRecord
                isMeetingInFuture={false}
                meetingAttendances={selectedMeeting?.attendances}
                onOpenCreate={(type) => {
                  setCreateType(type);
                  setCreateOpen(true);
                }}
                onOpenCreateIssue={() => {
                  setCreateType('issue');
                  setCreateOpen(true);
                }}
              />
            </div>

            <CreatePopup
              open={createOpen}
              onClose={() => {
                setCreateOpen(false);
                setCreateType(undefined);
              }}
              teamName={teamName}
              teamId={selectedTeamId || undefined}
              teams={teams}
              organizationId={organizationId}
              initialType={createType}
              meetingAttendances={selectedMeeting?.attendances}
            />
          </MeetingSocketProvider>
        )}
      </div>
    </DashboardLayout>
  );
}
