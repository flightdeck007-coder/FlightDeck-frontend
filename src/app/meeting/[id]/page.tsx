'use client';

import { useEffect, useState, useCallback } from 'react';
import { MeetingLayout } from '@/components/meeting/MeetingLayout';
import { MeetingSidebar } from '@/components/meeting/MeetingSidebar';
import { MeetingContent } from '@/components/meeting/MeetingContent';
import { CreatePopup } from '@/components/meeting/CreatePopup';
import { RocksProvider } from '@/contexts/RocksContext';
import { HeadlinesProvider } from '@/contexts/HeadlinesContext';
import { useParams, useRouter } from 'next/navigation';
import { meetingsService } from '@/lib/api/meetings.service';
import { ROUTES } from '@/lib/constants/routes';
import { Menu, User, Plus } from 'lucide-react';

// L10 Meeting Format Sections: flight term (real term). 7 segments. IDs stay canonical for content lookup.
const meetingSections = [
  { id: 'segue', title: 'PRE-FLIGHT (Segue)', duration: 5, order: 1 },
  { id: 'scorecard', title: 'INSTRUMENTS (Scorecard)', duration: 5, order: 2 },
  { id: 'rocks', title: 'WAYPOINT REVIEW (Rocks)', duration: 5, order: 3 },
  { id: 'headlines', title: 'HEADLINES (Customer/Employee)', duration: 5, order: 4 },
  { id: 'todos', title: 'CLEARANCES (To-Dos)', duration: 5, order: 5 },
  { id: 'issues', title: 'TURBULENCE (Issues)', duration: 60, order: 6 },
  { id: 'conclude', title: 'DEBRIEF (Conclude)', duration: 5, order: 7 },
];

// Map API section titles (flight (real) or legacy) to canonical section id for content
const sectionTitleToId: Record<string, string> = {
  'PRE-FLIGHT (Segue)': 'segue', 'PRE-FLIGHT (SEGUE)': 'segue',
  'INSTRUMENTS (Scorecard)': 'scorecard', 'INSTRUMENTS (SCORECARD)': 'scorecard',
  'WAYPOINT REVIEW (Rocks)': 'rocks', 'WAYPOINT REVIEW (ROCKS)': 'rocks',
  'HEADLINES (Customer/Employee)': 'headlines', 'HEADLINES (CUSTOMER/EMPLOYEE)': 'headlines',
  'CUSTOMER/EMPLOYEE HEADLINES': 'headlines',
  'CLEARANCES (To-Dos)': 'todos', 'CLEARANCES (TO-DOS)': 'todos',
  'TURBULENCE (Issues)': 'issues', 'TURBULENCE (ISSUES)': 'issues',
  'DEBRIEF (Conclude)': 'conclude', 'DEBRIEF (CONCLUDE)': 'conclude',
  'PRE-FLIGHT': 'segue', 'SEGUE': 'segue',
  'INSTRUMENTS': 'scorecard', 'DATA': 'scorecard', 'SCORECARD': 'scorecard',
  'WAYPOINT REVIEW': 'rocks', 'ROCK REVIEW': 'rocks', 'ROCKS': 'rocks',
  'CLEARANCES': 'todos', 'TO-DO LIST': 'todos', 'TO-DOS': 'todos',
  'TURBULENCE': 'issues', 'IDS™': 'issues', 'ISSUES': 'issues',
  'DEBRIEF': 'conclude', 'CONCLUDE': 'conclude',
};

