'use client';

import { X, CheckCircle } from 'lucide-react';

const DEFAULT_DURATION_MINUTES = 90;

function toGoogleCalendarDates(isoStart: string, durationMinutes: number): string {
  const start = new Date(isoStart);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const format = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  return `${format(start)}/${format(end)}`;
}

function buildGoogleCalendarUrl(params: {
  title: string;
  startIso: string;
  durationMinutes?: number;
  userEmail?: string;
}): string {
  const { title, startIso, durationMinutes = DEFAULT_DURATION_MINUTES, userEmail } = params;
  const base = 'https://calendar.google.com/calendar/u/0/r/eventedit';
  const search = new URLSearchParams();
  if (userEmail) search.set('add', userEmail);
  search.set('dates', toGoogleCalendarDates(startIso, durationMinutes));
  search.set('text', title);
  return `${base}?${search.toString()}`;
}

function formatWhen(isoStart: string, durationMinutes: number): string {
  const start = new Date(isoStart);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  const dateStr = start.toLocaleDateString(undefined, opts);
  const startTime = start.toLocaleTimeString(undefined, timeOpts);
  const endTime = end.toLocaleTimeString(undefined, timeOpts);
  return `${dateStr}, ${startTime} – ${endTime}`;
}

export interface MeetingScheduledModalProps {
  open: boolean;
  onClose: () => void;
  agendaName: string;
  teamName: string;
  scheduledAt: string;
  durationMinutes?: number;
  userEmail?: string;
}

export function MeetingScheduledModal({
  open,
  onClose,
  agendaName,
  teamName,
  scheduledAt,
  durationMinutes = DEFAULT_DURATION_MINUTES,
  userEmail,
}: MeetingScheduledModalProps) {
  if (!open) return null;

  const title = `${agendaName} - ${teamName}`;
  const googleUrl = buildGoogleCalendarUrl({
    title,
    startIso: scheduledAt,
    durationMinutes,
    userEmail,
  });

  const handleGoogleClick = () => {
    window.open(googleUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-2xl rounded-xl border border-border bg-card shadow-xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-scheduled-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <h2 id="meeting-scheduled-title" className="text-xl font-semibold text-foreground">
            Meeting Scheduled
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 flex flex-col">
          <div className="flex items-center gap-4 mb-6">
            <div className="rounded-full bg-green-500/10 p-3 shrink-0">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Details</p>
              <p className="font-medium text-foreground truncate">{title}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Agenda</p>
              <p className="text-sm font-medium text-foreground">{agendaName}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Team</p>
              <p className="text-sm font-medium text-foreground">{teamName}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">When</p>
              <p className="text-sm font-medium text-foreground">{formatWhen(scheduledAt, durationMinutes)}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/10 p-5">
            <p className="text-sm font-medium text-foreground mb-4">Add meeting to your calendar</p>
            <button
              type="button"
              onClick={handleGoogleClick}
              className="flex items-center gap-3 w-full sm:w-auto px-5 py-3 rounded-lg border border-border bg-background hover:bg-accent transition-colors cursor-pointer text-left"
              title="Add to Google Calendar"
            >
              <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-border shadow-sm overflow-hidden">
                <img src="/google-calender.png" alt="" className="w-6 h-6 object-contain" aria-hidden />
              </span>
              <span className="font-medium text-foreground">Google Calendar</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
