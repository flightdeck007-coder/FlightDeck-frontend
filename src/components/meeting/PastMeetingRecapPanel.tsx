'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  X,
  Pencil,
  MoreHorizontal,
  ExternalLink,
  Plus,
  Paperclip,
  Download,
  FileText,
  User,
} from 'lucide-react';
import type { Meeting } from '@/lib/api/meetings.service';
import { meetingsService } from '@/lib/api/meetings.service';
import { ROUTES } from '@/lib/constants/routes';

export interface MeetingRecapTodo {
  id: string;
  title: string;
  assigneeInitials?: string;
}

export interface MeetingRecapIssue {
  id: string;
  title: string;
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
  ratings?: Array<{ userName: string; rating: number | null }>;
  attachments?: Array<{ id: string; name: string; url?: string }>;
}

interface PastMeetingRecapPanelProps {
  meeting: Meeting;
  recap?: MeetingRecapData | null;
  recapLoading?: boolean;
  organizationId: string;
  teamId: string;
  onClose: () => void;
}

/** Notes by participant: from meeting.sections[].notes, grouped by author */
function getNotesByParticipant(meeting: Meeting): Array<{ authorName: string; content: string }> {
  const byAuthor = new Map<string, { authorName: string; content: string }>();
  for (const section of meeting.sections ?? []) {
    for (const note of section.notes ?? []) {
      const authorId = note.author?.id ?? '';
      const name = note.author?.name ?? note.author?.email ?? 'Unknown';
      const existing = byAuthor.get(authorId);
      if (existing) {
        existing.content += '\n\n' + (note.content || '').trim();
      } else {
        byAuthor.set(authorId, { authorName: name, content: (note.content || '').trim() });
      }
    }
  }
  return Array.from(byAuthor.values()).filter((n) => n.content.length > 0);
}

export function PastMeetingRecapPanel({
  meeting,
  recap,
  recapLoading = false,
  organizationId,
  teamId,
  onClose,
}: PastMeetingRecapPanelProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localAttachments, setLocalAttachments] = useState<Array<{ id: string; name: string; url?: string }>>([]);
  const [apiAttachments, setApiAttachments] = useState<Array<{ id: string; fileName: string }>>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(true);

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
  const ratings = recap?.ratings ?? meeting.attendances.map((a) => ({
    userName: a.user.name || a.user.email || 'Attendee',
    rating: null as number | null,
  }));
  const attachmentsFromApi = apiAttachments.map((a) => ({ id: a.id, name: a.fileName, fromApi: true as const }));
  const attachmentsFromRecap = (recap?.attachments?.length ? recap.attachments : localAttachments) ?? [];
  const allAttachments = [
    ...attachmentsFromApi,
    ...attachmentsFromRecap.map((a) => ({ id: a.id, name: a.name, fromApi: false as const })),
  ];

  const notesByParticipant = useMemo(() => getNotesByParticipant(meeting), [meeting]);

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

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border shadow-xl z-50 flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            Past Level 10 Meeting™
            {recapLoading && (
              <span className="text-xs font-normal text-muted-foreground animate-pulse">Loading recap…</span>
            )}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Edit meeting"
            >
              <Pencil className="w-4 h-4" />
            </button>
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

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* To-Dos Created */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2">To-Dos Created</h3>
            {todosCreated.length === 0 ? (
              <p className="text-sm text-muted-foreground">No to-dos created in this meeting.</p>
            ) : (
              <ul className="space-y-2">
                {todosCreated.map((todo) => (
                  <li
                    key={todo.id}
                    className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0"
                  >
                    <span className="text-sm text-foreground truncate flex-1">{todo.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={todosPageUrl}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Open on main To-Do page"
                        aria-label="Open to-do on main page"
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

          {/* Issues Solved */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2">Issues Solved</h3>
            {issuesSolved.length === 0 ? (
              <div className="rounded-lg bg-amber-100 dark:bg-amber-950/60 border-2 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-100 px-4 py-3 text-center text-sm font-medium">
                No Issues were solved during this Meeting
              </div>
            ) : (
              <ul className="space-y-1.5">
                {issuesSolved.map((issue) => (
                  <li key={issue.id} className="text-sm text-foreground py-1">
                    {issue.title}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Short-Term Issues stats */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">Short-Term Issues</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-lg p-3 border border-border">
                <p className="text-xs text-muted-foreground mb-0.5">Total Tracked Issues</p>
                <p className="text-xl font-bold text-foreground">{stats.totalTracked}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 border border-border">
                <p className="text-xs text-muted-foreground mb-0.5">Issues Solved Last Meeting</p>
                <p className="text-xl font-bold text-foreground">{stats.solvedLastMeeting}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 border border-border">
                <p className="text-xs text-muted-foreground mb-0.5">Issues Solved Today</p>
                <p className="text-xl font-bold text-foreground">{stats.solvedToday}</p>
                <span className="text-xs text-muted-foreground">↓ 0</span>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 border border-border">
                <p className="text-xs text-muted-foreground mb-0.5">Solve Rate</p>
                <p className="text-xl font-bold text-foreground">{stats.solveRatePercent}%</p>
              </div>
            </div>
          </section>

          {/* Meeting Notes by participant */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Meeting Notes
            </h3>
            {notesByParticipant.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes from participants in this meeting.</p>
            ) : (
              <div className="space-y-4">
                {notesByParticipant.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-card overflow-hidden"
                  >
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground text-sm">{item.authorName}</span>
                    </div>
                    <div className="p-3 text-sm text-foreground whitespace-pre-wrap break-words">
                      {item.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Attachments (downloadable) */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
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
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2">Ratings</h3>
            <ul className="space-y-1.5">
              {ratings.map((r, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{r.userName}</span>
                  <span className="text-muted-foreground">
                    {r.rating != null ? r.rating : 'N/A'}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Section Durations */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2">Section Durations</h3>
            <ul className="space-y-0 divide-y divide-border border border-border rounded-lg overflow-hidden">
              {sectionDurations.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between px-3 py-2 text-sm bg-card hover:bg-muted/30"
                >
                  <span className="text-foreground font-medium">{s.sectionTitle}</span>
                  <span className="text-muted-foreground tabular-nums">{s.durationMMSS}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
