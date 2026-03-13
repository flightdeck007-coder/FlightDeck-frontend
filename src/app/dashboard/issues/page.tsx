'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MeetingSocketProvider } from '@/contexts/MeetingSocketContext';
import { IssuesProvider } from '@/contexts/IssuesContext';
import { TodosProvider } from '@/contexts/TodosContext';
import { IssuesSegmentView } from '@/components/meeting/IssuesSegmentView';
import { CreatePopup } from '@/components/meeting/CreatePopup';
import { useMeetingsData } from '@/hooks/useMeetingsData';
import { Select } from 'antd';

export default function IssuesPage() {
  const {
    organizationId,
    teams,
    selectedTeamId,
    setSelectedTeamId,
    isLoading: teamsLoading,
    selectedTeam,
  } = useMeetingsData();
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
      <MeetingSocketProvider meetingId={null} organizationId={organizationId}>
        <IssuesProvider organizationId={organizationId} teamId={selectedTeamId || undefined} meetingId={undefined}>
          <TodosProvider meetingId={undefined} organizationId={organizationId} teamId={selectedTeamId || undefined}>
            <div className="p-6 flex flex-col min-h-0 h-full">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4 shrink-0">
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">Turbulence (Issues)</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    All issues for the team across meetings.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={selectedTeamId || undefined}
                    onChange={(v) => setSelectedTeamId(v ?? '')}
                    options={teams.map((t) => ({ label: t.name, value: t.id }))}
                    className="min-w-[180px]"
                    placeholder="Select team"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCreateType('issue');
                      setCreateTitle(undefined);
                      setCreateDescription(undefined);
                      setCreateLinkedEntity(undefined);
                      setCreateOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
                  >
                    + Add Turbulence (Issue)
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <IssuesSegmentView
                  teamName={teamName}
                  meetingId={undefined}
                  canRecord
                  onOpenCreate={(type, options) => {
                    setCreateType(type);
                    setCreateTitle(options?.title);
                    setCreateDescription(options?.description);
                    setCreateLinkedEntity(options?.linkedEntity);
                    setCreateOpen(true);
                  }}
                  onOpenCreateIssue={() => {
                    setCreateType('issue');
                    setCreateTitle(undefined);
                    setCreateDescription(undefined);
                    setCreateLinkedEntity(undefined);
                    setCreateOpen(true);
                  }}
                />
              </div>
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
              meetingAttendances={meetingAttendances}
            />
          </TodosProvider>
        </IssuesProvider>
      </MeetingSocketProvider>
    </DashboardLayout>
  );
}
