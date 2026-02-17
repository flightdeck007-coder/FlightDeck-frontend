'use client';

import { Clock, Play, Pause, SkipForward, Square, Wrench, FileText } from 'lucide-react';

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
  elapsedTime: string;
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
}

export function MeetingSidebar({
  sections,
  currentSection,
  onSectionClick,
  totalTime,
  elapsedTime,
  isRunning,
  onStart,
  onPause,
  onResume,
  onFinish,
}: MeetingSidebarProps) {
  return (
    <div className="h-full bg-card border-r border-border flex flex-col">
      {/* Timer */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-foreground/70" />
            <span className="text-sm font-medium text-foreground">Total: {totalTime}</span>
          </div>
        </div>
        <div className="text-2xl font-bold text-foreground mb-3">{elapsedTime}</div>
        
        {/* Timer Controls */}
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              onClick={onStart}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
            >
              <Play className="w-4 h-4" />
              Start
            </button>
          ) : (
            <button
              onClick={onPause}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors text-sm"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}
          <button className="p-2 border border-border rounded-md hover:bg-accent transition-colors">
            <SkipForward className="w-4 h-4 text-foreground/70" />
          </button>
          <button className="p-2 border border-border rounded-md hover:bg-accent transition-colors">
            <Square className="w-4 h-4 text-foreground/70" />
          </button>
        </div>
      </div>

      {/* Agenda Sections */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {sections.map((section, index) => {
            const isActive = currentSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => onSectionClick(section.id)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                    : 'text-foreground/70 hover:bg-accent hover:text-foreground'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{index + 1}.</span>
                    <span className="text-sm">{section.title}</span>
                  </div>
                  <span className="text-xs text-foreground/50">{section.duration} MIN</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <button
          onClick={onFinish}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          FINISH →
        </button>
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-accent transition-colors text-sm">
            <Wrench className="w-4 h-4" />
            VIEW TOOL
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-accent transition-colors text-sm">
            <FileText className="w-4 h-4" />
            NOTES
          </button>
        </div>
      </div>
    </div>
  );
}
