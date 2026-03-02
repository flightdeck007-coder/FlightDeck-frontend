'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { MeetingLayout } from '@/components/meeting/MeetingLayout';
import { MeetingSidebar } from '@/components/meeting/MeetingSidebar';
import { MeetingContent } from '@/components/meeting/MeetingContent';
import { MeetingNotesSection } from '@/components/meeting/MeetingNotesSection';
import { CreatePopup } from '@/components/meeting/CreatePopup';
import { RocksProvider } from '@/contexts/RocksContext';
import { HeadlinesProvider } from '@/contexts/HeadlinesContext';
import { TodosProvider } from '@/contexts/TodosContext';
import { IssuesProvider } from '@/contexts/IssuesContext';
import { MeetingSocketProvider } from '@/contexts/MeetingSocketContext';
import { MeetingRealtimeSync } from '@/components/meeting/MeetingRealtimeSync';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { meetingsService } from '@/lib/api/meetings.service';
import type { Meeting } from '@/lib/api/meetings.service';
import { issuesService } from '@/lib/api/issues.service';
import { ROUTES } from '@/lib/constants/routes';
import { Menu, User, Plus, Loader2 } from 'lucide-react';
import { FullScreenLoaderWithText } from '@/components/ui/loaders';

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

const VALID_SEGMENT_IDS = ['segue', 'scorecard', 'rocks', 'headlines', 'todos', 'issues', 'conclude'];
const SUSPENDED_STATE_KEY_PREFIX = 'meeting-app-suspended-';
const RESUME_MEETING_KEY = 'meeting-app-resumeMeetingId';

function getInitialSegment(): string {
  if (typeof window === 'undefined') return 'segue';
  const seg = new URL(window.location.href).searchParams.get('segment');
  return seg && VALID_SEGMENT_IDS.includes(seg) ? seg : 'segue';
}

