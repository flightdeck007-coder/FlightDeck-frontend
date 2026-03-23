'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  X,
  Pencil,
  Save,
  MoreHorizontal,
  ExternalLink,
  Plus,
  Paperclip,
  Download,
  FileText,
  User,
  Trash2,
  CheckCircle2,
  Circle,
  ListChecks,
  AlertTriangle,
  BarChart3,
  Star,
  Clock3,
} from 'lucide-react';
import { ContentAreaLoader } from '@/components/ui/loaders';
import type { Meeting } from '@/lib/api/meetings.service';
import { meetingsService } from '@/lib/api/meetings.service';
import { ROUTES } from '@/lib/constants/routes';
import { formatSegmentDuration } from '@/lib/formatDate';

export interface MeetingRecapTodo {
  id: string;
  title: string;
  assigneeInitials?: string;
  completed?: boolean;
}

export interface MeetingRecapIssue {
  id: string;
  title: string;
  resolvedByName?: string | null;
}

export interface MeetingRecapData {
  todosCreated?: MeetingRecapTodo[];
  issuesSolved?: MeetingRecapIssue[];
  shortTermStats?: {
    totalTracked: number;
    solvedLastMeeting: number;
    solvedToday: number;
    solveRatePercent: number;
  };
  sectionDurations?: Array<{ sectionTitle: string; durationMMSS: string }>;
  ratings?: Array<{ attendanceId?: string; userName: string; rating: number | null; absent?: boolean }>;
  attachments?: Array<{ id: string; name: string; url?: string }>;
}

interface PastMeetingRecapPanelProps {
  meeting: Meeting;
  recap?: MeetingRecapData | null;
  recapLoading?: boolean;
  organizationId: string;
  teamId: string;
  orgRole?: string | null;
  onClose: () => void;
  onDeleted?: () => void;
  /** Called after admin saves edited ratings so parent can update recap state. */
  onRecapUpdated?: (recap: MeetingRecapData) => void;
}

/** Allowed HTML tags for note content (safe subset for lists and emphasis). */
const ALLOWED_NOTE_TAGS = new Set(['p', 'br', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'span']);

function sanitizeNoteHtml(html: string): string {
  if (!html?.trim()) return '';
  let s = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  s = s.replace(tagPattern, (match, tagName: string) =>
    ALLOWED_NOTE_TAGS.has(tagName.toLowerCase()) ? match : ''
  );
  return s;
}

