'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/constants/routes';
import { FLIGHT_TERMS } from '@/lib/constants/flightTerminology';
import { meetingsService, Meeting, type MeetingRecapData } from '@/lib/api/meetings.service';
import { teamsService, Team } from '@/lib/api/teams.service';
import { Calendar, Users, Clock } from 'lucide-react';
import { ButtonLoader } from '@/components/ui/loaders';
import { PastMeetingRecapPanel } from '@/components/meeting/PastMeetingRecapPanel';

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
  const [selectedRecap, setSelectedRecap] = useState<MeetingRecapData | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [continueMeetingModal, setContinueMeetingModal] = useState<Meeting | null>(null);
  const [resumingMeetingId, setResumingMeetingId] = useState<string | null>(null);

  const RESUME_MEETING_KEY = 'meeting-app-resumeMeetingId';

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
    meetingsService
      .getRecap(organizationId, selectedPastMeeting.id)
      .then((data) => {
        if (!cancelled && data) setSelectedRecap(data);
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
              onClick={() => void handleStartMeeting()}
              disabled={schedulingMeeting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {schedulingMeeting ? (
                <>
                  <ButtonLoader className="border-primary-foreground border-t-transparent" />
                  Scheduling…
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  {FLIGHT_TERMS.START_MEETING}
                </>
              )}
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
            {meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => {
                  if (meeting.endedAt) {
                    setSelectedPastMeeting(meeting);
                    setSelectedRecap(null);
                  } else if (meeting.suspendedAt) {
                    setContinueMeetingModal(meeting);
                  } else {
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
                  <div className="text-right">
                    {meeting.endedAt ? (
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm">
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
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm">
                        Scheduled
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedPastMeeting && organizationId && selectedPastMeeting.teamId && (
          <PastMeetingRecapPanel
            meeting={selectedPastMeeting}
            recap={selectedRecap ?? getDefaultRecap(selectedPastMeeting)}
            recapLoading={recapLoading}
            organizationId={organizationId}
            teamId={selectedPastMeeting.teamId}
            onClose={() => {
              setSelectedPastMeeting(null);
              setSelectedRecap(null);
            }}
          />
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
                    className="px-4 py-2 border border-border rounded-md hover:bg-muted text-sm font-medium"
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
      </div>
    </DashboardLayout>
  );
}

function getDefaultRecap(meeting: Meeting): MeetingRecapData {
  return {
    todosCreated: [
      { id: '1', title: 'testing', assigneeInitials: 'GS' },
    ],
    issuesSolved: [],
    shortTermStats: {
      totalTracked: 2,
      solvedLastMeeting: 0,
      solvedToday: 0,
      solveRatePercent: 0,
    },
    sectionDurations: meeting.sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s, i) => ({
        sectionTitle: s.title,
        durationMMSS: i === 0 ? '04:23' : '00:00',
      })),
    ratings: meeting.attendances.map((a) => ({
      userName: a.user.name || a.user.email || 'Attendee',
      rating: null,
    })),
  };
}
