'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Select } from 'antd';
import {
  CheckCircle2,
  Circle,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  Mountain,
  CheckSquare,
  AlertCircle,
  Megaphone,
  Archive,
  Link2,
  Trash2,
  Loader2,
  RotateCw,
  Flag,
  Users,
} from 'lucide-react';
import { useMeetingSocket } from '@/contexts/MeetingSocketContext';
import { useTodos, type TodoItem } from '@/contexts/TodosContext';
import { EditTodoPanel } from './TodosSegmentView';

const MENU_WIDTH = 248;
const MENU_GAP = 8;
const PAGE_SIZES = [10, 25, 50, 100];

interface ConcludeSegmentViewProps {
  teamName?: string;
  teamId?: string | null;
  teams?: Array<{ id: string; name: string }>;
  organizationId?: string | null;
  embedded?: boolean;
  onFinishMeeting?: () => Promise<void>;
  finishLoading?: boolean;
  meetingId?: string;
  isFacilitator?: boolean;
  facilitatorId?: string | null;
  currentUserId?: string | null;
  attendances?: Array<{
    id: string;
    present: boolean;
    user: { id: string; name?: string | null; email: string };
  }>;
}

type AttendeeRow = {
  id: string;
  userId: string;
  name: string;
  rating: number | null;
  absent: boolean;
  leftEarly?: boolean;
};

function formatDueDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ConcludeSegmentView({
  teamName = 'No team found',
  teamId: currentTeamId,
  teams = [],
  organizationId,
  embedded = false,
  onFinishMeeting,
  finishLoading = false,
  meetingId,
  isFacilitator = true,
  facilitatorId,
  currentUserId,
  attendances: meetingAttendances,
}: ConcludeSegmentViewProps) {
  const wrap = embedded ? 'pt-0 pb-4' : 'pt-0 pb-6';
  const contentPad = embedded ? 'px-4' : 'px-6';
  const { socket } = useMeetingSocket();

  const {
    todos,
    updateTodo,
    deleteTodo,
    moveToTop,
    moveToBottom,
    archiveTodo,
    setCompleted,
    isLoading,
    refetch,
  } = useTodos();

  const [editTodoId, setEditTodoId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [page, setPage] = useState(0);

  const recapTodos = useMemo(
    () => todos.filter((t) => !t.archived).sort((a, b) => a.order - b.order),
    [todos]
  );
  const totalItems = recapTodos.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return recapTodos.slice(start, start + itemsPerPage);
  }, [recapTodos, currentPage, itemsPerPage]);

  const runWithLoader = async (id: string, fn: () => void | Promise<void>) => {
    setActionLoadingId(id);
    try {
      await Promise.resolve(fn());
      await refetch();
    } finally {
      setActionLoadingId(null);
    }
  };

  const [archiveCompleted, setArchiveCompleted] = useState(true);
  const [sendRecapEmail, setSendRecapEmail] = useState(true);
  const [showIssueOnRecaps, setShowIssueOnRecaps] = useState(false);
  const [localFinishLoading, setLocalFinishLoading] = useState(false);
  const [showNoRatingModal, setShowNoRatingModal] = useState(false);
  const [showEndMeetingModal, setShowEndMeetingModal] = useState(false);

  const RATINGS_STORAGE_KEY = meetingId ? `meeting-ratings-${meetingId}` : null;
  const defaultAttendeesList = useMemo(
    () =>
      meetingAttendances && meetingAttendances.length > 0
        ? meetingAttendances.map((a) => ({
            id: a.id,
            userId: a.user?.id ?? a.id,
            name: a.user?.name ?? a.user?.email ?? 'Unknown',
            rating: null as number | null,
            absent: !a.present,
            leftEarly: !a.present,
          }))
        : [],
    [meetingAttendances]
  );

  const [attendees, setAttendees] = useState<AttendeeRow[]>(defaultAttendeesList);

  useEffect(() => {
    setAttendees(defaultAttendeesList);
  }, [defaultAttendeesList]);

  // Sync conclude attendance (absent) from facilitator to all clients
  useEffect(() => {
    if (!socket || !meetingId) return;
    const onConcludeAttendances = (payload: { attendances: Array<{ id: string; absent: boolean }> }) => {
      if (!Array.isArray(payload.attendances)) return;
      setAttendees((prev) =>
        prev.map((a) => {
          const updated = payload.attendances.find((p) => p.id === a.id);
          return updated !== undefined ? { ...a, absent: updated.absent } : a;
        })
      );
    };
    socket.on('conclude_attendances', onConcludeAttendances);
    return () => {
      socket.off('conclude_attendances', onConcludeAttendances);
    };
  }, [socket, meetingId]);

  // Sync rating from any participant so everyone (including facilitator) has full ratings for recap
  useEffect(() => {
    if (!socket || !RATINGS_STORAGE_KEY) return;
    const onConcludeRating = (payload: { attendanceId: string; rating: number | null }) => {
      if (!payload.attendanceId) return;
      setAttendees((prev) => {
        const next = prev.map((a) => (a.id === payload.attendanceId ? { ...a, rating: payload.rating } : a));
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(RATINGS_STORAGE_KEY!, JSON.stringify(next.map((a) => ({ id: a.id, rating: a.rating, absent: a.absent }))));
          } catch {
            // ignore
          }
        }
        return next;
      });
    };
    socket.on('conclude_rating', onConcludeRating);
    return () => {
      socket.off('conclude_rating', onConcludeRating);
    };
  }, [socket, RATINGS_STORAGE_KEY]);

  useEffect(() => {
    if (!RATINGS_STORAGE_KEY || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(RATINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{ id: string; rating: number | null; absent: boolean }>;
        setAttendees((prev) =>
          prev.map((a) => {
            const saved = parsed.find((p) => p.id === a.id);
            return saved ? { ...a, rating: saved.rating, absent: saved.absent } : a;
          })
        );
      }
    } catch {
      // ignore
    }
  }, [RATINGS_STORAGE_KEY]);

  const saveRatings = (next: typeof attendees) => {
    if (RATINGS_STORAGE_KEY && typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          RATINGS_STORAGE_KEY,
          JSON.stringify(next.map((a) => ({ id: a.id, rating: a.rating, absent: a.absent })))
        );
      } catch {
        // ignore
      }
    }
  };

  const hasAnyRating = attendees.some((a) => !a.absent && a.rating != null && a.rating >= 1 && a.rating <= 10);

  const openFinishFlow = () => {
    if (hasAnyRating) {
      setShowEndMeetingModal(true);
    } else {
      setShowNoRatingModal(true);
    }
  };

  const confirmNoRatingAndContinue = () => {
    setAttendees((prev) => prev.map((a) => ({ ...a, absent: true })));
    setShowNoRatingModal(false);
    setShowEndMeetingModal(true);
  };

  const confirmEndMeeting = async () => {
    if (!onFinishMeeting) return;
    setShowEndMeetingModal(false);
    setLocalFinishLoading(true);
    try {
      await onFinishMeeting();
    } finally {
      setLocalFinishLoading(false);
    }
  };

  const isFinishing = finishLoading || localFinishLoading;

  const totalParticipants = attendees.length;

  return (
    <div className={`flex flex-col min-h-0 h-full ${wrap}`}>
      <div className={`flex-1 overflow-auto min-h-0 mt-6 ${contentPad}`}>
        {/* Total participants (until finish from conclude or sidebar) */}
        <div className="flex items-center gap-2 mb-4 px-1">
          <Users className="w-5 h-5 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium text-foreground">
            Total participants: <span className="font-semibold text-foreground">{totalParticipants}</span>
          </span>
        </div>

        {/* Recap Clearances */}
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
            <h3 className="font-semibold text-foreground">
              Recap Clearances{' '}
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                {recapTodos.length}
              </span>
            </h3>
          </div>
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            )}
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left font-medium text-foreground px-4 py-2 w-8" />
                  <th className="text-left font-medium text-foreground px-4 py-2">Title</th>
                  <th className="text-left font-medium text-foreground px-4 py-2">Due By</th>
                  <th className="text-left font-medium text-foreground px-4 py-2">Owner</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
                  <RecapTodoRow
                    key={item.id}
                    item={item}
                    onEdit={() => setEditTodoId(item.id)}
                    onToggleComplete={(completed) => setCompleted(item.id, completed)}
                    onMoveToTop={() => runWithLoader(item.id, () => moveToTop(item.id))}
                    onMoveToBottom={() => runWithLoader(item.id, () => moveToBottom(item.id))}
                    onArchive={() => runWithLoader(item.id, () => archiveTodo(item.id))}
                    onDelete={() => runWithLoader(item.id, () => deleteTodo(item.id))}
                    actionLoading={actionLoadingId === item.id}
                  />
                ))}
              </tbody>
            </table>
            {pageItems.length === 0 && !isLoading && (
              <div className="px-4 py-8 text-center text-muted-foreground">
                No recap to-dos
              </div>
            )}
            {totalItems > 0 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-border text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Items per page:</span>
                  <Select<number>
                    value={itemsPerPage}
                    onChange={(v) => {
                      if (v != null) { setItemsPerPage(v); setPage(0); }
                    }}
                    options={PAGE_SIZES.map((n) => ({ label: String(n), value: n }))}
                    className="min-w-[80px]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span>
                    {currentPage * itemsPerPage + 1}-{Math.min((currentPage + 1) * itemsPerPage, totalItems)} of {totalItems}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(0)}
                    disabled={currentPage === 0}
                    className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
                  >
                    |
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
                  >
                    &lt;
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                    className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
                  >
                    &gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages - 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
                  >
                    |
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ratings (1-10) — all members in list; Absent editable by facilitator only */}
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
            <h3 className="font-semibold text-foreground">
              Ratings (1-10) — all {totalParticipants} participants
            </h3>
            <button
              type="button"
              className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Refresh ratings"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-medium text-foreground px-4 py-2">Name</th>
                <th className="text-left font-medium text-foreground px-4 py-2 w-28">Rating</th>
                <th className="text-left font-medium text-foreground px-4 py-2 w-24">Absent</th>
              </tr>
            </thead>
            <tbody>
              {attendees.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground text-sm">
                    Participants will appear here when they join the meeting.
                  </td>
                </tr>
              )}
              {attendees.map((a) => (
                <tr key={a.id} className="border-b border-border hover:bg-muted/10">
                  <td className="px-4 py-2 font-medium text-foreground">
                    <span>{a.name}</span>
                    {a.leftEarly && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">(Left early)</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {a.userId === currentUserId ? (
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={a.rating ?? ''}
                        onChange={(e) => {
                          const v = e.target.value ? Number(e.target.value) : null;
                          setAttendees((prev) => {
                            const next = prev.map((x) => (x.id === a.id ? { ...x, rating: v } : x));
                            saveRatings(next);
                            if (meetingId && socket) {
                              socket.emit('conclude_rating', { meetingId, attendanceId: a.id, rating: v });
                            }
                            return next;
                          });
                        }}
                        className="w-20 px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm"
                      />
                    ) : (
                      <span className="text-foreground font-medium">{a.rating != null ? a.rating : '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {a.userId === facilitatorId ? (
                      <span className="text-sm text-muted-foreground">Facilitator</span>
                    ) : (
                      <label className={`flex items-center gap-2 w-fit ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={a.absent}
                          disabled={!isFacilitator}
                          onChange={(e) => {
                            if (!isFacilitator) return;
                            const checked = e.target.checked;
                            setAttendees((prev) => {
                              const next = prev.map((x) => (x.id === a.id ? { ...x, absent: checked } : x));
                              saveRatings(next);
                              if (meetingId && socket) {
                                socket.emit('conclude_attendances', {
                                  meetingId,
                                  attendances: next.map((x) => ({ id: x.id, absent: x.absent })),
                                });
                              }
                              return next;
                            });
                          }}
                          className="rounded border-border"
                        />
                        <span className="text-sm text-foreground">Absent</span>
                      </label>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Conclusion actions */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20">
            <h3 className="font-semibold text-foreground">Conclusion actions</h3>
          </div>
          <div className="px-4 py-4 flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={archiveCompleted}
                onChange={(e) => setArchiveCompleted(e.target.checked)}
                className="rounded border-border text-primary"
              />
              <span className="text-sm text-foreground">
                Archive all completed Crew Headlines, Clearances and Turbulence for {teamName}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendRecapEmail}
                onChange={(e) => setSendRecapEmail(e.target.checked)}
                className="rounded border-border text-primary"
              />
              <span className="text-sm text-foreground">Send Flight Review Recap Email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showIssueOnRecaps}
                onChange={(e) => setShowIssueOnRecaps(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Show Turbulence description on Flight Review recaps</span>
            </label>
            <button
              type="button"
              onClick={isFacilitator && onFinishMeeting ? openFinishFlow : undefined}
              disabled={isFinishing || !isFacilitator}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed text-sm font-medium"
              title={!isFacilitator ? 'Only the facilitator can end the meeting' : undefined}
            >
              {isFinishing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Flag className="w-4 h-4" />
                  End Flight Review
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* No rating – mark absent confirmation */}
      {showNoRatingModal && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowNoRatingModal(false)} aria-hidden />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">No ratings given</h3>
              <p className="text-sm text-muted-foreground mb-4">
                No review member has been given a rating. They would be marked as absent. Do you want to continue?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNoRatingModal(false)}
                  className="px-4 py-2 border border-border rounded-md hover:bg-muted text-sm font-medium"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={confirmNoRatingAndContinue}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* End Flight Review confirmation */}
      {showEndMeetingModal && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowEndMeetingModal(false)} aria-hidden />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">End Flight Review?</h3>
              <p className="text-sm text-muted-foreground mb-4">Are you sure you want to end this Flight Review?</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEndMeetingModal(false)}
                  className="px-4 py-2 border border-border rounded-md hover:bg-muted text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmEndMeeting()}
                  disabled={isFinishing}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-70 text-sm font-medium flex items-center gap-2"
                >
                  {isFinishing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Yes, end meeting
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {editTodoId && (() => {
        const todo = todos.find((t) => t.id === editTodoId);
        if (!todo) return null;
        return (
          <EditTodoPanel
            todo={todo}
            onClose={() => setEditTodoId(null)}
            onUpdate={(patch) => updateTodo(editTodoId, patch)}
            teams={teams}
            currentTeamId={currentTeamId}
            organizationId={organizationId}
          />
        );
      })()}
    </div>
  );
}

function RecapTodoRow({
  item,
  onEdit,
  onToggleComplete,
  onMoveToTop,
  onMoveToBottom,
  onArchive,
  onDelete,
  actionLoading,
}: {
  item: TodoItem;
  onEdit: () => void;
  onToggleComplete: (completed: boolean) => void;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
  onArchive: () => void;
  onDelete: () => void;
  actionLoading: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    if (buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect());
      setMenuOpen(true);
    }
  };

  return (
    <>
      <tr
        className="border-b border-border hover:bg-muted/10 cursor-pointer"
        onClick={onEdit}
      >
        <td className="px-4 py-2 w-8 align-middle" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onToggleComplete(!item.completed)}
            className="rounded-full w-6 h-6 flex items-center justify-center hover:bg-muted/80 text-muted-foreground hover:text-foreground"
            aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
          >
            {item.completed ? (
              <CheckCircle2 className="w-5 h-5 text-primary" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>
        </td>
        <td className="px-4 py-2 font-medium text-foreground align-middle">{item.title}</td>
        <td className="px-4 py-2 text-muted-foreground align-middle">{formatDueDate(item.dueDate)}</td>
        <td className="px-4 py-2 align-middle">
          {item.assigneeId ? (
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground" title="Assigned">
              {item.ownerInitials}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </td>
        <td className="px-4 py-2 align-middle text-right" onClick={(e) => e.stopPropagation()}>
          <button
            ref={buttonRef}
            type="button"
            onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
            className="p-2 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="More actions"
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <MoreHorizontal className="w-4 h-4" />
            )}
          </button>
          {menuOpen && anchorRect && typeof document !== 'undefined' && (
            <RecapTodoRowMenu
              anchorRect={anchorRect}
              onClose={() => {
                setMenuOpen(false);
                setAnchorRect(null);
              }}
              onMoveToTop={onMoveToTop}
              onMoveToBottom={onMoveToBottom}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          )}
        </td>
      </tr>
    </>
  );
}

function RecapTodoRowMenu({
  anchorRect,
  onClose,
  onMoveToTop,
  onMoveToBottom,
  onArchive,
  onDelete,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const position = useMemo(() => {
    if (typeof window === 'undefined')
      return { top: anchorRect.top, left: anchorRect.right + MENU_GAP };
    const padding = 8;
    const maxLeft = window.innerWidth - MENU_WIDTH - padding;
    const leftWhenRight = anchorRect.right + MENU_GAP;
    const left =
      leftWhenRight > maxLeft
        ? anchorRect.left - MENU_WIDTH - MENU_GAP
        : leftWhenRight;
    const top = Math.min(
      anchorRect.top,
      Math.max(padding, window.innerHeight - 420)
    );
    return { top, left };
  }, [anchorRect]);

  const btn =
    'w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 rounded-md flex items-center gap-3 transition-colors';
  const icon = 'w-4 h-4 text-muted-foreground shrink-0';

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        className="fixed z-50 py-2 bg-card border border-border rounded-lg shadow-xl min-w-[240px]"
        style={{ top: position.top, left: position.left }}
        role="menu"
        aria-label="Row actions"
      >
        <div className="px-2 py-1">
          <button type="button" className={btn} onClick={() => { onMoveToTop(); onClose(); }} role="menuitem">
            <ChevronUp className={icon} /> Top of List
          </button>
          <button type="button" className={btn} onClick={() => { onMoveToBottom(); onClose(); }} role="menuitem">
            <ChevronDown className={icon} /> Bottom of List
          </button>
        </div>
        <div className="border-t border-border my-1" />
        <div className="px-2 py-1">
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <Mountain className={icon} /> Create linked Waypoint
          </button>
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <CheckSquare className={icon} /> Create linked Clearance
          </button>
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <AlertCircle className={icon} /> Create linked Turbulence
          </button>
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <Megaphone className={icon} /> Create linked Headline
          </button>
        </div>
        <div className="border-t border-border my-1" />
        <div className="px-2 py-1">
          <button type="button" className={btn} onClick={() => { onArchive(); onClose(); }} role="menuitem">
            <Archive className={icon} /> Archive
          </button>
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <Link2 className={icon} /> Copy Link
          </button>
        </div>
        <div className="border-t border-border my-1" />
        <div className="px-2 py-1">
          <button
            type="button"
            className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md flex items-center gap-3 transition-colors"
            onClick={() => { onDelete(); onClose(); }}
            role="menuitem"
          >
            <Trash2 className="w-4 h-4 shrink-0" /> Delete
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
