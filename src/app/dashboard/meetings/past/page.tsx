'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Select } from 'antd';
import { useMeetingsData } from '@/hooks/useMeetingsData';
import type { Meeting, MeetingRecapData } from '@/lib/api/meetings.service';
import { meetingsService } from '@/lib/api/meetings.service';
import { PastMeetingRecapPanel } from '@/components/meeting/PastMeetingRecapPanel';
import { SimpleTable } from '@/components/ui/SimpleTable';
import {
  formatDate,
  formatDuration,
  formatDurationFromSectionDurations,
} from '@/lib/formatDate';

function getFacilitatorName(meeting: Meeting): string {
  if (!meeting.facilitatorId) return '—';
  const att = meeting.attendances?.find((a) => a.user?.id === meeting.facilitatorId);
  return att?.user?.name || att?.user?.email || '—';
}

function getScribeName(meeting: Meeting): string {
  if (!meeting.scribeId) return '—';
  const att = meeting.attendances?.find((a) => a.user?.id === meeting.scribeId);
  return att?.user?.name || att?.user?.email || '—';
}

/** Average rating from recap (out of 10), e.g. "7.2 / 10" or "—". */
function formatRating(recap: MeetingRecapData | null | undefined): string {
  const ratings = recap?.ratings?.filter((r) => r.rating != null) ?? [];
  if (ratings.length === 0) return '—';
  const sum = ratings.reduce((a, r) => a + (r.rating ?? 0), 0);
  const avg = Math.round((sum / ratings.length) * 10) / 10;
  return `${avg} / 10`;
}

export default function MeetingsPastPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [meetingDetail, setMeetingDetail] = useState<Meeting | null>(null);
  const [selectedRecap, setSelectedRecap] = useState<MeetingRecapData | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapsByMeetingId, setRecapsByMeetingId] = useState<Record<string, MeetingRecapData>>({});
  const [orgRole, setOrgRole] = useState<string | null>(null);

  // Past = only canceled or completed meetings. Upcoming = everything else (scheduled, in progress, suspended).
  const pastMeetings = meetings.filter((m) => m.endedAt || m.cancelledAt);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('organizationRole') : null;
    setOrgRole(stored ?? null);
  }, []);

  // Auto-open summary when landing with ?recap=meetingId (e.g. after ending a meeting)
  useEffect(() => {
    const recapId = searchParams.get('recap');
    if (!recapId || pastMeetings.length === 0 || !organizationId) return;
    const meeting = pastMeetings.find((m) => m.id === recapId);
    if (meeting) {
      setSelectedPastMeeting(meeting);
      setSelectedRecap(null);
    }
  }, [searchParams, pastMeetings, organizationId]);

  // Fetch recaps for all past meetings so table can show duration and rating (limit 30)
  useEffect(() => {
    if (!organizationId || pastMeetings.length === 0) {
      setRecapsByMeetingId({});
      return;
    }
    const toFetch = pastMeetings.slice(0, 30);
    let cancelled = false;
    Promise.all(
      toFetch.map((m) =>
        meetingsService.getRecap(organizationId, m.id).then((data) => ({ id: m.id, data }))
      )
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, MeetingRecapData> = {};
      results.forEach(({ id, data }) => {
        if (data) map[id] = data;
      });
      setRecapsByMeetingId(map);
    });
    return () => { cancelled = true; };
  }, [organizationId, pastMeetings]);

  // When a past meeting is selected: fetch recap and full meeting (with section notes) for the panel
  useEffect(() => {
    if (!selectedPastMeeting || !organizationId) {
      setSelectedRecap(null);
      setMeetingDetail(null);
      return;
    }
    setRecapLoading(true);
    setMeetingDetail(null);
    const meetingId = selectedPastMeeting.id;
    Promise.all([
      meetingsService.getRecap(organizationId, meetingId),
      meetingsService.findOne(organizationId, meetingId),
    ])
      .then(([recapData, fullMeeting]) => {
        setSelectedRecap(recapData ?? null);
        setMeetingDetail(fullMeeting ?? null);
      })
      .catch(() => {
        setSelectedRecap(null);
        setMeetingDetail(null);
      })
      .finally(() => setRecapLoading(false));
  }, [organizationId, selectedPastMeeting?.id]);

  const handleCloseRecap = useCallback(() => {
    setSelectedPastMeeting(null);
    setSelectedRecap(null);
    setMeetingDetail(null);
    if (searchParams.get('recap')) {
      router.replace(pathname, { scroll: false });
    }
  }, [router, pathname, searchParams]);

  const handleRecapDeleted = useCallback(() => {
    setSelectedPastMeeting(null);
    setSelectedRecap(null);
    refetch();
  }, [refetch]);

  const handleRecapUpdated = useCallback((updatedRecap: import('@/lib/api/meetings.service').MeetingRecapData) => {
    if (!selectedPastMeeting) return;
    setSelectedRecap(updatedRecap);
    setRecapsByMeetingId((prev) => ({
      ...prev,
      [selectedPastMeeting.id]: updatedRecap,
    }));
  }, [selectedPastMeeting]);

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
                  { key: 'scribe', label: 'Scribe' },
                  { key: 'rating', label: 'Rating' },
                ]}
              >
                {pastMeetings.map((meeting) => {
                  const recap = recapsByMeetingId[meeting.id];
                  const duration =
                    recap?.sectionDurations?.length
                      ? formatDurationFromSectionDurations(recap.sectionDurations)
                      : formatDuration(meeting.startedAt, meeting.endedAt ?? undefined);
                  const rating = formatRating(recap);
                  return (
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
                        {duration}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {getFacilitatorName(meeting)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {getScribeName(meeting)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {rating}
                      </td>
                    </tr>
                  );
                })}
              </SimpleTable>
            </div>
          )}
        </div>
      </div>

      {selectedPastMeeting && organizationId && (
        <PastMeetingRecapPanel
          meeting={meetingDetail ?? selectedPastMeeting}
          recap={selectedRecap}
          recapLoading={recapLoading}
          organizationId={organizationId}
          teamId={selectedPastMeeting.teamId}
          orgRole={orgRole}
          onClose={handleCloseRecap}
          onDeleted={handleRecapDeleted}
          onRecapUpdated={handleRecapUpdated}
        />
      )}
    </>
  );
}
