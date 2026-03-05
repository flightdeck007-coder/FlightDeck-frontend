'use client';

import { useState, useEffect, useCallback } from 'react';
import { Select } from 'antd';
import { useMeetingsData } from '@/hooks/useMeetingsData';
import type { Meeting } from '@/lib/api/meetings.service';
import { meetingsService } from '@/lib/api/meetings.service';
import { PastMeetingRecapPanel } from '@/components/meeting/PastMeetingRecapPanel';
import { SimpleTable } from '@/components/ui/SimpleTable';
import { formatDate, formatDuration } from '@/lib/formatDate';

function getFacilitatorName(meeting: Meeting): string {
  if (!meeting.facilitatorId) return '—';
  const att = meeting.attendances?.find((a) => a.user?.id === meeting.facilitatorId);
  return att?.user?.name || att?.user?.email || '—';
}

export default function MeetingsPastPage() {
  const {
    organizationId,
    teams,
    selectedTeamId,
    setSelectedTeamId,
    meetings,
    setMeetings,
    isLoading,
    refetch,
  } = useMeetingsData();

  const [selectedPastMeeting, setSelectedPastMeeting] = useState<Meeting | null>(null);
  const [selectedRecap, setSelectedRecap] = useState<import('@/lib/api/meetings.service').MeetingRecapData | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [orgRole, setOrgRole] = useState<string | null>(null);

  const now = Date.now();
  const pastMeetings = meetings.filter((m) => m.endedAt || m.cancelledAt);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('organizationRole') : null;
    setOrgRole(stored ?? null);
  }, []);

  useEffect(() => {
    if (!selectedPastMeeting || !organizationId) {
      setSelectedRecap(null);
      return;
    }
    setRecapLoading(true);
    meetingsService
      .getRecap(organizationId, selectedPastMeeting.id)
      .then((data) => setSelectedRecap(data ?? null))
      .catch(() => setSelectedRecap(null))
      .finally(() => setRecapLoading(false));
  }, [organizationId, selectedPastMeeting?.id]);

  const handleCloseRecap = useCallback(() => {
    setSelectedPastMeeting(null);
    setSelectedRecap(null);
  }, []);

  const handleRecapDeleted = useCallback(() => {
    setSelectedPastMeeting(null);
    setSelectedRecap(null);
    refetch();
  }, [refetch]);

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Meeting History</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your team&apos;s meetings, in one place.
            </p>
          </div>
          <Select
            value={selectedTeamId || undefined}
            onChange={(v) => setSelectedTeamId(v ?? '')}
            options={teams.map((t) => ({ label: t.name, value: t.id }))}
            className="min-w-[180px]"
            placeholder="Select team"
          />
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-4 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">
              Past meetings <span className="text-muted-foreground font-normal">{pastMeetings.length}</span>
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Click a row to view recap and notes.
            </p>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : pastMeetings.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No past meetings.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <SimpleTable
                columns={[
                  { key: 'date', label: 'Date' },
                  { key: 'agenda', label: 'Agenda' },
                  { key: 'duration', label: 'Duration' },
                  { key: 'facilitator', label: 'Facilitator' },
                  { key: 'rating', label: 'Rating' },
                ]}
              >
                {pastMeetings.map((meeting) => (
                  <tr
                    key={meeting.id}
                    className="border-b border-border/30 last:border-b-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => {
                      if (meeting.endedAt || meeting.cancelledAt) {
                        setSelectedPastMeeting(meeting);
                        setSelectedRecap(null);
                      }
                    }}
                  >
                    <td className="px-4 py-3 text-sm text-foreground">
                      {formatDate(meeting.scheduledAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {meeting.series.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDuration(meeting.startedAt, meeting.endedAt ?? undefined)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {getFacilitatorName(meeting)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">—</td>
                  </tr>
                ))}
              </SimpleTable>
            </div>
          )}
        </div>
      </div>

      {selectedPastMeeting && organizationId && (
        <PastMeetingRecapPanel
          meeting={selectedPastMeeting}
          recap={selectedRecap}
          recapLoading={recapLoading}
          organizationId={organizationId}
          teamId={selectedPastMeeting.teamId}
          orgRole={orgRole}
          onClose={handleCloseRecap}
          onDeleted={handleRecapDeleted}
        />
      )}
    </>
  );
}
