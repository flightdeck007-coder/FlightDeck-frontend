'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Square, LogOut, Wrench, FileText, AlertTriangle, Eye, EyeOff, Loader2, Users } from 'lucide-react';

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
}: MeetingSidebarProps) {
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const currentIndex = sections.findIndex((s) => s.id === currentSection);
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
          <div className="flex items-center gap-2 text-sm font-medium text-foreground/80 mb-3">
            <Users className="w-4 h-4 shrink-0" />
            <span>Participants ({count})</span>
          </div>
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

      {/* Tangent | View tools | Show notes */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-foreground/10 transition-colors text-sm bg-background text-foreground"
          >
            <AlertTriangle className="w-4 h-4 text-foreground/70" />
            Tangent
          </button>
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-foreground/10 transition-colors text-sm bg-background text-foreground"
          >
            <Eye className="w-4 h-4 text-foreground/70" />
            View tools
          </button>
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
        </div>
        {/* Finish (facilitator) or Exit (member) */}
        {isFacilitator ? (
          <button
            type="button"
            onClick={onFinish}
            disabled={finishLoading}
            className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            title="End meeting for everyone"
          >
            {finishLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            Finish
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
