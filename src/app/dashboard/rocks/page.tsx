'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MeetingSocketProvider } from '@/contexts/MeetingSocketContext';
import { RocksProvider } from '@/contexts/RocksContext';
import { RocksSegmentView } from '@/components/meeting/RocksSegmentView';
import { CreatePopup } from '@/components/meeting/CreatePopup';
import { useMeetingsData } from '@/hooks/useMeetingsData';
import { meetingsService } from '@/lib/api/meetings.service';
import { Select } from 'antd';
import { formatDate } from '@/lib/formatDate';

export default function RocksPage() {
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
  const [createTitle, setCreateTitle] = useState<string | undefined>(undefined);
  const [createDescription, setCreateDescription] = useState<string | undefined>(undefined);
  const [createLinkedEntity, setCreateLinkedEntity] = useState<{ type: 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message'; id: string; title: string } | undefined>(undefined);

  const teamName = selectedTeam?.name ?? 'Leadership Team';
  const meetingAttendances = (selectedTeam?.members ?? []).map((m) => ({
    id: m.user.id,
    user: { id: m.user.id, name: m.user.name ?? null, email: m.user.email },
  }));

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
            <h1 className="text-2xl font-semibold text-foreground">Waypoints (Rocks)</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Rocks are per meeting. Select a meeting to view or edit its waypoints.
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
            <p className="text-muted-foreground">Select a team and meeting to view waypoints (rocks).</p>
          </div>
        ) : (
          <MeetingSocketProvider meetingId={selectedMeetingId} organizationId={organizationId}>
            <RocksProvider meetingId={selectedMeetingId} organizationId={organizationId}>
              <div className="flex-1 min-h-0 flex flex-col">
                <RocksSegmentView
                  sectionTitle="Waypoint Review (Rocks)"
                  meetingId={selectedMeetingId}
                  canRecord
                  onOpenCreate={(type, options) => {
                    setCreateType(type);
                    setCreateTitle(options?.title);
                    setCreateDescription(options?.description);
                    setCreateLinkedEntity(options?.linkedEntity);
                    setCreateOpen(true);
                  }}
                />
              </div>

              <CreatePopup
                open={createOpen}
                onClose={() => {
                  setCreateOpen(false);
                  setCreateType(undefined);
                  setCreateTitle(undefined);
                  setCreateDescription(undefined);
                  setCreateLinkedEntity(undefined);
                }}
                teamName={teamName}
                teamId={selectedTeamId || undefined}
                teams={teams}
                organizationId={organizationId}
                initialType={createType}
                initialTitle={createTitle}
                initialDescription={createDescription}
                initialLinkedEntity={createLinkedEntity}
                meetingAttendances={selectedMeeting?.attendances ?? meetingAttendances}
              />
            </RocksProvider>
          </MeetingSocketProvider>
        )}
      </div>
    </DashboardLayout>
  );
}
