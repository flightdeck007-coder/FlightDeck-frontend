'use client';

import { useState } from 'react';
import { MeetingLayout } from '@/components/meeting/MeetingLayout';
import { MeetingSidebar } from '@/components/meeting/MeetingSidebar';
import { MeetingContent } from '@/components/meeting/MeetingContent';
import { useParams } from 'next/navigation';

// L10 Meeting Format Sections
const meetingSections = [
  { id: 'segue', title: 'SEGUE', duration: 5, order: 1 },
  { id: 'scorecard', title: 'DATA', duration: 5, order: 2 },
  { id: 'rocks', title: 'ROCK REVIEW', duration: 10, order: 3 },
  { id: 'todos', title: 'TO-DO LIST', duration: 10, order: 4 },
  { id: 'issues', title: 'IDS™', duration: 20, order: 5 },
  { id: 'conclude', title: 'CONCLUDE', duration: 5, order: 6 },
];

export default function MeetingPage() {
  const params = useParams();
  const meetingId = params.id as string;
  const [currentSection, setCurrentSection] = useState<string>('segue');
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [totalTime, setTotalTime] = useState('00:55');

  const handleStart = () => {
    setIsRunning(true);
    // Timer logic would go here
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleResume = () => {
    setIsRunning(true);
  };

  const handleFinish = () => {
    setIsRunning(false);
    // Save meeting logic
  };

  const currentSectionData = meetingSections.find(s => s.id === currentSection) || meetingSections[0];

  return (
    <MeetingLayout>
      {/* Sidebar - 20% */}
      <div className="w-1/5 min-w-[250px] flex-shrink-0">
        <MeetingSidebar
          sections={meetingSections}
          currentSection={currentSection}
          onSectionClick={setCurrentSection}
          totalTime={totalTime}
          elapsedTime={elapsedTime}
          isRunning={isRunning}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onFinish={handleFinish}
        />
      </div>

      {/* Main Content - 80% */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Meeting Header */}
          <div className="p-4 border-b border-border bg-card">
            <h1 className="text-lg font-semibold text-foreground">
              IDS™ | Level 10 Meeting™ - Leadership Team
            </h1>
            <p className="text-sm text-foreground/70 mt-1">Meeting ID: {meetingId}</p>
          </div>

          {/* Meeting Content */}
          <MeetingContent
            sectionId={currentSection}
            sectionTitle={currentSectionData.title}
          />
        </div>
      </div>
    </MeetingLayout>
  );
}
