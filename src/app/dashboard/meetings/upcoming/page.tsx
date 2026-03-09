'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import {
  Calendar,
  Play,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Clock,
} from 'lucide-react';
import { Select } from 'antd';
import { ROUTES } from '@/lib/constants/routes';
import { useMeetingsData } from '@/hooks/useMeetingsData';
import type { Meeting } from '@/lib/api/meetings.service';
import { meetingsService } from '@/lib/api/meetings.service';
import { meetingSeriesService, type MeetingSeries } from '@/lib/api/meeting-series.service';
import { StartMeetingModal } from '@/components/meeting/StartMeetingModal';
import { ScheduleMeetingModal } from '@/components/meeting/ScheduleMeetingModal';
import { EditScheduleModal } from '@/components/meeting/EditScheduleModal';
import { MeetingScheduledModal } from '@/components/meeting/MeetingScheduledModal';
import { QuickStartMeetingModal } from '@/components/meeting/QuickStartMeetingModal';
import { SimpleTable } from '@/components/ui/SimpleTable';
import { formatDate, formatTime } from '@/lib/formatDate';

const RESUME_MEETING_KEY = 'meeting-app-resumeMeetingId';

export default function MeetingsUpcomingPage() {
  const router = useRouter();
  const {
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
  } = useMeetingsData();

  const [startModalOpen, setStartModalOpen] = useState(false);
  const [quickStartModalOpen, setQuickStartModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [agendas, setAgendas] = useState<MeetingSeries[]>([]);
  const [editScheduleMeeting, setEditScheduleMeeting] = useState<Meeting | null>(null);
  const [schedulingMeeting, setSchedulingMeeting] = useState(false);
  const [cancelMeetingTarget, setCancelMeetingTarget] = useState<Meeting | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [deleteMeetingTarget, setDeleteMeetingTarget] = useState<Meeting | null>(null);
  const [deleteMeetingError, setDeleteMeetingError] = useState<string | null>(null);
  const [continueMeetingModal, setContinueMeetingModal] = useState<Meeting | null>(null);
  const [resumingMeetingId, setResumingMeetingId] = useState<string | null>(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<{ meetingId: string; left: number; top: number } | null>(null);
  const [meetingScheduledModal, setMeetingScheduledModal] = useState<{
    agendaName: string;
    teamName: string;
    scheduledAt: string;
    durationMinutes?: number;
  } | null>(null);
  const [orgRole, setOrgRole] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('organizationRole') : null;
    setOrgRole(stored ?? null);
    const onRoleChange = (e: CustomEvent<{ role?: string }>) => {
      setOrgRole(e.detail?.role ?? null);
    };
    window.addEventListener('organizationRoleChanged', onRoleChange as EventListener);
    return () => window.removeEventListener('organizationRoleChanged', onRoleChange as EventListener);
  }, []);

  const isAdminOrManager = orgRole === 'ADMIN' || orgRole === 'MANAGER';

  // Upcoming = all meetings that are not cancelled and not ended (ongoing, not started, future).
  // They stay in Upcoming until cancelled, finished, or completed. Past = only ended or cancelled.
  const now = Date.now();
  const inProgressMeeting = meetings.find(
    (m) =>
      m.teamId === selectedTeamId && m.startedAt && !m.endedAt && !m.suspendedAt
  );
  const suspendedMeeting = meetings.find(
    (m) => m.teamId === selectedTeamId && m.suspendedAt && !m.endedAt
  );
  // Table: all upcoming (not cancelled, not ended) — includes ongoing, not started, and future
  const upcomingMeetings = meetings
    .filter(
      (m) =>
        m.teamId === selectedTeamId &&
        !m.cancelledAt &&
        !m.endedAt
    )
    .sort((a, b) => {
      // Ongoing (started or suspended) first, then by scheduled date
      const aOngoing = !!(a.startedAt || a.suspendedAt);
      const bOngoing = !!(b.startedAt || b.suspendedAt);
      if (aOngoing && !bOngoing) return -1;
      if (!aOngoing && bOngoing) return 1;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });
  const isFacilitatorOrScribe =
    inProgressMeeting &&
    currentUserId &&
    (inProgressMeeting.facilitatorId === currentUserId ||
      inProgressMeeting.scribeId === currentUserId);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const resumeId = sessionStorage.getItem(RESUME_MEETING_KEY);
    if (resumeId) {
      sessionStorage.removeItem(RESUME_MEETING_KEY);
      setResumingMeetingId(resumeId);
    }
  }, []);

  useEffect(() => {
    if (!organizationId || !selectedTeamId) return;
    meetingSeriesService.list(organizationId, selectedTeamId).then(setAgendas).catch(() => setAgendas([]));
  }, [organizationId, selectedTeamId]);

  // Refetch when user returns to this tab so all team members see in-progress/scheduled updates
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refetch]);

  const handleQuickStartWithAgenda = async (meetingSeriesId: string, meetingSeriesName: string) => {
    if (!organizationId || !selectedTeamId) return;
    setSchedulingMeeting(true);
    try {
      const meeting = await meetingsService.create(organizationId, {
        teamId: selectedTeamId,
        meetingSeriesId,
        meetingSeriesName,
        scheduledAt: new Date().toISOString(),
      });
      await refetch();
      router.push(ROUTES.MEETING(meeting.id));
    } finally {
      setSchedulingMeeting(false);
    }
  };

  const handleScheduled = (payload: { agendaName: string; teamName: string; scheduledAt: string; durationMinutes?: number }) => {
    setMeetingScheduledModal(payload);
    refetch();
  };

  const handleCancelScheduledMeeting = async () => {
    if (!cancelMeetingTarget || !organizationId) return;
    try {
      setCancellingId(cancelMeetingTarget.id);
      await meetingsService.cancel(organizationId, cancelMeetingTarget.id);
      const data = await meetingsService.findAll(organizationId, selectedTeamId);
      setMeetings(data);
      setCancelMeetingTarget(null);
      setCancelError(null);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setCancelError(message || 'Failed to cancel meeting');
    } finally {
      setCancellingId(null);
    }
  };

  const handleContinueSuspendedMeeting = (meeting: Meeting) => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(RESUME_MEETING_KEY, meeting.id);
    }
    setContinueMeetingModal(null);
    router.push(ROUTES.MEETING(meeting.id));
  };

  const handleDeleteMeeting = async () => {
    if (!deleteMeetingTarget || !organizationId) return;
    try {
      await meetingsService.remove(organizationId, deleteMeetingTarget.id);
      const data = await meetingsService.findAll(organizationId, selectedTeamId);
      setMeetings(data);
      setDeleteMeetingTarget(null);
      setDeleteMeetingError(null);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setDeleteMeetingError(message || 'Failed to delete meeting');
    }
  };

  const handleEditScheduleSaved = () => {
    setEditScheduleMeeting(null);
    refetch();
  };

  const openRowMenu = (e: React.MouseEvent, meetingId: string) => {
    e.stopPropagation();
    setRowMenuAnchor({ meetingId, left: e.clientX, top: e.clientY });
  };

  return (
    <>
      {schedulingMeeting && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"
              aria-hidden
            />
            <p className="text-sm font-medium text-foreground">Creating meeting…</p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Upcoming</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdminOrManager ? 'Start or schedule meetings for your team.' : 'Upcoming meetings for your team.'}
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

        {/* Hero: background image with text and Start / Schedule buttons (admin/manager only, when no meeting in progress) */}
        {isAdminOrManager && !inProgressMeeting && (
          <div className="relative rounded-xl overflow-hidden border border-border bg-card min-h-[180px] flex items-center justify-center">
            <div
              className="absolute inset-0 z-0 bg-cover bg-center"
              style={{ backgroundImage: 'url(/meeting-bg.webp)' }}
              role="img"
              aria-hidden
            />
            <div className="absolute inset-0 bg-black/50 z-[1]" aria-hidden />
            <div className="relative z-10 p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 w-full text-center sm:text-left">
              <div>
                <h3 className="text-lg md:text-xl font-semibold text-white">
                  Run effective meetings with your team
                </h3>
                <p className="text-sm text-white/90 mt-1">
                  Start a quick meeting now or schedule one for later.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setQuickStartModalOpen(true)}
                  disabled={schedulingMeeting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <Calendar className="w-4 h-4" />
                  Start a quick meeting
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/80 text-white bg-white/10 hover:bg-white/20 text-sm font-medium"
                >
                  <Clock className="w-4 h-4" />
                  Schedule a meeting
                </button>
              </div>
            </div>
          </div>
        )}

        {resumingMeetingId && (
          <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between gap-4">
            <p className="text-sm text-foreground">
              You have a suspended meeting. Open it to continue.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push(ROUTES.MEETING(resumingMeetingId))}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => setResumingMeetingId(null)}
                className="px-3 py-1.5 rounded-md border border-border text-foreground text-sm"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {inProgressMeeting && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {inProgressMeeting.series.name} — In progress
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Started {formatDate(new Date(inProgressMeeting.startedAt!))} at{' '}
                  {formatTime(new Date(inProgressMeeting.startedAt!))}
                </p>
              </div>
              <Link
                href={ROUTES.MEETING(inProgressMeeting.id)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                <Play className="w-4 h-4" />
                Join
              </Link>
            </div>
          </div>
        )}

        {suspendedMeeting && !continueMeetingModal && (
          <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-4">
            <p className="text-sm text-foreground">
              Meeting &quot;{suspendedMeeting.series.name}&quot; was suspended.
            </p>
            <button
              type="button"
              onClick={() => setContinueMeetingModal(suspendedMeeting)}
              className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm font-medium"
            >
              Continue meeting
            </button>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-4 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">
              Upcoming <span className="text-muted-foreground font-normal">{upcomingMeetings.length}</span>
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Meetings stay here until cancelled or ended. Includes scheduled, in progress, and not yet started.
            </p>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : upcomingMeetings.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {isAdminOrManager ? 'No upcoming meetings. Start or schedule one above.' : 'No upcoming meetings.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <SimpleTable
                columns={[
                  { key: 'date', label: 'Date' },
                  { key: 'agenda', label: 'Agenda' },
                  { key: 'duration', label: 'Duration' },
                  { key: 'actions', label: '', className: 'w-24', align: 'right' },
                ]}
              >
                {upcomingMeetings.map((meeting) => (
                  <tr
                    key={meeting.id}
                    className="border-b border-border/30 last:border-b-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 text-sm text-foreground">
                      {formatDate(new Date(meeting.scheduledAt))} at{' '}
                      {formatTime(new Date(meeting.scheduledAt))}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {meeting.series.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(() => {
                          const isFuture = new Date(meeting.scheduledAt).getTime() > now && !meeting.startedAt;
                          if (isFuture) {
                            return (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium text-muted-foreground cursor-not-allowed"
                                title="Meeting has not started yet"
                              >
                                <Play className="w-4 h-4 opacity-50" />
                                Join
                              </span>
                            );
                          }
                          return (
                            <Link
                              href={ROUTES.MEETING(meeting.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium text-primary hover:bg-primary/10"
                            >
                              <Play className="w-4 h-4" />
                              Join
                            </Link>
                          );
                        })()}
                        {isAdminOrManager && (
                          <button
                            type="button"
                            onClick={(e) => openRowMenu(e, meeting.id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Meeting actions"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </SimpleTable>
            </div>
          )}
        </div>
      </div>

      {startModalOpen && (
        <StartMeetingModal
          onClose={() => setStartModalOpen(false)}
          onQuickStart={() => {
            setStartModalOpen(false);
            setQuickStartModalOpen(true);
          }}
          onSchedule={() => {
            setStartModalOpen(false);
            setScheduleModalOpen(true);
          }}
          isStarting={schedulingMeeting}
        />
      )}

      {quickStartModalOpen && organizationId && selectedTeamId && (
        <QuickStartMeetingModal
          agendas={agendas}
          organizationId={organizationId}
          teamId={selectedTeamId}
          onClose={() => setQuickStartModalOpen(false)}
          onStart={handleQuickStartWithAgenda}
          isStarting={schedulingMeeting}
        />
      )}

      {scheduleModalOpen && organizationId && selectedTeamId && selectedTeam && (
        <ScheduleMeetingModal
          organizationId={organizationId}
          teamId={selectedTeamId}
          teamName={selectedTeam.name}
          members={members}
          currentUserId={currentUserId ?? ''}
          agendas={agendas}
          onClose={() => setScheduleModalOpen(false)}
          onScheduled={handleScheduled}
          onCreatingChange={setSchedulingMeeting}
        />
      )}

      {editScheduleMeeting && organizationId && (
        <EditScheduleModal
          open={true}
          meeting={editScheduleMeeting}
          organizationId={organizationId}
          members={members}
          currentUserId={currentUserId ?? ''}
          onClose={() => setEditScheduleMeeting(null)}
          onSaved={handleEditScheduleSaved}
        />
      )}

      {cancelMeetingTarget && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setCancelMeetingTarget(null)} aria-hidden />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-xl border border-border bg-card shadow-xl p-6"
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-lg font-semibold text-foreground mb-2">Cancel meeting?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This will cancel &quot;{cancelMeetingTarget.series.name}&quot; scheduled for{' '}
              {formatDate(new Date(cancelMeetingTarget.scheduledAt))}.
            </p>
            {cancelError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-2">{cancelError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setCancelMeetingTarget(null); setCancelError(null); }}
                className="px-4 py-2 rounded-md border border-border text-foreground text-sm"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleCancelScheduledMeeting}
                disabled={cancellingId !== null}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium disabled:opacity-70"
              >
                {cancellingId ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Yes, cancel
              </button>
            </div>
          </div>
        </>
      )}

      {deleteMeetingTarget && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setDeleteMeetingTarget(null)} aria-hidden />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-xl border border-border bg-card shadow-xl p-6"
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete meeting?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              &quot;{deleteMeetingTarget.series.name}&quot; will be permanently removed.
            </p>
            {deleteMeetingError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-2">{deleteMeetingError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setDeleteMeetingTarget(null); setDeleteMeetingError(null); }}
                className="px-4 py-2 rounded-md border border-border text-foreground text-sm"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleDeleteMeeting}
                className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium"
              >
                Yes, delete
              </button>
            </div>
          </div>
        </>
      )}

      {continueMeetingModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setContinueMeetingModal(null)} aria-hidden />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-xl border border-border bg-card shadow-xl p-6"
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-lg font-semibold text-foreground mb-2">Continue meeting?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Resume &quot;{continueMeetingModal.series.name}&quot; from where you left off.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setContinueMeetingModal(null)}
                className="px-4 py-2 rounded-md border border-border text-foreground text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleContinueSuspendedMeeting(continueMeetingModal)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
              >
                <Play className="w-4 h-4" />
                Continue
              </button>
            </div>
          </div>
        </>
      )}

      {rowMenuAnchor && typeof document !== 'undefined' && (() => {
        const menuMeeting = upcomingMeetings.find((m) => m.id === rowMenuAnchor!.meetingId);
        if (!menuMeeting) return null;
        return createPortal(
          <>
            <div className="fixed inset-0 z-[45]" onClick={() => setRowMenuAnchor(null)} aria-hidden />
            <div
              className="fixed z-[50] py-1 min-w-[180px] rounded-lg border border-border bg-card shadow-lg"
              style={{ left: rowMenuAnchor.left, top: rowMenuAnchor.top }}
            >
              <button
                type="button"
                onClick={() => {
                  setMeetingScheduledModal({
                    agendaName: menuMeeting.series.name,
                    teamName: menuMeeting.team.name,
                    scheduledAt: menuMeeting.scheduledAt,
                  });
                  setRowMenuAnchor(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted cursor-pointer text-left"
              >
                <Plus className="w-4 h-4" />
                Add to calendar
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditScheduleMeeting(menuMeeting);
                  setRowMenuAnchor(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted cursor-pointer text-left"
              >
                <Pencil className="w-4 h-4" />
                Edit schedule
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteMeetingTarget(menuMeeting);
                  setDeleteMeetingError(null);
                  setRowMenuAnchor(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer text-left"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </>,
          document.body
        );
      })()}

      {meetingScheduledModal && (
        <MeetingScheduledModal
          open={true}
          onClose={() => setMeetingScheduledModal(null)}
          agendaName={meetingScheduledModal.agendaName}
          teamName={meetingScheduledModal.teamName}
          scheduledAt={meetingScheduledModal.scheduledAt}
          durationMinutes={meetingScheduledModal.durationMinutes}
        />
      )}

    </>
  );
}
