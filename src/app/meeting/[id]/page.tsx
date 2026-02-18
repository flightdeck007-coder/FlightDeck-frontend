'use client';

import { useEffect, useState } from 'react';
import { MeetingLayout } from '@/components/meeting/MeetingLayout';
import { MeetingSidebar } from '@/components/meeting/MeetingSidebar';
import { MeetingContent } from '@/components/meeting/MeetingContent';
import { useParams, useRouter } from 'next/navigation';
import { meetingsService } from '@/lib/api/meetings.service';
import { ROUTES } from '@/lib/constants/routes';

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
  const router = useRouter();
  const [currentSection, setCurrentSection] = useState<string>('segue');
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [totalTime, setTotalTime] = useState('00:55');
  const [headerTitle, setHeaderTitle] = useState('IDS™ | Level 10 Meeting™ - Leadership Team');
  const [loadedSections, setLoadedSections] = useState(meetingSections);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [orgRole, setOrgRole] = useState<string | null>(null);

  useEffect(() => {
    const storedOrgId = typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null;
    const storedRole = typeof window !== 'undefined' ? localStorage.getItem('organizationRole') : null;
    if (storedOrgId) setOrganizationId(storedOrgId);
    if (storedRole) setOrgRole(storedRole);
  }, []);

  useEffect(() => {
    // load meeting details (real) if available
    if (!organizationId || !meetingId) return;
    (async () => {
      try {
        const meeting = await meetingsService.findOne(organizationId, meetingId);
        setHeaderTitle(`IDS™ | Level 10 Meeting™ - ${meeting.team.name}`);
        if (meeting.sections?.length) {
          const normalized = meeting.sections
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => ({
              id: s.title.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
              title: s.title,
              duration: s.durationMinutes ?? 5,
              order: s.order + 1,
            }));
          setLoadedSections(normalized);
          setCurrentSection(normalized[0]?.id || 'segue');
        }
      } catch {
        // keep static template
      }
    })();
  }, [organizationId, meetingId]);

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
    if (!organizationId) {
      router.push(ROUTES.MEETINGS);
      return;
    }
    (async () => {
      try {
        await meetingsService.update(organizationId, meetingId, {
          endedAt: new Date().toISOString(),
        });
      } finally {
        router.push(ROUTES.MEETINGS);
      }
    })();
  };

  const currentSectionData =
    loadedSections.find((s) => s.id === currentSection) || loadedSections[0];

  return (
    <MeetingLayout>
      {/* Sidebar - 20% */}
      <div className="w-1/5 min-w-[250px] flex-shrink-0">
        <MeetingSidebar
          sections={loadedSections}
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
              {headerTitle}
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
      {/* Footer actions */}
      <div className="absolute bottom-4 right-4 flex gap-3">
        {orgRole === 'ADMIN' || orgRole === 'MANAGER' ? (
          <button
            onClick={handleFinish}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Finish Meeting
          </button>
        ) : null}
      </div>
    </MeetingLayout>
  );
}
