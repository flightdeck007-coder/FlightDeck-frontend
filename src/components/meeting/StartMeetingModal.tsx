'use client';

import { Calendar, Clock, X } from 'lucide-react';

interface StartMeetingModalProps {
  onClose: () => void;
  onQuickStart: () => void;
  onSchedule: () => void;
  isStarting?: boolean;
}

export function StartMeetingModal({
  onClose,
  onQuickStart,
  onSchedule,
  isStarting = false,
}: StartMeetingModalProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-xl border border-border bg-card shadow-xl p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-meeting-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="start-meeting-title" className="text-lg font-semibold text-foreground">
            Initiate or schedule flight reviews for your crew
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-foreground hover:bg-foreground/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-foreground/70 mb-6">
          Initiate Flight Review now or schedule Flight Review for later (date, time, and facilitator).
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => { onQuickStart(); onClose(); }}
            disabled={isStarting}
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-left font-medium disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <Calendar className="w-5 h-5 shrink-0" />
            <span>Initiate Flight Review</span>
          </button>
          <button
            type="button"
            onClick={() => { onSchedule(); onClose(); }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border text-foreground hover:bg-foreground/10 transition-colors text-left font-medium"
          >
            <Clock className="w-5 h-5 shrink-0" />
            <span>Schedule Flight Review</span>
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-foreground hover:bg-foreground/10 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
