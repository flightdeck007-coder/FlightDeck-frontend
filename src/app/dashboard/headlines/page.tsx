'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MeetingSocketProvider } from '@/contexts/MeetingSocketContext';
import { HeadlinesProvider } from '@/contexts/HeadlinesContext';
import { HeadlinesSegmentView } from '@/components/meeting/HeadlinesSegmentView';
import { CreatePopup } from '@/components/meeting/CreatePopup';
import { useMeetingsData } from '@/hooks/useMeetingsData';
import { meetingsService } from '@/lib/api/meetings.service';
import { Select } from 'antd';
import { formatDate } from '@/lib/formatDate';

export default function HeadlinesPage() {
  const {
    organizationId,
    teams,
    selectedTeamId,
    setSelectedTeamId,
    meetings,
    isLoading: teamsLoading,
    selectedTeam,
  } = useMeetingsData();
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | undefined>(undefined);
  const [selectedMeeting, setSelectedMeeting] = useState<Awaited<ReturnType<typeof meetingsService.findOne>> | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message' | undefined>(undefined);

  const teamName = selectedTeam?.name ?? 'No team found';

  useEffect(() => {
    if (!organizationId || !selectedMeetingId) {
      setSelectedMeeting(null);
      return;
    }
    meetingsService
      .findOne(organizationId, selectedMeetingId)
      .then(setSelectedMeeting)
      .catch(() => setSelectedMeeting(null));
  }, [organizationId, selectedMeetingId]);

  const meetingOptions = meetings.map((m) => ({
    label: `${m.series?.name ?? 'Meeting'} – ${formatDate(m.scheduledAt)}`,
    value: m.id,
  }));

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
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Flight Announcements</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Headlines and cascading messages are per meeting. Select a meeting to view or edit.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={selectedTeamId || undefined}
              onChange={(v) => {
                setSelectedTeamId(v ?? '');
                setSelectedMeetingId(undefined);
              }}
              options={teams.map((t) => ({ label: t.name, value: t.id }))}
              className="min-w-[180px]"
              placeholder="Select team"
            />
            <Select
              value={selectedMeetingId ?? undefined}
              onChange={(v) => setSelectedMeetingId(v || undefined)}
              options={[{ label: 'Select meeting…', value: '' }, ...meetingOptions]}
              className="min-w-[220px]"
              placeholder="Select meeting"
            />
          </div>
        </div>

        {!selectedMeetingId ? (
          <div className="flex-1 flex items-center justify-center rounded-xl border border-border bg-muted/20">
            <p className="text-muted-foreground">Select a team and meeting to view headlines.</p>
          </div>
        ) : (
          <MeetingSocketProvider meetingId={selectedMeetingId} organizationId={organizationId}>
            <HeadlinesProvider meetingId={selectedMeetingId} organizationId={organizationId}>
              <div className="flex-1 min-h-0 flex flex-col">
                <HeadlinesSegmentView
                  teamName={teamName}
                  meetingId={selectedMeetingId}
                  canRecord
                  onOpenCreate={(type) => {
                    setCreateType(type);
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
            </HeadlinesProvider>
          </MeetingSocketProvider>
        )}
      </div>
    </DashboardLayout>
  );
}
