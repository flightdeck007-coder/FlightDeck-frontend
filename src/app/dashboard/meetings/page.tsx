'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/constants/routes';
import { meetingsService, Meeting } from '@/lib/api/meetings.service';
import { teamsService, Team } from '@/lib/api/teams.service';
import { Calendar, Users, Clock } from 'lucide-react';

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [orgRole, setOrgRole] = useState<string | null>(null);

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
      setError('Set a current organization first (Dashboard → Organizations).');
      return;
    }
    if (!selectedTeamId) {
      setError('Create/select a team first (Dashboard → Teams).');
      return;
    }

    try {
      setError('');
      const meeting = await meetingsService.create(organizationId, {
        teamId: selectedTeamId,
        meetingSeriesName: 'Weekly L10',
        scheduledAt: new Date().toISOString(),
      });
      // refresh list
      const updated = await meetingsService.findAll(organizationId, selectedTeamId);
      setMeetings(updated);
      router.push(ROUTES.MEETING(meeting.id));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to start meeting');
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

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Meetings</h1>
          {orgRole === 'ADMIN' || orgRole === 'MANAGER' ? (
            <button
              onClick={handleStartMeeting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Start a Meeting
            </button>
          ) : (
            <span className="text-sm text-foreground/60">
              Only Admins/Managers can start meetings.
            </span>
          )}
        </div>

        {/* Team selector - all roles see their team(s) and meetings for that team */}
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <span className="text-sm text-foreground/70">Team:</span>
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
              ? 'You can create, run, and end meetings. Members can view history and join.'
              : 'You can view meeting history and join scheduled meetings for your team.'}
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
              No meetings yet for this team.
              {orgRole === 'ADMIN' || orgRole === 'MANAGER'
                ? ' Click "Start a Meeting" to begin an L10-style meeting.'
                : ' When your admin or manager starts one, it will appear here and you can join.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => router.push(ROUTES.MEETING(meeting.id))}
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
      </div>
    </DashboardLayout>
  );
}
