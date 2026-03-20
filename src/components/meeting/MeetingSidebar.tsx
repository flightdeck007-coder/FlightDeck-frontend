'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Flag, LogOut, FileText, AlertTriangle, Eye, EyeOff, Loader2, Users, User, RefreshCw, X, UserCog, Pencil, Settings } from 'lucide-react';
import { useMeetingSocket } from '@/contexts/MeetingSocketContext';
import { useSettings } from '@/contexts/SettingsContext';
import { meetingsService, type Meeting } from '@/lib/api/meetings.service';
import { teamsService, type TeamMember } from '@/lib/api/teams.service';
import { Select } from 'antd';

interface MeetingSection {
  id: string;
  title: string;
  duration: number;
  order: number;
}

interface MeetingSidebarProps {
  sections: MeetingSection[];
  currentSection?: string;
  onSectionClick: (sectionId: string) => void;
  totalTime: string;
  segmentTime: string;
  segmentProgressPercent?: number; // 0–100 for current segment progress bar
  isRunning: boolean;
  isSuspended?: boolean;
  isFacilitator?: boolean; // only facilitator can control segment/timer and finish/suspend
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onResumeFromSuspend?: () => void;
  onFinish: () => void;
  finishLoading?: boolean;
  participantCount?: number; // total participants (show number only)
  notesVisible?: boolean;
  onToggleNotes?: () => void;
  onExitMeeting?: () => void; // for members: leave meeting (marked absent)
  onPrevSegment?: () => void;
  onNextSegment?: () => void;
  onSuspend?: () => void;
  /** Show Meeting notes button (facilitator or scribe only). Tangent is shown to all. */
  canShowTangentAndNotes?: boolean;
  /** Meeting id (for tangent broadcast) */
  meetingId?: string;
  /** If true, Participants is a button that opens a modal to fetch & list participants (facilitator/scribe). Otherwise plain text. */
  canOpenParticipantsModal?: boolean;
  /** Required for fetching participants when modal is opened */
  organizationId?: string;
  /** Called after scribe is updated so parent can set meeting state; also used so other clients get update via socket */
  onMeetingUpdated?: (meeting: Meeting) => void;
}