export default function MeetingPage() {
  const params = useParams();
  const meetingId = params.id as string;
  const router = useRouter();
  const [currentSection, setCurrentSection] = useState<string>('segue');
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [totalTime, setTotalTime] = useState('00:55');
  const [segmentTime, setSegmentTime] = useState('00:00');
  const [segmentProgressPercent, setSegmentProgressPercent] = useState(0);
  const [segmentElapsedSeconds, setSegmentElapsedSeconds] = useState(0);
  const [totalElapsedSeconds, setTotalElapsedSeconds] = useState(0);
  const [headerTitle, setHeaderTitle] = useState('Weekly Flight Review - Leadership Team');
  const [loadedSections, setLoadedSections] = useState(meetingSections);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [orgRole, setOrgRole] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userInitials, setUserInitials] = useState('U');
  const [isSuspended, setIsSuspended] = useState(false);
  const [createPopupOpen, setCreatePopupOpen] = useState(false);

  useEffect(() => {
    const storedOrgId = typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null;
    const storedRole = typeof window !== 'undefined' ? localStorage.getItem('organizationRole') : null;
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (storedOrgId) setOrganizationId(storedOrgId);
    if (storedRole) setOrgRole(storedRole);
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        const name = u?.name || u?.email || '';
        setUserInitials(name ? name.slice(0, 2).toUpperCase() : 'U');
      } catch {
        setUserInitials('U');
      }
    }
  }, []);

  useEffect(() => {
    if (!organizationId || !meetingId) return;
    (async () => {
      try {
        const meeting = await meetingsService.findOne(organizationId, meetingId);
        setHeaderTitle(`Weekly Flight Review - ${meeting.team.name}`);
        const suspended = !!(meeting.suspendedAt && !meeting.endedAt);
        setIsSuspended(suspended);
        if (meeting.sections?.length) {
          const normalized = meeting.sections
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => {
              const canonicalId = sectionTitleToId[s.title] ?? s.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
              return {
                id: canonicalId,
                title: s.title,
                duration: s.durationMinutes ?? 5,
                order: s.order + 1,
              };
            });
          setLoadedSections(normalized);
          setCurrentSection(normalized[0]?.id || 'segue');
        }
      } catch {
        // keep static template
      }
    })();
  }, [organizationId, meetingId]);

  function formatMMSS(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const currentSectionData =
    loadedSections.find((s) => s.id === currentSection) || loadedSections[0];
  const segmentDurationSeconds = (currentSectionData?.duration ?? 5) * 60;

  // Timer: when running, tick every second; derive segment time, total time, and progress %
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSegmentElapsedSeconds((prev) => prev + 1);
      setTotalElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Derive segment time display and progress (0% = 00:00, 100% = segment duration e.g. 05:00)
  useEffect(() => {
    setSegmentTime(formatMMSS(segmentElapsedSeconds));
    setTotalTime(formatMMSS(totalElapsedSeconds));
    const pct = segmentDurationSeconds > 0
      ? Math.min(100, (segmentElapsedSeconds / segmentDurationSeconds) * 100)
      : 0;
    setSegmentProgressPercent(pct);
  }, [segmentElapsedSeconds, totalElapsedSeconds, segmentDurationSeconds]);

  // Reset segment elapsed when switching segment
  useEffect(() => {
    setSegmentElapsedSeconds(0);
  }, [currentSection]);

  const handleStart = () => {
    setIsRunning(true);
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

  const currentIndex = loadedSections.findIndex((s) => s.id === currentSection);
  const handlePrevSegment = useCallback(() => {
    if (currentIndex > 0) setCurrentSection(loadedSections[currentIndex - 1].id);
  }, [currentIndex, loadedSections]);
  const handleNextSegment = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < loadedSections.length - 1) {
      setCurrentSection(loadedSections[currentIndex + 1].id);
    }
  }, [currentIndex, loadedSections]);
  const handleSuspend = useCallback(async () => {
    if (!organizationId) return;
    try {
      await meetingsService.suspend(organizationId, meetingId);
      setIsSuspended(true);
      setIsRunning(false);
      // Kick user out to meeting list; meeting status is now suspended
      router.push(ROUTES.MEETINGS);
    } catch {
      // show error or keep state
    }
  }, [organizationId, meetingId, router]);

  const handleResumeFromSuspend = useCallback(async () => {
    if (!organizationId) return;
    try {
      await meetingsService.resume(organizationId, meetingId);
      setIsSuspended(false);
      setIsRunning(true);
    } catch {
      // show error
    }
  }, [organizationId, meetingId]);

  const headerSegmentLine = `${currentSectionData.title} | ${headerTitle}`;

  return (
    <RocksProvider>
    <HeadlinesProvider>
    <MeetingLayout>
      {/* Sidebar - collapsible */}
      {sidebarOpen && (
        <div className="w-64 min-w-[240px] flex-shrink-0 overflow-hidden">
          <MeetingSidebar
            sections={loadedSections}
            currentSection={currentSection}
            onSectionClick={setCurrentSection}
            totalTime={totalTime}
            segmentTime={segmentTime}
            segmentProgressPercent={segmentProgressPercent}
            isRunning={isRunning}
            isSuspended={isSuspended}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onResumeFromSuspend={handleResumeFromSuspend}
            onFinish={handleFinish}
            onPrevSegment={handlePrevSegment}
            onNextSegment={handleNextSegment}
            onSuspend={handleSuspend}
          />
        </div>
      )}

      {/* Main: header row + component details row */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Header row: hamburger | Segment | Meeting - Team | user + Create */}
        <header className="flex items-center gap-4 p-4 border-b border-border bg-card shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <Menu className="w-5 h-5 text-foreground/80" />
          </button>
          <h1 className="text-lg font-semibold text-foreground truncate flex-1">
            {headerSegmentLine}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium"
              title="Logged in user"
            >
              {userInitials}
            </div>
            <button
              type="button"
              onClick={() => setCreatePopupOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Create
            </button>
          </div>
        </header>

        <CreatePopup
          open={createPopupOpen}
          onClose={() => setCreatePopupOpen(false)}
          teamName={headerTitle.replace(/^.*-\s*/, '').trim() || 'Leadership Team'}
        />

        {/* Suspended banner */}
        {isSuspended && (
          <div className="shrink-0 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-200 flex items-center justify-between">
            <span className="font-medium">Meeting suspended</span>
            <span className="text-sm">Resume from the sidebar when ready.</span>
          </div>
        )}

        {/* Component details row */}
        <div className="flex-1 overflow-auto">
          <MeetingContent
            sectionId={currentSection}
            sectionTitle={currentSectionData.title}
          />
        </div>
      </div>
    </MeetingLayout>
    </HeadlinesProvider>
    </RocksProvider>
  );
}