export default function MeetingPage() {
  const params = useParams();
  const meetingId = params.id as string;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [currentSection, setCurrentSection] = useState<string>(getInitialSegment);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [totalTime, setTotalTime] = useState('00:55');
  const [segmentTime, setSegmentTime] = useState('00:00');
  const [segmentProgressPercent, setSegmentProgressPercent] = useState(0);
  const [segmentElapsedSeconds, setSegmentElapsedSeconds] = useState(0);
  const [totalElapsedSeconds, setTotalElapsedSeconds] = useState(0);
  const [headerTitle, setHeaderTitle] = useState('Weekly Flight Review - Leadership Team');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loadedSections, setLoadedSections] = useState(meetingSections);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [teamId, setTeamId] = useState<string>('');
  const [orgRole, setOrgRole] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userInitials, setUserInitials] = useState('U');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSuspended, setIsSuspended] = useState(false);
  const [createPopupOpen, setCreatePopupOpen] = useState(false);
  const [createPopupInitialType, setCreatePopupInitialType] = useState<'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message' | undefined>(undefined);
  const [finishLoading, setFinishLoading] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showNotesSection, setShowNotesSection] = useState(false);
  const [suspendInProgress, setSuspendInProgress] = useState(false);
  const [resumeInProgress, setResumeInProgress] = useState(false);
  const [meetingLoading, setMeetingLoading] = useState(false);
  const segmentStateRef = useRef({ segmentId: 'segue', segmentElapsedSeconds: 0, totalElapsedSeconds: 0 });
  const hasRunResumeRef = useRef(false);
  const skipSegmentResetRef = useRef(false);
  const previousSectionRef = useRef<string | null>(null);
  const sectionDurationsRef = useRef<Array<{ sectionId: string; sectionTitle: string; durationSeconds: number }>>([]);
  const syncEmitRef = useRef<{
    emitSegmentChange: (segmentId: string) => void;
    emitTimerSync: (override?: { segmentElapsedSeconds: number; totalElapsedSeconds: number; isRunning: boolean }) => void;
  } | null>(null);
  const lastTimerSyncRef = useRef<{ segment: number; total: number; ts: number }>({ segment: 0, total: 0, ts: 0 });
  const facilitatorTimerRef = useRef<{ segmentElapsedSeconds: number; totalElapsedSeconds: number; isRunning: boolean }>({ segmentElapsedSeconds: 0, totalElapsedSeconds: 0, isRunning: false });
  const lastEmittedRunningRef = useRef<boolean | null>(null);
  const lastTimerSyncEmitTsRef = useRef(0);
  const SYNC_EMIT_INTERVAL_MS = 2500;

  useEffect(() => {
    const storedOrgId = typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null;
    const storedRole = typeof window !== 'undefined' ? localStorage.getItem('organizationRole') : null;
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (storedOrgId) setOrganizationId(storedOrgId);
    if (storedRole) setOrgRole(storedRole);
    if (userStr) {
      try {
        const u = JSON.parse(userStr) as { id?: string; name?: string; email?: string };
        setCurrentUserId(u?.id ?? null);
        const name = u?.name || u?.email || '';
        setUserInitials(name ? name.slice(0, 2).toUpperCase() : 'U');
      } catch {
        setUserInitials('U');
        setCurrentUserId(null);
      }
    }
  }, []);

  // Restore segment from URL on load (so refresh keeps you on e.g. ?segment=todos)
  useEffect(() => {
    const segment = searchParams.get('segment');
    if (segment && VALID_SEGMENT_IDS.includes(segment)) {
      setCurrentSection(segment);
    }
  }, [searchParams]);

  // Reset meeting-specific refs when navigating to a different meeting (avoid reusing previous meeting data)
  useEffect(() => {
    sectionDurationsRef.current = [];
    previousSectionRef.current = null;
    hasRunResumeRef.current = false;
  }, [meetingId]);

  useEffect(() => {
    if (!organizationId || !meetingId) return;
    setMeetingLoading(true);
    (async () => {
      try {
        const meeting = await meetingsService.findOne(organizationId, meetingId);
        setMeeting(meeting);
        setHeaderTitle(`Weekly Flight Review - ${meeting.team.name}`);
        setTeamId(meeting.teamId);
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
          // Only set section from API if current segment is not in loaded sections (e.g. invalid URL)
          setCurrentSection((prev) =>
            normalized.some((s) => s.id === prev) ? prev : (normalized[0]?.id || 'segue')
          );
        }
      } catch {
        // keep static template
      } finally {
        setMeetingLoading(false);
      }
    })();
  }, [organizationId, meetingId]);

  // When landing on a suspended meeting with resume intent: restore position and resume
  useEffect(() => {
    if (!organizationId || !meetingId || !isSuspended || loadedSections.length === 0) return;
    if (typeof window === 'undefined') return;
    const resumeId = window.sessionStorage.getItem(RESUME_MEETING_KEY);
    if (resumeId !== meetingId || hasRunResumeRef.current) return;
    hasRunResumeRef.current = true;
    setResumeInProgress(true);
    (async () => {
      try {
        await meetingsService.resume(organizationId, meetingId);
        const raw = window.localStorage.getItem(`${SUSPENDED_STATE_KEY_PREFIX}${meetingId}`);
        if (raw) {
          try {
            const saved = JSON.parse(raw) as { segmentId?: string; segmentElapsedSeconds?: number; totalElapsedSeconds?: number };
            const segmentId = saved.segmentId && VALID_SEGMENT_IDS.includes(saved.segmentId) ? saved.segmentId : loadedSections[0]?.id ?? 'segue';
            skipSegmentResetRef.current = true;
            setSegmentElapsedSeconds(Math.max(0, saved.segmentElapsedSeconds ?? 0));
            setTotalElapsedSeconds(Math.max(0, saved.totalElapsedSeconds ?? 0));
            setCurrentSection(segmentId);
            router.replace(`${pathname}?segment=${segmentId}`, { scroll: false });
          } finally {
            window.localStorage.removeItem(`${SUSPENDED_STATE_KEY_PREFIX}${meetingId}`);
          }
        }
        window.sessionStorage.removeItem(RESUME_MEETING_KEY);
        setIsSuspended(false);
        setIsRunning(true);
      } catch {
        // leave suspended state
      } finally {
        setResumeInProgress(false);
      }
    })();
  }, [organizationId, meetingId, isSuspended, loadedSections.length, pathname, router]);

  const handleSectionClick = useCallback(
    (sectionId: string) => {
      setCurrentSection(sectionId);
      router.replace(`${pathname}?segment=${sectionId}`, { scroll: false });
      syncEmitRef.current?.emitSegmentChange?.(sectionId);
    },
    [pathname, router]
  );

  function formatMMSS(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const currentSectionData =
    loadedSections.find((s) => s.id === currentSection) || loadedSections[0];
  const segmentDurationSeconds = (currentSectionData?.duration ?? 5) * 60;

  // Timer: only facilitator runs the interval; keep a ref in sync so broadcast sends correct values (avoids 1-2-1-2 from stale state)
  const isFacilitatorForTimer = Boolean(meeting?.facilitatorId && currentUserId && meeting.facilitatorId === currentUserId);
  useEffect(() => {
    if (!isFacilitatorForTimer) return;
    facilitatorTimerRef.current = { segmentElapsedSeconds: segmentElapsedSeconds, totalElapsedSeconds: totalElapsedSeconds, isRunning };
    const interval = setInterval(() => {
      const ref = facilitatorTimerRef.current;
      const nextTotal = ref.totalElapsedSeconds + 1;
      const nextSegment = ref.isRunning ? ref.segmentElapsedSeconds + 1 : ref.segmentElapsedSeconds;
      facilitatorTimerRef.current = { segmentElapsedSeconds: nextSegment, totalElapsedSeconds: nextTotal, isRunning: ref.isRunning };
      setTotalElapsedSeconds(nextTotal);
      setSegmentElapsedSeconds(nextSegment);
      const now = Date.now();
      if (now - lastTimerSyncEmitTsRef.current >= SYNC_EMIT_INTERVAL_MS) {
        lastTimerSyncEmitTsRef.current = now;
        syncEmitRef.current?.emitTimerSync?.(facilitatorTimerRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, isFacilitatorForTimer]);

  // Derive segment time display and progress (0% = 00:00, 100% = segment duration e.g. 05:00)
  useEffect(() => {
    setSegmentTime(formatMMSS(segmentElapsedSeconds));
    setTotalTime(formatMMSS(totalElapsedSeconds));
    const pct = segmentDurationSeconds > 0
      ? Math.min(100, (segmentElapsedSeconds / segmentDurationSeconds) * 100)
      : 0;
    setSegmentProgressPercent(pct);
  }, [segmentElapsedSeconds, totalElapsedSeconds, segmentDurationSeconds]);

  // When segment *id* actually changes only: record previous segment duration for recap, then reset elapsed (never run on loadedSections ref change or segment stays 00:00)
  useEffect(() => {
    if (skipSegmentResetRef.current) {
      skipSegmentResetRef.current = false;
      previousSectionRef.current = currentSection;
      setSegmentElapsedSeconds(0);
      return;
    }
    const prev = previousSectionRef.current;
    if (prev === currentSection) return;
    if (prev != null && loadedSections.length > 0) {
      const title = loadedSections.find((s) => s.id === prev)?.title ?? '';
      const duration = segmentStateRef.current.segmentElapsedSeconds;
      sectionDurationsRef.current.push({
        sectionId: prev,
        sectionTitle: title,
        durationSeconds: duration,
      });
    }
    previousSectionRef.current = currentSection;
    setSegmentElapsedSeconds(0);
    facilitatorTimerRef.current = { ...facilitatorTimerRef.current, segmentElapsedSeconds: 0 };
  }, [currentSection, loadedSections]);

  // Keep ref in sync for saving position on suspend
  useEffect(() => {
    segmentStateRef.current = {
      segmentId: currentSection,
      segmentElapsedSeconds,
      totalElapsedSeconds,
    };
  }, [currentSection, segmentElapsedSeconds, totalElapsedSeconds]);

  // When segment time completes: only facilitator advances and broadcasts (members follow via segment_changed)
  useEffect(() => {
    if (!isFacilitatorForTimer || !isRunning || segmentDurationSeconds <= 0) return;
    if (segmentElapsedSeconds < segmentDurationSeconds) return;
    const idx = loadedSections.findIndex((s) => s.id === currentSection);
    if (idx < 0 || idx >= loadedSections.length - 1) return;
    const nextId = loadedSections[idx + 1].id;
    setCurrentSection(nextId);
    router.replace(`${pathname}?segment=${nextId}`, { scroll: false });
    setSegmentElapsedSeconds(0);
    syncEmitRef.current?.emitSegmentChange?.(nextId);
  }, [isFacilitatorForTimer, isRunning, segmentElapsedSeconds, segmentDurationSeconds, currentSection, loadedSections, pathname, router]);

  // When facilitator starts or pauses, send one immediate sync so members get current values (ref guard prevents double emit in strict mode)
  useEffect(() => {
    if (!isFacilitatorForTimer) return;
    if (lastEmittedRunningRef.current === isRunning) return;
    lastEmittedRunningRef.current = isRunning;
    facilitatorTimerRef.current = { segmentElapsedSeconds, totalElapsedSeconds, isRunning };
    lastTimerSyncEmitTsRef.current = Date.now();
    syncEmitRef.current?.emitTimerSync?.(facilitatorTimerRef.current);
  }, [isFacilitatorForTimer, isRunning]);

  // Members: tick only segment from last sync so segment runs smoothly; total comes only from socket to avoid 1-2-1-2 glitch
  useEffect(() => {
    if (isFacilitatorForTimer) return;
    if (!isRunning || lastTimerSyncRef.current.ts === 0) return;
    const interval = setInterval(() => {
      const ref = lastTimerSyncRef.current;
      if (ref.ts === 0) return;
      const elapsed = Math.floor((Date.now() - ref.ts) / 1000);
      setSegmentElapsedSeconds(Math.max(0, ref.segment + elapsed));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, isFacilitatorForTimer]);

  const handleStart = () => {
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleResume = () => {
    setIsRunning(true);
  };

  const handleFinish = async () => {
    setIsRunning(false);
    // Use meeting's org when available so recap/update use the correct org (avoids 404 from stale localStorage)
    const orgId = meeting?.team?.organizationId || organizationId;
    if (!orgId) {
      router.push(ROUTES.MEETINGS);
      return;
    }
    setFinishLoading(true);
    try {
      // Record current segment duration so it's in the ref before we build the full list (update if already present)
      const currentSectionData = loadedSections.find((s) => s.id === currentSection);
      if (currentSectionData) {
        const existing = sectionDurationsRef.current.find((d) => d.sectionId === currentSection);
        if (existing) {
          existing.durationSeconds = segmentElapsedSeconds;
        } else {
          sectionDurationsRef.current.push({
            sectionId: currentSection,
            sectionTitle: currentSectionData.title,
            durationSeconds: segmentElapsedSeconds,
          });
        }
      }

      // Fresh meeting fetch so we have latest attendances (and any join-after-load)
      let meetingForRecap = meeting;
      try {
        meetingForRecap = await meetingsService.findOne(orgId, meetingId);
      } catch {
        // keep existing meeting state
      }

      // Build recap: ratings from localStorage (keyed by attendance id)
      const ratingsKey = `meeting-ratings-${meetingId}`;
      let ratings: Array<{ attendanceId?: string; userName: string; rating: number | null }> = [];
      const attendances = meetingForRecap?.attendances ?? [];
      if (typeof window !== 'undefined' && attendances.length > 0) {
        try {
          const raw = localStorage.getItem(ratingsKey);
          const parsed = raw ? (JSON.parse(raw) as Array<{ id: string; rating: number | null; absent: boolean }>) : null;
          ratings = attendances.map((a) => {
            const saved = parsed?.find((p) => p.id === a.id);
            const userName = a.user?.name || a.user?.email || 'Attendee';
            return {
              attendanceId: a.id,
              userName,
              rating: saved?.rating ?? null,
            };
          });
        } catch {
          ratings = attendances.map((a) => ({
            attendanceId: a.id,
            userName: a.user?.name || a.user?.email || 'Attendee',
            rating: null as number | null,
          }));
        }
      }

      // Section durations: one row per loaded section in order; use ref when we have it, else current segment time, else 0
      const sectionDurations = loadedSections.map((section) => {
        const fromRef = sectionDurationsRef.current.find((d) => d.sectionId === section.id);
        const seconds =
          fromRef != null
            ? fromRef.durationSeconds
            : section.id === currentSection
              ? segmentElapsedSeconds
              : 0;
        return {
          sectionTitle: section.title,
          durationMMSS: `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
        };
      });

      // Attachments: fetch current list so recap has them for the summary
      let attachments: Array<{ id: string; name: string; url?: string }> = [];
      try {
        const list = await meetingsService.getAttachments(orgId, meetingId);
        attachments = (list || []).map((a: { id: string; fileName: string }) => ({
          id: a.id,
          name: a.fileName,
        }));
      } catch {
        // continue without attachments in recap
      }

      // Issues: fetch short-term active + resolved and long-term resolved for this meeting to build real stats and issues solved
      let shortTermStats = {
        totalTracked: 0,
        solvedLastMeeting: 0,
        solvedToday: 0,
        solveRatePercent: 0,
      };
      let issuesSolved: Array<{ id: string; title: string; resolvedByName?: string | null }> = [];
      const teamId = meetingForRecap?.teamId;
      if (orgId && teamId) {
        try {
          const [shortActive, shortResolved, longResolved] = await Promise.all([
            issuesService.findAll(orgId, teamId, 'short_term', false, meetingId),
            issuesService.findAll(orgId, teamId, 'short_term', true, meetingId),
            issuesService.findAll(orgId, teamId, 'long_term', true, meetingId),
          ]);
          const totalTracked = shortActive.length + shortResolved.length;
          const solvedInMeeting = shortResolved.length + longResolved.length;
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const solvedTodayCount = [...shortResolved, ...longResolved].filter(
            (i) => i.resolvedAt && new Date(i.resolvedAt).getTime() >= todayStart.getTime()
          ).length;
          shortTermStats = {
            totalTracked,
            solvedLastMeeting: solvedInMeeting,
            solvedToday: solvedTodayCount,
            solveRatePercent: totalTracked > 0 ? Math.round((shortResolved.length / totalTracked) * 100) : 0,
          };
          issuesSolved = [...shortResolved, ...longResolved].map((i) => ({
            id: i.id,
            title: i.title,
            resolvedByName: i.resolvedByName ?? null,
          }));
        } catch {
          // keep default zeros and empty list
        }
      }

      const recapPayload = {
        ratings,
        sectionDurations,
        shortTermStats,
        todosCreated: [] as Array<{ id: string; title: string; assigneeInitials?: string }>,
        issuesSolved,
        attachments,
      };

      // Save recap with timeout so we don't hang if backend fails
      const RECAP_TIMEOUT_MS = 15000;
      try {
        await Promise.race([
          meetingsService.saveRecap(orgId, meetingId, recapPayload),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Recap request timed out')), RECAP_TIMEOUT_MS),
          ),
        ]);
      } catch (recapErr) {
        // Continue to end meeting even if recap fails
        console.warn('Recap save failed, still ending meeting:', recapErr);
      }

      // Always end the meeting (this is what actually closes it)
      await meetingsService.update(orgId, meetingId, {
        endedAt: new Date().toISOString(),
      });
      // Clear meeting-specific localStorage so we don't leave stale data (recap is persisted to API)
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(`meeting-ratings-${meetingId}`);
      }
      router.push(ROUTES.MEETINGS);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string }; status?: number } }).response?.data?.message
        : null;
      const status = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : null;
      if (status === 404) {
        console.error('Recap 404: Meeting not found. Ensure backend is up to date and organizationId is correct.');
      }
      setFinishError(msg || (status === 404 ? 'Meeting not found. Try refreshing and finishing again.' : 'Failed to end meeting. Try again.'));
    } finally {
      setFinishLoading(false);
    }
  };

  const handleFinishFromSidebar = () => {
    setShowFinishConfirm(true);
  };

  const handleExitMeeting = useCallback(async () => {
    if (!organizationId || !meetingId) {
      router.push(ROUTES.MEETINGS);
      return;
    }
    try {
      await meetingsService.leaveMeeting(organizationId, meetingId);
    } finally {
      router.push(ROUTES.MEETINGS);
    }
  }, [organizationId, meetingId, router]);

  const currentIndex = loadedSections.findIndex((s) => s.id === currentSection);
  const handlePrevSegment = useCallback(() => {
    if (currentIndex > 0) {
      const nextId = loadedSections[currentIndex - 1].id;
      setCurrentSection(nextId);
      router.replace(`${pathname}?segment=${nextId}`, { scroll: false });
      syncEmitRef.current?.emitSegmentChange?.(nextId);
    }
  }, [currentIndex, loadedSections, pathname, router]);
  const handleNextSegment = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < loadedSections.length - 1) {
      const nextId = loadedSections[currentIndex + 1].id;
      setCurrentSection(nextId);
      router.replace(`${pathname}?segment=${nextId}`, { scroll: false });
      syncEmitRef.current?.emitSegmentChange?.(nextId);
    }
  }, [currentIndex, loadedSections, pathname, router]);
  const handleSuspend = useCallback(async () => {
    if (!organizationId) return;
    setSuspendInProgress(true);
    try {
      const state = segmentStateRef.current;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          `${SUSPENDED_STATE_KEY_PREFIX}${meetingId}`,
          JSON.stringify({
            segmentId: state.segmentId,
            segmentElapsedSeconds: state.segmentElapsedSeconds,
            totalElapsedSeconds: state.totalElapsedSeconds,
          })
        );
      }
      await meetingsService.suspend(organizationId, meetingId);
      setIsSuspended(true);
      setIsRunning(false);
      router.push(ROUTES.MEETINGS);
    } catch {
      setSuspendInProgress(false);
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
  const isFacilitator = Boolean(meeting?.facilitatorId && currentUserId && meeting.facilitatorId === currentUserId);

  const getTimerState = useCallback(
    () => ({
      segmentElapsedSeconds,
      totalElapsedSeconds,
      isRunning,
    }),
    [segmentElapsedSeconds, totalElapsedSeconds, isRunning]
  );

  if (meetingLoading) {
    return <FullScreenLoaderWithText text="Setting up meeting" />;
  }

  return (
    <MeetingSocketProvider meetingId={meetingId} organizationId={organizationId || null}>
    <MeetingRealtimeSync
      meetingId={meetingId}
      syncEmitRef={syncEmitRef}
      setCurrentSection={setCurrentSection}
      setSegmentElapsedSeconds={setSegmentElapsedSeconds}
      setTotalElapsedSeconds={setTotalElapsedSeconds}
      setIsRunning={setIsRunning}
      getTimerState={getTimerState}
      pathname={pathname}
      router={router}
      setMeeting={setMeeting}
      onMeetingEnded={() => router.push(ROUTES.MEETINGS)}
      onTimerSynced={(segment, total) => {
        lastTimerSyncRef.current = { segment, total, ts: Date.now() };
      }}
    />
    <RocksProvider meetingId={meetingId} organizationId={organizationId}>
    <HeadlinesProvider meetingId={meetingId} organizationId={organizationId}>
    <TodosProvider meetingId={meetingId} organizationId={organizationId} teamId={teamId}>
    <IssuesProvider organizationId={organizationId} teamId={teamId} meetingId={meetingId}>
    <MeetingLayout>
      {/* Full-screen loader when suspending (save & redirect) */}
      {suspendInProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-sm font-medium text-foreground">Saving and leaving meeting…</p>
          </div>
        </div>
      )}
      {/* Full-screen loader when resuming from list */}
      {resumeInProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-sm font-medium text-foreground">Resuming meeting…</p>
          </div>
        </div>
      )}
      {/* Sidebar - collapsible */}
      {sidebarOpen && (
        <div className="w-64 min-w-[240px] flex-shrink-0 overflow-hidden">
          <MeetingSidebar
            sections={loadedSections}
            currentSection={currentSection}
            onSectionClick={handleSectionClick}
            totalTime={totalTime}
            segmentTime={segmentTime}
            segmentProgressPercent={segmentProgressPercent}
            isRunning={isRunning}
            isSuspended={isSuspended}
            isFacilitator={isFacilitator}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onResumeFromSuspend={handleResumeFromSuspend}
            onFinish={handleFinishFromSidebar}
            finishLoading={finishLoading}
            participantCount={meeting ? (meeting.attendances?.length ?? 0) : undefined}
            notesVisible={showNotesSection}
            onToggleNotes={() => setShowNotesSection((v) => !v)}
            onExitMeeting={handleExitMeeting}
            onPrevSegment={handlePrevSegment}
            onNextSegment={handleNextSegment}
            onSuspend={handleSuspend}
          />
        </div>
      )}

      {/* Main: header row + component details row */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Header row: hamburger | Segment | Meeting - Team | user + Create — white bg */}
        <header className="flex items-center gap-4 p-4 border-b border-border bg-card shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-2 rounded-md hover:bg-accent transition-colors cursor-pointer"
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
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create
            </button>
          </div>
        </header>

        <CreatePopup
          open={createPopupOpen}
          onClose={() => {
            setCreatePopupOpen(false);
            setCreatePopupInitialType(undefined);
          }}
          teamName={headerTitle.replace(/^.*-\s*/, '').trim() || 'Leadership Team'}
          teamId={teamId || undefined}
          initialType={createPopupInitialType}
        />

        {/* Suspended banner */}
        {isSuspended && (
          <div className="shrink-0 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-200 flex items-center justify-between">
            <span className="font-medium">Meeting suspended</span>
            <span className="text-sm">Resume from the sidebar when ready.</span>
          </div>
        )}

        <div className="flex-1 overflow-auto flex flex-col">
          <div className="flex-1 min-h-0">
            <MeetingContent
              sectionId={currentSection}
              sectionTitle={currentSectionData.title}
              meetingId={meetingId}
              organizationId={organizationId}
              meetingAttendances={meeting?.attendances}
              isFacilitator={isFacilitator}
              facilitatorId={meeting?.facilitatorId}
              currentUserId={currentUserId}
              onOpenCreateIssue={() => {
                setCreatePopupInitialType('issue');
                setCreatePopupOpen(true);
              }}
              onOpenCreate={(type) => {
                setCreatePopupInitialType(type);
                setCreatePopupOpen(true);
              }}
              onFinishMeeting={handleFinish}
              finishLoading={finishLoading}
            />
          </div>
          {showNotesSection && meeting && organizationId && meeting.sections?.[0] && (
            <div className="shrink-0 border-t border-border p-4 bg-muted/20">
              <MeetingNotesSection
                meetingId={meetingId}
                organizationId={organizationId}
                sectionId={meeting.sections[0].id}
                initialContent={
                  meeting.sections[0].notes?.find((n) => n.author?.id === currentUserId)?.content ?? ''
                }
                currentUserId={currentUserId}
                onSaved={async () => {
                  const updated = await meetingsService.findOne(organizationId, meetingId);
                  setMeeting(updated);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Finish meeting confirmation (sidebar) */}
      {showFinishConfirm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => { setShowFinishConfirm(false); setFinishError(null); }} aria-hidden />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">End meeting?</h3>
              <p className="text-sm text-muted-foreground mb-4">Are you sure you want to end this meeting?</p>
              {finishError && (
                <p className="text-sm text-destructive mb-4" role="alert">{finishError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowFinishConfirm(false); setFinishError(null); }}
                  className="px-4 py-2 border border-border rounded-md hover:bg-muted text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFinishError(null);
                    handleFinish();
                  }}
                  disabled={finishLoading}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
                >
                  {finishLoading ? 'Ending…' : 'Yes, end meeting'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </MeetingLayout>
    </IssuesProvider>
    </TodosProvider>
    </HeadlinesProvider>
    </RocksProvider>
    </MeetingSocketProvider>
  );
}
