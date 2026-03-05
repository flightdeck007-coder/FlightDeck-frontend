'use client';

import { useState, useEffect, useCallback } from 'react';
import { meetingsService, type Meeting } from '@/lib/api/meetings.service';
import { teamsService, type Team } from '@/lib/api/teams.service';

export interface UseMeetingsDataResult {
  organizationId: string;
  teams: Team[];
  selectedTeamId: string;
  setSelectedTeamId: (id: string) => void;
  meetings: Meeting[];
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  isLoading: boolean;
  refetch: () => Promise<void>;
  currentUserId: string | null;
  selectedTeam: Team | null;
  /** Members of the selected team (for schedule/edit modals). */
  members: Array<{ teamId: string; userId: string; user: { id: string; email: string; name?: string } }>;
}

export function useMeetingsData(): UseMeetingsDataResult {
  const [organizationId, setOrganizationId] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const storedOrgId = typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null;
    const storedTeamId = typeof window !== 'undefined' ? localStorage.getItem('currentTeamId') : null;
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (userStr) {
      try {
        const user = JSON.parse(userStr) as { id?: string };
        setCurrentUserId(user?.id ?? null);
      } catch {
        setCurrentUserId(null);
      }
    }
    if (!storedOrgId) {
      setIsLoading(false);
      return;
    }
    setOrganizationId(storedOrgId);
    teamsService
      .list(storedOrgId)
      .then((list) => {
        setTeams(list);
        const teamId =
          storedTeamId && list.some((t) => t.id === storedTeamId) ? storedTeamId : list[0]?.id ?? '';
        setSelectedTeamId(teamId);
        if (teamId && typeof window !== 'undefined') localStorage.setItem('currentTeamId', teamId);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const refetch = useCallback(async () => {
    if (!organizationId || !selectedTeamId) return;
    const data = await meetingsService.findAll(organizationId, selectedTeamId);
    setMeetings(data);
  }, [organizationId, selectedTeamId]);

  useEffect(() => {
    if (!organizationId || !selectedTeamId) return;
    setIsLoading(true);
    if (typeof window !== 'undefined') localStorage.setItem('currentTeamId', selectedTeamId);
    meetingsService
      .findAll(organizationId, selectedTeamId)
      .then(setMeetings)
      .catch(() => setMeetings([]))
      .finally(() => setIsLoading(false));
  }, [organizationId, selectedTeamId]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null;
  const members = selectedTeam?.members ?? [];

  return {
    organizationId,
    teams,
    selectedTeamId,
    setSelectedTeamId,
    meetings,
    setMeetings,
    isLoading,
    refetch,
    currentUserId,
    selectedTeam,
    members,
  };
}