export function MeetingSidebar({
  sections,
  currentSection,
  onSectionClick,
  totalTime,
  segmentTime,
  segmentProgressPercent = 0,
  isRunning,
  isSuspended = false,
  isFacilitator = true,
  onStart,
  onPause,
  onResume,
  onResumeFromSuspend,
  onFinish,
  finishLoading = false,
  participantCount,
  notesVisible = false,
  onToggleNotes,
  onExitMeeting,
  onPrevSegment,
  onNextSegment,
  onSuspend,
  canShowTangentAndNotes = false,
  meetingId,
  canOpenParticipantsModal = false,
  organizationId,
  onMeetingUpdated,
}: MeetingSidebarProps) {
  const { socket } = useMeetingSocket();
  const { openSettings } = useSettings();
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [tangentModalOpen, setTangentModalOpen] = useState(false);
  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);
  const [fetchedMeeting, setFetchedMeeting] = useState<Meeting | null>(null);
  const [participantsList, setParticipantsList] = useState<Array<{ id: string; present: boolean; user: { id: string; email: string; name?: string } }>>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [changeScribeOpen, setChangeScribeOpen] = useState(false);
  const [changeScribeLoading, setChangeScribeLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedNewScribeId, setSelectedNewScribeId] = useState<string | null>(null);
  const currentIndex = sections.findIndex((s) => s.id === currentSection);

  const fetchParticipants = useCallback(async () => {
    if (!organizationId || !meetingId) return;
    setParticipantsLoading(true);
    try {
      const meeting = await meetingsService.findOne(organizationId, meetingId);
      setFetchedMeeting(meeting ?? null);
      setParticipantsList(meeting?.attendances ?? []);
    } catch {
      setFetchedMeeting(null);
      setParticipantsList([]);
    } finally {
      setParticipantsLoading(false);
    }
  }, [organizationId, meetingId]);

  const fetchTeamMembers = useCallback(async () => {
    if (!organizationId || !fetchedMeeting?.teamId) return;
    try {
      const teams = await teamsService.list(organizationId);
      const team = teams.find((t) => t.id === fetchedMeeting.teamId);
      setTeamMembers(team?.members ?? []);
    } catch {
      setTeamMembers([]);
    }
  }, [organizationId, fetchedMeeting?.teamId]);

  const handleChangeScribe = useCallback(async () => {
    if (!organizationId || !meetingId || !selectedNewScribeId || !onMeetingUpdated) return;
    setChangeScribeLoading(true);
    try {
      const updated = await meetingsService.update(organizationId, meetingId, { scribeId: selectedNewScribeId });
      onMeetingUpdated(updated);
      setChangeScribeOpen(false);
      setSelectedNewScribeId(null);
      // Refresh participants so modal shows correct list and scribe (API update response may not include attendances)
      await fetchParticipants();
    } catch {
      // keep modal open on error
    } finally {
      setChangeScribeLoading(false);
    }
  }, [organizationId, meetingId, selectedNewScribeId, onMeetingUpdated, fetchParticipants]);

  useEffect(() => {
    if (participantsModalOpen && canOpenParticipantsModal) fetchParticipants();
  }, [participantsModalOpen, canOpenParticipantsModal, fetchParticipants]);

  useEffect(() => {
    if (changeScribeOpen && fetchedMeeting) fetchTeamMembers();
  }, [changeScribeOpen, fetchedMeeting, fetchTeamMembers]);

  useEffect(() => {
    if (!socket) return;
    const onTangentCalled = () => setTangentModalOpen(true);
    socket.on('tangent_called', onTangentCalled);
    return () => {
      socket.off('tangent_called', onTangentCalled);
    };
  }, [socket]);
  const canGoPrev = currentIndex > 0 && isFacilitator;
  const canGoNext = currentIndex >= 0 && currentIndex < sections.length - 1 && isFacilitator;
  const canControlTimer = isFacilitator;
  const canFinishOrSuspend = isFacilitator;
  const count = participantCount ?? 0;

  return (
    <div className="h-full bg-card border-r border-border flex flex-col w-full">
      {/* Participants count only + Total & segment time on one row with space */}
      <div className="p-4 border-b border-border">
        {count >= 0 && (
          canOpenParticipantsModal ? (
            <button
              type="button"
              onClick={() => setParticipantsModalOpen(true)}
              className="flex items-center gap-2 text-sm font-medium text-foreground/80 mb-3 hover:text-foreground hover:underline transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Participants ({count})</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium text-foreground/80 mb-3">
              <Users className="w-4 h-4 shrink-0" />
              <span>Participants ({count})</span>
            </div>
          )
        )}
        <div className="flex items-baseline justify-between gap-4 mb-1">
          <span className="text-sm font-medium text-foreground/80">Total: {totalTime}</span>
          <span className="text-sm font-medium text-foreground/80">Current segment: <span className="font-bold text-foreground">{segmentTime}</span></span>
        </div>
        <div className="h-1.5 w-full bg-border rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-primary transition-all duration-300 min-w-[2px]"
            style={{ width: `${Math.min(100, Math.max(0, segmentProgressPercent))}%` }}
          />
        </div>
        {/* Rewind | Start/Pause/Resume | Forward | Suspend — only facilitator can use */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevSegment}
            disabled={!canGoPrev || isSuspended}
            className="p-2 rounded-md hover:bg-foreground/10 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Previous segment"
            title={!isFacilitator ? 'Only the facilitator can change segment' : undefined}
          >
            <ChevronLeft className="w-5 h-5 text-foreground/70" />
          </button>
          {isSuspended && onResumeFromSuspend ? (
            <button
              type="button"
              onClick={onResumeFromSuspend}
              disabled={!canControlTimer}
              className="flex-1 flex items-center justify-center p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Resume"
              title={!isFacilitator ? 'Only the facilitator can control the timer' : undefined}
            >
              <Play className="w-4 h-4" />
            </button>
          ) : !isRunning ? (
            <button
              type="button"
              onClick={onStart}
              disabled={!canControlTimer}
              className="flex-1 flex items-center justify-center p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Start"
              title={!isFacilitator ? 'Only the facilitator can control the timer' : undefined}
            >
              <Play className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              disabled={!canControlTimer}
              className="flex-1 flex items-center justify-center p-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Pause"
              title={!isFacilitator ? 'Only the facilitator can control the timer' : undefined}
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onNextSegment}
            disabled={!canGoNext || isSuspended}
            className="p-2 rounded-md hover:bg-foreground/10 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Next segment"
            title={!isFacilitator ? 'Only the facilitator can change segment' : undefined}
          >
            <ChevronRight className="w-5 h-5 text-foreground/70" />
          </button>
          {onSuspend && (
            <button
              type="button"
              onClick={onSuspend}
              disabled={!canFinishOrSuspend}
              className="px-3 py-2 text-sm text-foreground/80 hover:bg-foreground/10 rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none"
              title={!isFacilitator ? 'Only the facilitator can suspend' : undefined}
            >
              SUSPEND
            </button>
          )}
        </div>
      </div>

      {/* Seven segments list with numbers — no left/right space: darker border at left edge, lighter fill to right border */}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="space-y-0">
          {sections.map((section, index) => {
            const isActive = currentSection === section.id;
            const segmentNumber = index + 1;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => isFacilitator && onSectionClick(section.id)}
                disabled={!isFacilitator}
                className={`w-full text-left pl-3 pr-4 py-2 transition-colors border-l-[3px] rounded-none ${
                  isActive
                    ? 'border-primary bg-primary/5 text-primary font-semibold'
                    : 'border-transparent text-foreground/70 hover:bg-foreground/10 hover:text-foreground'
                } ${!isFacilitator ? 'cursor-default opacity-90' : ''} disabled:opacity-90 disabled:cursor-default`}
                title={!isFacilitator ? 'Only the facilitator can change segment' : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate">
                    <span className="font-medium text-foreground/70 shrink-0">{segmentNumber}.</span>{' '}
                    {section.title}
                  </span>
                  <span className="text-xs text-foreground/50 shrink-0">{section.duration} MIN</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tangent (all) | Show notes (facilitator/scribe only) */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (socket && meetingId) socket.emit('tangent_called', { meetingId });
              setTangentModalOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-foreground/10 transition-colors text-sm bg-background text-foreground"
          >
            <AlertTriangle className="w-4 h-4 text-foreground/70" />
            Tangent
          </button>
          {canShowTangentAndNotes && (
            <button
              type="button"
              onClick={onToggleNotes}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-foreground/10 transition-colors text-sm bg-background text-foreground"
            >
              {notesVisible ? (
                <>
                  <EyeOff className="w-4 h-4 text-foreground/70" />
                  Hide notes
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 text-foreground/70" />
                  Show notes
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={openSettings}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-foreground/10 transition-colors text-sm bg-background text-foreground"
          >
            <Settings className="w-4 h-4 text-foreground/70" />
            Settings
          </button>
        </div>
        {/* Tangent Called! modal */}
        {tangentModalOpen && (
          <>
            <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setTangentModalOpen(false)} aria-hidden />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl shadow-xl max-w-sm w-full p-6 relative">
                <button
                  type="button"
                  onClick={() => setTangentModalOpen(false)}
                  className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <span className="text-lg leading-none">×</span>
                </button>
                <h3 className="text-xl font-bold text-red-600 pr-8">Tangent Called!</h3>
                <div className="flex justify-center my-4">
                  <AlertTriangle className="w-14 h-14 text-foreground stroke-[1.5]" />
                </div>
                <p className="text-sm text-foreground mb-1">It&apos;s time to get back on topic.</p>
                <p className="text-sm text-muted-foreground mb-6">Create Turbulence if the tangent is worth revisiting.</p>
                <button
                  type="button"
                  onClick={() => setTangentModalOpen(false)}
                  className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-md transition-colors"
                >
                  Got it
                </button>
              </div>
            </div>
          </>
        )}
        {/* Participants modal (facilitator/scribe only) */}
        {participantsModalOpen && (
          <>
            <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setParticipantsModalOpen(false)} aria-hidden />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                  <h3 className="text-lg font-semibold text-foreground">Participants</h3>
                  <button
                    type="button"
                    onClick={() => setParticipantsModalOpen(false)}
                    className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 min-h-0">
                  {fetchedMeeting && !participantsLoading && (
                    <div className="mb-4 p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <UserCog className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-muted-foreground">Facilitator:</span>
                        <span className="font-medium text-foreground">
                          {fetchedMeeting.facilitatorId
                            ? (participantsList.find((a) => a.user.id === fetchedMeeting.facilitatorId)?.user?.name ||
                                participantsList.find((a) => a.user.id === fetchedMeeting.facilitatorId)?.user?.email ||
                                '—')
                            : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-muted-foreground">Scribe:</span>
                          <span className="font-medium text-foreground">
                            {fetchedMeeting.scribeId
                              ? (participantsList.find((a) => a.user.id === fetchedMeeting.scribeId)?.user?.name ||
                                  participantsList.find((a) => a.user.id === fetchedMeeting.scribeId)?.user?.email ||
                                  '—')
                              : '—'}
                          </span>
                        </div>
                        {isFacilitator && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedNewScribeId(fetchedMeeting.scribeId ?? null);
                              setChangeScribeOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border hover:bg-muted text-xs font-medium text-foreground"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Change scribe
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {participantsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Loading" />
                    </div>
                  ) : participantsList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No participants in this meeting.</p>
                  ) : (
                    <ul className="space-y-3">
                      {participantsList.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/10 hover:bg-muted/20 transition-colors"
                        >
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold text-foreground truncate">
                              {a.user.name || a.user.email || a.user.id}
                            </p>
                            {a.user.name && (
                              <p className="text-sm text-muted-foreground truncate mt-1">
                                {a.user.email}
                              </p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${
                              a.present
                                ? 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/90 dark:text-emerald-950'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {a.present ? 'In meeting' : 'Left'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 p-4 border-t border-border shrink-0">
                  <button
                    type="button"
                    onClick={fetchParticipants}
                    disabled={participantsLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-muted text-sm font-medium disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${participantsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => setParticipantsModalOpen(false)}
                    className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
            {/* Change scribe modal */}
            {changeScribeOpen && (
              <>
                <div className="fixed inset-0 bg-black/30 z-[60]" onClick={() => !changeScribeLoading && setChangeScribeOpen(false)} aria-hidden />
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                  <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full flex flex-col max-h-[85vh]">
                    <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                      <h3 className="text-lg font-semibold text-foreground">Change scribe</h3>
                      <button
                        type="button"
                        onClick={() => !changeScribeLoading && setChangeScribeOpen(false)}
                        className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        aria-label="Close"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 min-h-0">
                      <p className="text-sm text-muted-foreground mb-4">
                        Select a team member. They will be able to add and edit notes, todos, and issues.
                      </p>
                      <Select
                        value={selectedNewScribeId ?? undefined}
                        onChange={(v) => setSelectedNewScribeId(v ?? null)}
                        options={teamMembers.map((m) => ({
                          label: m.user.name || m.user.email || m.user.id,
                          value: m.user.id,
                        }))}
                        className="w-full"
                        placeholder="Select scribe"
                        showSearch
                        filterOption={(input, opt) =>
                          (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 p-4 border-t border-border shrink-0">
                      <button
                        type="button"
                        onClick={() => setChangeScribeOpen(false)}
                        disabled={changeScribeLoading}
                        className="px-4 py-2 rounded-md border border-border hover:bg-muted text-sm font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleChangeScribe}
                        disabled={changeScribeLoading || !selectedNewScribeId}
                        className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                      >
                        {changeScribeLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : null}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
        {/* Finish (facilitator) or Exit (member) */}
        {isFacilitator ? (
          <button
            type="button"
            onClick={onFinish}
            disabled={finishLoading}
            className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            title="End Flight Review for everyone"
          >
            {finishLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Flag className="w-4 h-4" />
            )}
            End Flight Review
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setExitConfirmOpen(true)}
              className="w-full px-4 py-3 border border-border rounded-md hover:bg-foreground/10 transition-colors text-sm font-medium flex items-center justify-center gap-2 text-foreground"
            >
              <LogOut className="w-4 h-4" />
              Exit meeting
            </button>
            {exitConfirmOpen && (
              <>
                <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setExitConfirmOpen(false)} aria-hidden />
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-2">Leave meeting?</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Are you sure you want to leave? You will be marked absent from the meeting.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setExitConfirmOpen(false)}
                        className="px-4 py-2 border border-border rounded-md hover:bg-muted text-sm font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExitConfirmOpen(false);
                          onExitMeeting?.();
                        }}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
                      >
                        Yes, leave
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
