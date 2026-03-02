'use client';

import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/constants/routes';
import { FLIGHT_TERMS } from '@/lib/constants/flightTerminology';
import { meetingsService, Meeting, type MeetingRecapData } from '@/lib/api/meetings.service';
import { teamsService, Team } from '@/lib/api/teams.service';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Users, Clock } from 'lucide-react';
import { ButtonLoader } from '@/components/ui/loaders';
import { PastMeetingRecapPanel } from '@/components/meeting/PastMeetingRecapPanel';
import { StartMeetingModal } from '@/components/meeting/StartMeetingModal';
import { ScheduleMeetingModal } from '@/components/meeting/ScheduleMeetingModal';
import { MeetingCountdown } from '@/components/meeting/MeetingCountdown';

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [orgRole, setOrgRole] = useState<string | null>(null);
  const [schedulingMeeting, setSchedulingMeeting] = useState(false);
  const [selectedPastMeeting, setSelectedPastMeeting] = useState<Meeting | null>(null);
  const [selectedPastMeetingFull, setSelectedPastMeetingFull] = useState<Meeting | null>(null);
  const [selectedRecap, setSelectedRecap] = useState<MeetingRecapData | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [continueMeetingModal, setContinueMeetingModal] = useState<Meeting | null>(null);
  const [resumingMeetingId, setResumingMeetingId] = useState<string | null>(null);
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [cancelMeetingTarget, setCancelMeetingTarget] = useState<Meeting | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deleteMeetingTarget, setDeleteMeetingTarget] = useState<Meeting | null>(null);
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);
  const [deleteMeetingError, setDeleteMeetingError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const hadFocusRef = useRef(false);

  const { user } = useAuth();

  const hasScheduledFuture = meetings.some(
    (m) => !m.startedAt && !m.endedAt && !m.suspendedAt && new Date(m.scheduledAt).getTime() > Date.now()
  );
  useEffect(() => {
    if (!hasScheduledFuture) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [hasScheduledFuture]);
  const RESUME_MEETING_KEY = 'meeting-app-resumeMeetingId';

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const teamMembers = selectedTeam?.members ?? [];

  useEffect(() => {
    const storedOrgId = typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null;
    const storedRole = typeof window !== 'undefined' ? localStorage.getItem('organizationRole') : null;
    const storedTeamId = typeof window !== 'undefined' ? localStorage.getItem('currentTeamId') : null;
    
    if (storedOrgId) {
      setOrganizationId(storedOrgId);
      if (storedRole) {
        setOrgRole(storedRole);
      }
      void loadTeamsAndMeetings(storedOrgId, storedTeamId);
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedPastMeeting?.id || !organizationId) {
      return;
    }
    let cancelled = false;
    setRecapLoading(true);
    setSelectedPastMeetingFull(null);
    Promise.all([
      meetingsService.getRecap(organizationId, selectedPastMeeting.id),
      meetingsService.findOne(organizationId, selectedPastMeeting.id),
    ])
      .then(([data, meetingFull]) => {
        if (!cancelled && data) setSelectedRecap(data);
        if (!cancelled && meetingFull) setSelectedPastMeetingFull(meetingFull);
      })
      .catch(() => {
        if (!cancelled) setSelectedRecap(null);
      })
      .finally(() => {
        if (!cancelled) setRecapLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPastMeeting?.id, organizationId]);

  // Refetch meetings when user returns to this tab (e.g. after a scheduled meeting or delete elsewhere)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        hadFocusRef.current = true;
        return;
      }
      if (!hadFocusRef.current || !organizationId || !selectedTeamId) return;
      meetingsService.findAll(organizationId, selectedTeamId).then(setMeetings).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [organizationId, selectedTeamId]);

  const loadTeamsAndMeetings = async (orgId: string, preferredTeamId: string | null = null) => {
    try {
      setIsLoading(true);
      setError('');
      const teamList = await teamsService.list(orgId);
      setTeams(teamList);

      // Use preferred team ID if available, otherwise use first team
      const teamId = preferredTeamId && teamList.find((t) => t.id === preferredTeamId)?.id 
        ? preferredTeamId 
        : teamList[0]?.id || '';
      setSelectedTeamId(teamId);

      if (teamId) {
        const data = await meetingsService.findAll(orgId, teamId);
        setMeetings(data);
      } else {
        setMeetings([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMeeting = async () => {
    if (!organizationId) {
      setError('Set a current fleet first (Dashboard → Fleet).');
      return;
    }
    if (!selectedTeamId) {
      setError('Create/select a flight crew first (Dashboard → Flight Crews).');
      return;
    }

    try {
      setError('');
      setSchedulingMeeting(true);
      const meeting = await meetingsService.create(organizationId, {
        teamId: selectedTeamId,
        meetingSeriesName: 'Weekly L10',
        scheduledAt: new Date().toISOString(),
      });
      const updated = await meetingsService.findAll(organizationId, selectedTeamId);
      setMeetings(updated);
      router.push(ROUTES.MEETING(meeting.id));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to start meeting');
    } finally {
      setSchedulingMeeting(false);
    }
  };

  const handleTeamChange = async (teamId: string) => {
    setSelectedTeamId(teamId);
    if (typeof window !== 'undefined' && teamId) {
      localStorage.setItem('currentTeamId', teamId);
    }
    if (!organizationId || !teamId) return;
    try {
      setIsLoading(true);
      setError('');
      const data = await meetingsService.findAll(organizationId, teamId);
      setMeetings(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load meetings');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCancelScheduledMeeting = async () => {
    if (!cancelMeetingTarget || !organizationId) return;
    try {
      setCancellingId(cancelMeetingTarget.id);
      await meetingsService.cancel(organizationId, cancelMeetingTarget.id);
      const data = await meetingsService.findAll(organizationId, selectedTeamId);
      setMeetings(data);
      setCancelMeetingTarget(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to cancel meeting');
    } finally {
      setCancellingId(null);
    }
  };

  const handleContinueSuspendedMeeting = (meeting: Meeting) => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(RESUME_MEETING_KEY, meeting.id);
    }
    setResumingMeetingId(meeting.id);
    setContinueMeetingModal(null);
    router.push(ROUTES.MEETING(meeting.id));
  };

  return (
    <DashboardLayout>
      {/* Full-screen loader when creating a meeting (quick start or schedule) — blocks all interaction */}
      {schedulingMeeting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95" aria-busy="true" aria-live="polite">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" aria-hidden />
            <p className="text-sm font-medium text-foreground">Creating meeting…</p>
          </div>
        </div>
      )}

      {/* Full-screen loader when navigating to resume a suspended meeting */}
      {resumingMeetingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-foreground">Opening meeting…</p>
          </div>
        </div>
      )}

      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Flight Review</h1>
          {orgRole === 'ADMIN' || orgRole === 'MANAGER' ? (
            <button
              onClick={() => setStartModalOpen(true)}
              disabled={schedulingMeeting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Calendar className="w-4 h-4" />
              {FLIGHT_TERMS.START_MEETING}
            </button>
          ) : (
            <span className="text-sm text-foreground/60">
              Only Admins/Managers can start flight reviews.
            </span>
          )}
        </div>

        {/* Team selector - all roles see their team(s) and meetings for that team */}
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <span className="text-sm text-foreground/70">Flight crew:</span>
            <select
              value={selectedTeamId}
              onChange={(e) => void handleTeamChange(e.target.value)}
              className="px-3 py-2 border border-border rounded-md bg-background text-foreground max-w-sm"
            >
              <option value="">Select team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-foreground/60">
            {orgRole === 'ADMIN' || orgRole === 'MANAGER'
              ? 'You can create, run, and end flight reviews. Crew can view history and join.'
              : 'You can view flight review history and join scheduled reviews for your flight crew.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 border border-red-200 bg-red-50 text-sm text-red-700 rounded">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-foreground/70 text-center">Loading meetings...</p>
          </div>
        ) : meetings.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-foreground/70 text-center py-8">
              No flight reviews yet for this crew.
              {orgRole === 'ADMIN' || orgRole === 'MANAGER'
                ? ` Click "${FLIGHT_TERMS.START_MEETING}" to begin a Weekly Flight Review.`
                : ' When your admin or manager starts one, it will appear here and you can join.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {meetings.map((meeting) => {
              const isCancelled = Boolean(meeting.cancelledAt);
              const isScheduledFuture = !isCancelled && !meeting.startedAt && !meeting.endedAt && !meeting.suspendedAt && new Date(meeting.scheduledAt).getTime() > Date.now();
              const canJoin = !isScheduledFuture && !isCancelled;
              const canCancelScheduled = isScheduledFuture && (orgRole === 'ADMIN' || orgRole === 'MANAGER');
              return (
              <div
                key={meeting.id}
                className={`bg-card border border-border rounded-lg p-6 transition-colors ${canJoin || meeting.endedAt || isCancelled ? 'hover:border-primary/50 cursor-pointer' : 'cursor-default opacity-90'}`}
                onClick={() => {
                  if (meeting.endedAt || isCancelled) {
                    setSelectedPastMeeting(meeting);
                    setSelectedRecap(null);
                  } else if (meeting.suspendedAt) {
                    setContinueMeetingModal(meeting);
                  } else if (canJoin) {
                    router.push(ROUTES.MEETING(meeting.id));
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {meeting.series.name} - {meeting.team.name}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-foreground/70">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(meeting.scheduledAt)}</span>
                      </div>
                      {meeting.startedAt && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>Started: {formatDate(meeting.startedAt)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{meeting.attendances.length} attendees</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    {isCancelled ? (
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-md text-sm dark:bg-red-950/50 dark:text-red-300">
                        Cancelled
                      </span>
                    ) : meeting.endedAt ? (
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm dark:bg-gray-800 dark:text-gray-300">
                        Completed
                      </span>
                    ) : meeting.suspendedAt ? (
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold bg-amber-400 text-amber-950 border border-amber-600/50 shadow-sm dark:bg-amber-500 dark:text-amber-950 dark:border-amber-600">
                        <span className="w-2 h-2 rounded-full bg-amber-800 dark:bg-amber-900 animate-pulse" aria-hidden />
                        Suspended
                      </span>
                    ) : meeting.startedAt ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-md text-sm">
                        In Progress
                      </span>
                    ) : (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm dark:bg-blue-950/50 dark:text-blue-300">
                          Scheduled
                        </span>
                        {isScheduledFuture && (
                          <MeetingCountdown scheduledAt={meeting.scheduledAt} className="text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                    )}
                    {canCancelScheduled && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setCancelMeetingTarget(meeting); }}
                        className="px-3 py-1.5 text-sm border border-border rounded-md text-foreground hover:bg-foreground/10 transition-colors"
                      >
                        Cancel meeting
                      </button>
                    )}
                    {(isScheduledFuture || isCancelled) && orgRole === 'ADMIN' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteMeetingTarget(meeting);
                          setDeleteMeetingError(null);
                        }}
                        className="px-3 py-1.5 text-sm border border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}

        {selectedPastMeeting && organizationId && selectedPastMeeting.teamId && (
          <PastMeetingRecapPanel
            meeting={selectedPastMeetingFull ?? selectedPastMeeting}
            recap={selectedRecap ?? getDefaultRecap(selectedPastMeeting)}
            recapLoading={recapLoading}
            organizationId={organizationId}
            teamId={selectedPastMeeting.teamId}
            orgRole={orgRole}
            onClose={() => {
              setSelectedPastMeeting(null);
              setSelectedPastMeetingFull(null);
              setSelectedRecap(null);
            }}
            onDeleted={async () => {
              setSelectedPastMeeting(null);
              setSelectedPastMeetingFull(null);
              setSelectedRecap(null);
              if (organizationId && selectedTeamId) {
                const data = await meetingsService.findAll(organizationId, selectedTeamId);
                setMeetings(data);
              }
            }}
          />
        )}

        {/* Cancel scheduled meeting confirmation */}
        {cancelMeetingTarget && (
          <>
            <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setCancelMeetingTarget(null)} aria-hidden />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">Cancel scheduled meeting?</h3>
                <p className="text-sm text-foreground/70 mb-4">
                  This meeting will be marked as cancelled. You can still view it in history.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCancelMeetingTarget(null)}
                    className="px-4 py-2 border border-border rounded-md hover:bg-foreground/10 text-sm font-medium"
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCancelScheduledMeeting()}
                    disabled={cancellingId === cancelMeetingTarget.id}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-70 text-sm font-medium"
                  >
                    {cancellingId === cancelMeetingTarget.id ? 'Cancelling…' : 'Cancel meeting'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Delete meeting confirmation (scheduled or cancelled) */}
        {deleteMeetingTarget && (
          <>
            <div className="fixed inset-0 bg-black/20 z-40" onClick={() => { setDeleteMeetingTarget(null); setDeleteMeetingError(null); }} aria-hidden />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">Delete this meeting?</h3>
                <p className="text-sm text-foreground/70 mb-4">
                  This will permanently remove the meeting from the database. This cannot be undone.
                </p>
                {deleteMeetingError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mb-3" role="alert">
                    {deleteMeetingError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setDeleteMeetingTarget(null); setDeleteMeetingError(null); }}
                    className="px-4 py-2 border border-border rounded-md hover:bg-foreground/10 text-sm font-medium"
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const meeting = deleteMeetingTarget;
                      const orgId = meeting.team?.organizationId ?? organizationId;
                      if (!orgId) {
                        setDeleteMeetingError('Organization not found for this meeting.');
                        return;
                      }
                      setDeletingMeetingId(meeting.id);
                      setDeleteMeetingError(null);
                      try {
                        await meetingsService.remove(orgId, meeting.id);
                        setDeleteMeetingTarget(null);
                        if (selectedPastMeeting?.id === meeting.id) {
                          setSelectedPastMeeting(null);
                          setSelectedPastMeetingFull(null);
                          setSelectedRecap(null);
                        }
                        if (organizationId && selectedTeamId) {
                          const data = await meetingsService.findAll(organizationId, selectedTeamId);
                          setMeetings(data);
                        }
                      } catch (err: unknown) {
                        const status = err && typeof err === 'object' && 'response' in err
                          ? (err as { response?: { status?: number } }).response?.status
                          : null;
                        const msg = err && typeof err === 'object' && 'response' in err
                          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
                          : null;
                        setDeleteMeetingError(
                          status === 404
                            ? 'Meeting not found. It may have been deleted already.'
                            : msg || 'Failed to delete meeting. Try again.'
                        );
                      } finally {
                        setDeletingMeetingId(null);
                      }
                    }}
                    disabled={deletingMeetingId === deleteMeetingTarget.id}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-70 text-sm font-medium"
                  >
                    {deletingMeetingId === deleteMeetingTarget.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Continue suspended meeting confirmation */}
        {continueMeetingModal && (
          <>
            <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setContinueMeetingModal(null)} aria-hidden />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">Continue meeting?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You&apos;ll resume from where you left off. Continue?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setContinueMeetingModal(null)}
                    className="px-4 py-2 border border-border rounded-md hover:bg-foreground/10 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleContinueSuspendedMeeting(continueMeetingModal)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
                  >
                    Yes, continue
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Start meeting: quick vs schedule */}
        {startModalOpen && (
          <StartMeetingModal
            onClose={() => setStartModalOpen(false)}
            onQuickStart={() => void handleStartMeeting()}
            onSchedule={() => { setStartModalOpen(false); setScheduleModalOpen(true); }}
            isStarting={schedulingMeeting}
          />
        )}

        {/* Schedule meeting: date, time, facilitator */}
        {scheduleModalOpen && organizationId && selectedTeamId && selectedTeam && user && (
          <ScheduleMeetingModal
            organizationId={organizationId}
            teamId={selectedTeamId}
            teamName={selectedTeam.name}
            members={teamMembers}
            currentUserId={user.id}
            onClose={() => setScheduleModalOpen(false)}
            onCreatingChange={setSchedulingMeeting}
            onScheduled={async () => {
              const data = await meetingsService.findAll(organizationId, selectedTeamId);
              setMeetings(data);
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function getDefaultRecap(meeting: Meeting): MeetingRecapData {
  return {
    todosCreated: [],
    issuesSolved: [],
    shortTermStats: {
      totalTracked: 0,
      solvedLastMeeting: 0,
      solvedToday: 0,
      solveRatePercent: 0,
    },
    sectionDurations: (meeting.sections ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        sectionTitle: s.title,
        durationMMSS: '00:00',
      })),
    ratings: (meeting.attendances ?? []).map((a) => ({
      userName: a.user?.name || a.user?.email || 'Attendee',
      rating: null as number | null,
    })),
  };
}
