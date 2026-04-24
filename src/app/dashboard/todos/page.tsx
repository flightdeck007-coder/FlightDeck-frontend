'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MeetingSocketProvider } from '@/contexts/MeetingSocketContext';
import { TodosProvider } from '@/contexts/TodosContext';
import { IssuesProvider } from '@/contexts/IssuesContext';
import { TodosSegmentView } from '@/components/meeting/TodosSegmentView';
import { CreatePopup } from '@/components/meeting/CreatePopup';
import { useMeetingsData } from '@/hooks/useMeetingsData';
import { Select } from 'antd';

export default function TodosPage() {
  const {
    organizationId,
    teams,
    selectedTeamId,
    setSelectedTeamId,
    isLoading: teamsLoading,
    selectedTeam,
    fileStorageMeetingId,
  } = useMeetingsData();
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message' | undefined>(undefined);
  const [createTitle, setCreateTitle] = useState<string | undefined>(undefined);
  const [createDescription, setCreateDescription] = useState<string | undefined>(undefined);
  const [createLinkedEntity, setCreateLinkedEntity] = useState<{ type: 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message'; id: string; title: string } | undefined>(undefined);

  const teamName = selectedTeam?.name ?? 'No team found';
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
        <TodosProvider meetingId={undefined} organizationId={organizationId} teamId={selectedTeamId || undefined}>
          <IssuesProvider organizationId={organizationId} teamId={selectedTeamId || undefined} meetingId={undefined}>
            <div className="p-6 flex flex-col min-h-0 h-full">
              <div className="-mx-6 -mt-6 px-6 pt-6 pb-4 border-b border-border bg-white shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-semibold text-foreground">Clearances</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      All to-dos for the team across meetings.
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
                        setCreateType('todo');
                        setCreateTitle(undefined);
                        setCreateDescription(undefined);
                        setCreateLinkedEntity(undefined);
                        setCreateOpen(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
                    >
                      + Add Clearence
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <TodosSegmentView
                  teamName={teamName}
                  teamId={selectedTeamId || undefined}
                  teams={teams.map((t) => ({ id: t.id, name: t.name }))}
                  organizationId={organizationId}
                  meetingId={undefined}
                  fileStorageMeetingId={fileStorageMeetingId}
                  canRecord
                  meetingAttendances={meetingAttendances}
                  onOpenCreate={(type, options) => {
                    setCreateType(type);
                    setCreateTitle(options?.title);
                    setCreateDescription(options?.description);
                    setCreateLinkedEntity(options?.linkedEntity);
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
              attachmentMeetingId={fileStorageMeetingId}
            />
          </IssuesProvider>
        </TodosProvider>
      </MeetingSocketProvider>
    </DashboardLayout>
  );
}
