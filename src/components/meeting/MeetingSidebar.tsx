'use client';

import { ChevronLeft, ChevronRight, Pause, Play, Square, Wrench, FileText, AlertTriangle, Eye } from 'lucide-react';

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
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onResumeFromSuspend?: () => void;
  onFinish: () => void;
  onPrevSegment?: () => void;
  onNextSegment?: () => void;
  onSuspend?: () => void;
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
  onStart,
  onPause,
  onResume,
  onResumeFromSuspend,
  onFinish,
  onPrevSegment,
  onNextSegment,
  onSuspend,
}: MeetingSidebarProps) {
  const currentIndex = sections.findIndex((s) => s.id === currentSection);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < sections.length - 1;

  return (
    <div className="h-full bg-card border-r border-border flex flex-col w-full">
      {/* Total time lapsed */}
      <div className="p-4 border-b border-border">
        <div className="text-sm font-medium text-foreground/80 mb-1">Total: {totalTime}</div>
        {/* Current segment timer + progress bar (above prev/next) */}
        <div className="text-xs font-medium text-foreground/60 uppercase tracking-wide mb-1">Current segment</div>
        <div className="text-2xl font-bold text-foreground mb-2">{segmentTime}</div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, segmentProgressPercent))}%` }}
          />
        </div>
        {/* Rewind | Start/Pause/Resume | Forward | Suspend */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevSegment}
            disabled={!canGoPrev || isSuspended}
            className="p-2 rounded-md hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Previous segment"
          >
            <ChevronLeft className="w-5 h-5 text-foreground/70" />
          </button>
          {isSuspended && onResumeFromSuspend ? (
            <button
              type="button"
              onClick={onResumeFromSuspend}
              className="flex-1 flex items-center justify-center p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              aria-label="Resume"
            >
              <Play className="w-4 h-4" />
            </button>
          ) : !isRunning ? (
            <button
              type="button"
              onClick={onStart}
              className="flex-1 flex items-center justify-center p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              aria-label="Start"
            >
              <Play className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              className="flex-1 flex items-center justify-center p-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
              aria-label="Pause"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onNextSegment}
            disabled={!canGoNext || isSuspended}
            className="p-2 rounded-md hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Next segment"
          >
            <ChevronRight className="w-5 h-5 text-foreground/70" />
          </button>
          {onSuspend && (
            <button
              type="button"
              onClick={onSuspend}
              className="px-3 py-2 text-sm text-foreground/80 hover:bg-accent rounded-md transition-colors"
            >
              SUSPEND
            </button>
          )}
        </div>
      </div>

      {/* Seven segments list with numbers */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-0.5">
          {sections.map((section, index) => {
            const isActive = currentSection === section.id;
            const segmentNumber = index + 1;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionClick(section.id)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors border-l-2 ${
                  isActive
                    ? 'border-primary bg-primary/5 text-primary font-semibold'
                    : 'border-transparent text-foreground/70 hover:bg-accent hover:text-foreground'
                }`}
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

      {/* Tangent | View tools | Show notes */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-accent transition-colors text-sm bg-background"
          >
            <AlertTriangle className="w-4 h-4 text-foreground/70" />
            Tangent
          </button>
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-accent transition-colors text-sm bg-background"
          >
            <Eye className="w-4 h-4 text-foreground/70" />
            View tools
          </button>
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-accent transition-colors text-sm bg-background"
          >
            <FileText className="w-4 h-4 text-foreground/70" />
            Show notes
          </button>
        </div>
        {/* Finish */}
        <button
          type="button"
          onClick={onFinish}
          className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium flex items-center justify-center gap-2"
        >
          <Square className="w-4 h-4" />
          Finish
        </button>
      </div>
    </div>
  );
}