/** Renders note content: plain text with whitespace, or sanitized HTML with list styling. */
function NoteContent({ content }: { content: string }) {
  const trimmed = (content || '').trim();
  if (!trimmed) return null;
  const hasHtml = /<(?:\/)?(?:ul|ol|li|p|br|strong|em|b|i)\b/i.test(trimmed);
  if (!hasHtml) {
    return (
      <p className="text-muted-foreground whitespace-pre-wrap break-words pl-0">
        {trimmed}
      </p>
    );
  }
  const sanitized = sanitizeNoteHtml(trimmed);
  return (
    <div
      className="note-html text-muted-foreground break-words pl-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:my-0.5 [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

/** Notes by participant: from meeting.sections[].notes, grouped by author with segment title per note */
function getNotesByParticipantWithSegments(meeting: Meeting): Array<{
  authorName: string;
  segments: Array<{ sectionTitle: string; content: string }>;
}> {
  const sections = (meeting.sections ?? []).slice().sort((a, b) => a.order - b.order);
  const byAuthor = new Map<
    string,
    { authorName: string; segments: Array<{ sectionTitle: string; content: string }> }
  >();
  for (const section of sections) {
    for (const note of section.notes ?? []) {
      const authorId = note.author?.id ?? '';
      const name = note.author?.name ?? note.author?.email ?? 'Unknown';
      const content = (note.content || '').trim();
      if (!content) continue;
      const segment = { sectionTitle: section.title, content };
      const existing = byAuthor.get(authorId);
      if (existing) {
        existing.segments.push(segment);
      } else {
        byAuthor.set(authorId, { authorName: name, segments: [segment] });
      }
    }
  }
  return Array.from(byAuthor.values()).filter((n) => n.segments.length > 0);
}

type EditableRating = { attendanceId: string; userName: string; rating: number | null; absent: boolean };

export function PastMeetingRecapPanel({
  meeting,
  recap,
  recapLoading = false,
  organizationId,
  teamId,
  orgRole,
  onClose,
  onDeleted,
  onRecapUpdated,
}: PastMeetingRecapPanelProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localAttachments, setLocalAttachments] = useState<Array<{ id: string; name: string; url?: string }>>([]);
  const [apiAttachments, setApiAttachments] = useState<Array<{ id: string; fileName: string }>>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(true);
  const [editingRatings, setEditingRatings] = useState(false);
  const [editRatings, setEditRatings] = useState<EditableRating[]>([]);
  const [savingRatings, setSavingRatings] = useState(false);
  const [ratingsSaveError, setRatingsSaveError] = useState<string | null>(null);

  const isCancelled = Boolean(meeting.cancelledAt);
  const isAdmin = orgRole === 'ADMIN';

  useEffect(() => {
    if (!organizationId || !meeting.id) return;
    let cancelled = false;
    (async () => {
      setLoadingAttachments(true);
      try {
        const list = await meetingsService.getAttachments(organizationId, meeting.id);
        if (!cancelled) setApiAttachments(list.map((a) => ({ id: a.id, fileName: a.fileName })));
      } catch {
        if (!cancelled) setApiAttachments([]);
      } finally {
        if (!cancelled) setLoadingAttachments(false);
      }
    })();
    return () => { cancelled = true; };
  }, [organizationId, meeting.id]);

  const todosCreated = recap?.todosCreated ?? [];
  const issuesSolved = recap?.issuesSolved ?? [];
  const stats = recap?.shortTermStats ?? {
    totalTracked: 0,
    solvedLastMeeting: 0,
    solvedToday: 0,
    solveRatePercent: 0,
  };
  const sectionDurations = recap?.sectionDurations ?? meeting.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ sectionTitle: s.title, durationMMSS: '00:00' }));
  const ratings = recap?.ratings ?? (meeting.attendances ?? []).map((a) => ({
    attendanceId: a.id,
    userName: a.user?.name || a.user?.email || 'Attendee',
    rating: null as number | null,
    absent: false,
  }));
  const attachmentsFromApi = apiAttachments.map((a) => ({ id: a.id, name: a.fileName, fromApi: true as const }));
  const attachmentsFromRecap = (recap?.attachments?.length ? recap.attachments : localAttachments) ?? [];
  const apiIds = new Set(attachmentsFromApi.map((a) => a.id));
  const allAttachments = [
    ...attachmentsFromApi,
    ...attachmentsFromRecap
      .filter((a) => !apiIds.has(a.id))
      .map((a) => ({ id: a.id, name: a.name, fromApi: false as const })),
  ];

  const notesByParticipant = useMemo(() => getNotesByParticipantWithSegments(meeting), [meeting]);

  const handleDownloadAttachment = (attachmentId: string, fileName: string) => {
    if (!organizationId || !meeting.id) return;
    meetingsService.downloadAttachment(organizationId, meeting.id, attachmentId, fileName);
  };

  const todosPageUrl = `${ROUTES.TODOS}?teamId=${teamId}`;

  const handleAddAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalAttachments((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, name: file.name },
      ]);
    }
    e.target.value = '';
  };

  const startEditingRatings = () => {
    const attendances = meeting.attendances ?? [];
    const recapRatings = recap?.ratings ?? [];
    const list: EditableRating[] = attendances.map((a) => {
      const saved = recapRatings.find((r) => r.attendanceId === a.id);
      return {
        attendanceId: a.id,
        userName: a.user?.name || a.user?.email || 'Attendee',
        rating: saved?.rating ?? null,
        absent: saved?.absent ?? false,
      };
    });
    setEditRatings(list);
    setRatingsSaveError(null);
    setEditingRatings(true);
  };

  const saveRatings = async () => {
    if (!recap || !organizationId || !meeting.id) return;
    setRatingsSaveError(null);
    setSavingRatings(true);
    try {
      const updatedRatings = editRatings.map((r) => ({
        attendanceId: r.attendanceId,
        userName: r.userName,
        rating: r.absent ? null : r.rating,
        absent: r.absent,
      }));
      const updatedRecap: MeetingRecapData = {
        ...recap,
        ratings: updatedRatings,
      };
      await meetingsService.saveRecap(organizationId, meeting.id, updatedRecap);
      onRecapUpdated?.(updatedRecap);
      setEditingRatings(false);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'Failed to save ratings.';
      setRatingsSaveError(msg);
    } finally {
      setSavingRatings(false);
    }
  };

  const setEditRatingAt = (index: number, patch: Partial<EditableRating>) => {
    setEditRatings((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border shadow-xl z-50 flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            {isCancelled ? 'Cancelled Flight Review' : 'Past Flight Review'}
          </h2>
          <div className="flex items-center gap-1">
            {isAdmin && !isCancelled && (
              <button
                type="button"
                onClick={editingRatings ? saveRatings : startEditingRatings}
                disabled={savingRatings || recapLoading}
                className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                aria-label={editingRatings ? 'Save ratings' : 'Edit summary ratings'}
              >
                {editingRatings ? <Save className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full mt-1 py-1 bg-card border border-border rounded-md shadow-lg z-20 min-w-[160px]">
                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted">
                      Export
                    </button>
                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted">
                      Print
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col">
          {recapLoading && !isCancelled ? (
            <ContentAreaLoader label="Loading summary…" />
          ) : isCancelled ? (
            <div className="p-4">
              <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
                <p className="text-foreground font-medium">This meeting was cancelled.</p>
                <p className="text-sm text-foreground/70 mt-1">No summary is available.</p>
              </div>
            </div>
          ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-border">
          <>
          {/* Clearances Created (with checked/unchecked) */}
          <section className="w-full px-5 py-4">
            <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" />
              Clearances Created
            </h3>
            {todosCreated.length === 0 ? (
              <p className="text-sm font-medium text-foreground/70">No clearances created in this flight review.</p>
            ) : (
              <ul className="space-y-2">
                {todosCreated.map((todo) => (
                  <li
                    key={todo.id}
                    className="flex items-center gap-2 py-2.5 border-b border-border/50 last:border-0"
                  >
                    <span className="shrink-0 text-muted-foreground" aria-hidden>
                      {todo.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </span>
                    <span className={`text-sm truncate flex-1 ${todo.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {todo.title}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={todosPageUrl}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Open on main Clearances page"
                        aria-label="Open clearance on main page"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      {todo.assigneeInitials && (
                        <span
                          className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground"
                          title="Assignee"
                        >
                          {todo.assigneeInitials}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Turbulence Solved */}
          <section className="w-full px-5 py-4">
            <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" />
              Turbulence Solved
            </h3>
            {issuesSolved.length === 0 ? (
              <div className="rounded-lg bg-muted/30 border border-border text-foreground/80 px-4 py-3 text-center text-sm font-medium">
                No turbulence was solved during this flight review.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {issuesSolved.map((issue) => (
                  <li key={issue.id} className="text-sm text-foreground py-1">
                    <span className="font-semibold">{issue.title}</span>
                    {issue.resolvedByName && (
                      <span className="block text-xs text-muted-foreground mt-0.5">Solved by {issue.resolvedByName}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Short-Term Turbulence stats */}
          <section className="w-full px-5 py-4">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Short-Term Turbulence
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-lg p-3 border border-border">
                <p className="text-xs font-semibold text-foreground/60 mb-0.5">Total Tracked Turbulence</p>
                <p className="text-xl font-bold text-foreground">{stats.totalTracked}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 border border-border">
                <p className="text-xs font-semibold text-foreground/60 mb-0.5">Turbulence Solved Last Flight Review</p>
                <p className="text-xl font-bold text-foreground">{stats.solvedLastMeeting}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 border border-border">
                <p className="text-xs font-semibold text-foreground/60 mb-0.5">Turbulence Solved Today</p>
                <p className="text-xl font-bold text-foreground">{stats.solvedToday}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 border border-border">
                <p className="text-xs font-semibold text-foreground/60 mb-0.5">Solve Rate</p>
                <p className="text-xl font-bold text-foreground">{stats.solveRatePercent}%</p>
              </div>
            </div>
          </section>

          {/* Flight Notes by participant — each segment as bold heading + content; scroll if >3 members */}
          <section className="w-full px-5 py-4">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Notes
            </h3>
            {notesByParticipant.length === 0 ? (
              <p className="text-sm font-medium text-foreground/70">No notes from participants in this flight review.</p>
            ) : (
              <div
                className={`space-y-4 ${notesByParticipant.length > 3 ? 'max-h-[320px] overflow-y-auto pr-1' : ''}`}
                role="region"
                aria-label="Flight notes by participant"
              >
                {notesByParticipant.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-card overflow-hidden"
                  >
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground text-sm">{item.authorName}</span>
                    </div>
                    <div className="p-3 text-sm text-foreground space-y-3">
                      {item.segments.map((seg, j) => (
                        <div key={j}>
                          <p className="font-semibold text-foreground mb-1">{seg.sectionTitle}</p>
                          <NoteContent content={seg.content} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Attachments (downloadable) */}
          <section className="w-full px-5 py-4">
            <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-primary" />
              Attachments
            </h3>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm text-muted-foreground">
                {loadingAttachments ? 'Loading…' : `${allAttachments.length} file(s)`}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={handleAddAttachment}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Add attachment"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {allAttachments.length > 0 && (
              <ul className="space-y-2">
                {allAttachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md hover:bg-muted/50"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1 text-foreground">{a.name}</span>
                    {a.fromApi && (
                      <button
                        type="button"
                        onClick={() => handleDownloadAttachment(a.id, a.name)}
                        className="flex items-center gap-1 text-primary hover:underline shrink-0"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Ratings */}
          <section className="w-full px-5 py-4">
            <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" />
              Ratings
            </h3>
            {ratingsSaveError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-2" role="alert">
                {ratingsSaveError}
              </p>
            )}
            {editingRatings ? (
              <ul className="space-y-3">
                {editRatings.map((r, i) => (
                  <li key={r.attendanceId} className="flex flex-col gap-1.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-foreground font-medium shrink-0">{r.userName}</span>
                      <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={r.absent}
                          onChange={(e) => setEditRatingAt(i, { absent: e.target.checked, ...(e.target.checked ? { rating: null } : {}) })}
                          className="rounded border-border"
                        />
                        <span className="text-muted-foreground text-xs">Absent</span>
                      </label>
                    </div>
                    {!r.absent && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">Rating (1–10):</span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={r.rating ?? ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? null : Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1));
                            setEditRatingAt(i, { rating: v });
                          }}
                          className="w-16 px-2 py-1 rounded border border-border bg-background text-foreground text-sm"
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold text-foreground">Crew Member</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-foreground">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ratings.map((r, i) => (
                      <tr key={i} className="odd:bg-background even:bg-muted/20">
                        <td className="px-3 py-2.5 text-foreground">{r.userName}</td>
                        <td className="px-3 py-2.5 text-right text-foreground/75">
                          {r.absent ? 'Absent' : (r.rating != null ? r.rating : 'N/A')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Section Durations */}
          <section className="w-full px-5 py-4">
            <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-primary" />
              Section Durations
            </h3>
            <ul className="space-y-0 divide-y divide-border border border-border rounded-lg overflow-hidden">
              {sectionDurations.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between px-4 py-3.5 text-base bg-card hover:bg-muted/30"
                >
                  <span className="text-foreground font-semibold">{s.sectionTitle}</span>
                  <span className="text-foreground/75 font-medium tabular-nums">{formatSegmentDuration(s.durationMMSS)}</span>
                </li>
              ))}
            </ul>
          </section>
          </>
          </div>
          )}
        </div>
        {/* Delete this meeting (admin only) */}
        {isAdmin && onDeleted && (
          <div className="shrink-0 sticky bottom-0 border-t border-border bg-card/95 backdrop-blur px-5 py-4">
            <button
              type="button"
              onClick={() => { setDeleteError(null); setDeleteConfirmOpen(true); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md border border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Delete this meeting
            </button>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteConfirmOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setDeleteConfirmOpen(false)} aria-hidden />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">Delete this meeting?</h3>
              <p className="text-sm text-foreground/70 mb-4">
                This will permanently remove the meeting and its summary from the database. This cannot be undone.
              </p>
              {deleteError && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-3" role="alert">
                  {deleteError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="px-4 py-2 border border-border rounded-md hover:bg-foreground/10 text-sm font-medium"
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setDeleteError(null);
                    const orgId = meeting.team?.organizationId ?? organizationId;
                    if (!orgId) {
                      setDeleteError('Organization not found for this meeting.');
                      return;
                    }
                    try {
                      setDeleting(true);
                      await meetingsService.remove(orgId, meeting.id);
                      setDeleteConfirmOpen(false);
                      onDeleted?.();
                    } catch (err: unknown) {
                      const status = err && typeof err === 'object' && 'response' in err
                        ? (err as { response?: { status?: number } }).response?.status
                        : null;
                      const msg = err && typeof err === 'object' && 'response' in err
                        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
                        : null;
                      setDeleteError(
                        status === 404
                          ? 'Flight review not found. It may have been deleted already.'
                          : msg || 'Failed to delete flight review. Try again.'
                      );
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-70 text-sm font-medium"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
