'use client';

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MeetingSocketProvider } from '@/contexts/MeetingSocketContext';
import { RocksProvider } from '@/contexts/RocksContext';
import { HeadlinesProvider } from '@/contexts/HeadlinesContext';
import { TodosProvider } from '@/contexts/TodosContext';
import { IssuesProvider } from '@/contexts/IssuesContext';
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
  const scorecardMeetingId = useMemo(() => {
    const teamMeetings = meetings.filter((m) => m.teamId === selectedTeamId);
    if (teamMeetings.length === 0) return fallbackMeetingId;
    return [...teamMeetings].sort((a, b) => {
      const aTs = new Date(a.scheduledAt || 0).getTime();
      const bTs = new Date(b.scheduledAt || 0).getTime();
      return aTs - bTs;
    })[0]?.id;
  }, [meetings, selectedTeamId, fallbackMeetingId]);

  useEffect(() => {
    if (!organizationId || !scorecardMeetingId) {
      setSelectedMeeting(null);
      return;
    }
    meetingsService
      .findOne(organizationId, scorecardMeetingId)
      .then(setSelectedMeeting)
      .catch(() => setSelectedMeeting(null));
  }, [organizationId, scorecardMeetingId]);

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
      <div className="flex flex-col min-h-0 h-full">
        <header className="shrink-0 px-6 pt-6 pb-4 border-b border-border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Flight Desk</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Key metrics and measurables for your flight crew dashboard.
              </p>
            </div>
          </div>
        </header>

        {!scorecardMeetingId ? (
          <div className="flex-1 flex items-center justify-center px-6 py-8">
            <div className="w-full max-w-md rounded-xl border border-border bg-muted/20 px-6 py-10 text-center">
              <p className="text-muted-foreground">No flight review found for this crew yet.</p>
            </div>
          </div>
        ) : (
          <MeetingSocketProvider meetingId={scorecardMeetingId} organizationId={organizationId}>
            <RocksProvider organizationId={organizationId} teamId={selectedTeamId || undefined} fallbackMeetingId={scorecardMeetingId}>
              <HeadlinesProvider organizationId={organizationId} teamId={selectedTeamId || undefined} fallbackMeetingId={scorecardMeetingId}>
                <TodosProvider meetingId={undefined} organizationId={organizationId} teamId={selectedTeamId || undefined}>
                  <IssuesProvider organizationId={organizationId} teamId={selectedTeamId || undefined} meetingId={undefined}>
                    <div className="flex-1 min-h-0 flex flex-col">
                      <InstrumentsSegmentView
                        teamName={teamName}
                        teamId={selectedTeamId || undefined}
                        meetingId={scorecardMeetingId}
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
                  </IssuesProvider>
                </TodosProvider>
              </HeadlinesProvider>
            </RocksProvider>
          </MeetingSocketProvider>
        )}
      </div>
    </DashboardLayout>
  );
}
