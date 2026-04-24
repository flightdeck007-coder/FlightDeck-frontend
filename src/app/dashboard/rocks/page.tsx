'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RocksProvider } from '@/contexts/RocksContext';
import { TodosProvider } from '@/contexts/TodosContext';
import { IssuesProvider } from '@/contexts/IssuesContext';
import { HeadlinesProvider } from '@/contexts/HeadlinesContext';
import { RocksSegmentView } from '@/components/meeting/RocksSegmentView';
import { CreatePopup, type CreatePopupLinkedEntity } from '@/components/meeting/CreatePopup';
import { useMeetingsData } from '@/hooks/useMeetingsData';

export default function RocksPage() {
  const {
    organizationId,
    teams,
    selectedTeamId,
    setSelectedTeamId,
    meetings,
    isLoading: teamsLoading,
    selectedTeam,
    fileStorageMeetingId,
  } = useMeetingsData();
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message' | undefined>(undefined);
  const [createTitle, setCreateTitle] = useState<string | undefined>(undefined);
  const [createDescription, setCreateDescription] = useState<string | undefined>(undefined);
  const [createLinkedEntity, setCreateLinkedEntity] = useState<CreatePopupLinkedEntity | undefined>(undefined);

  const teamName = selectedTeam?.name ?? 'No team found';
  const meetingAttendances = (selectedTeam?.members ?? []).map((m) => ({
    id: m.user.id,
    user: { id: m.user.id, name: m.user.name ?? null, email: m.user.email },
  }));

  const fallbackMeetingId =
    meetings.find((m) => !selectedTeamId || m.teamId === selectedTeamId)?.id;

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
              <h1 className="text-2xl font-semibold text-foreground">Waypoints</h1>
              <p className="text-sm text-muted-foreground mt-1">
                View and manage waypoints across all flight reviews for this crew.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCreateType('rock');
                setCreateTitle(undefined);
                setCreateDescription(undefined);
                setCreateLinkedEntity(undefined);
                setCreateOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
            >
              + Add Waypoint
            </button>
          </div>
        </div>
        <RocksProvider
          organizationId={organizationId}
          teamId={selectedTeamId || undefined}
          fallbackMeetingId={fallbackMeetingId}
        >
          <IssuesProvider organizationId={organizationId} teamId={selectedTeamId || undefined} meetingId={undefined}>
            <TodosProvider meetingId={undefined} organizationId={organizationId} teamId={selectedTeamId || undefined}>
              <HeadlinesProvider organizationId={organizationId} teamId={selectedTeamId || undefined} fallbackMeetingId={fallbackMeetingId}>
                <div className="flex-1 min-h-0 flex flex-col">
                  <RocksSegmentView
                    sectionTitle="Waypoint Review"
                    organizationId={organizationId}
                    teamId={selectedTeamId || undefined}
                    teamName={teamName}
                    fileStorageMeetingId={fileStorageMeetingId}
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
                  meetingAttendances={meetingAttendances}
                  attachmentMeetingId={fileStorageMeetingId}
                />
              </HeadlinesProvider>
            </TodosProvider>
          </IssuesProvider>
        </RocksProvider>
      </div>
    </DashboardLayout>
  );
}
