'use client';

import { useEffect, useRef } from 'react';
import { useMeetingSocket } from '@/contexts/MeetingSocketContext';
import type { Meeting } from '@/lib/api/meetings.service';

const VALID_SEGMENT_IDS = ['segue', 'scorecard', 'rocks', 'headlines', 'todos', 'issues', 'conclude'];

interface MeetingRealtimeSyncProps {
  meetingId: string;
  syncEmitRef: React.MutableRefObject<{
    emitSegmentChange: (segmentId: string) => void;
    emitTimerSync: (override?: { segmentElapsedSeconds: number; totalElapsedSeconds: number; isRunning: boolean }) => void;
  } | null>;
  setCurrentSection: (id: string) => void;
  setSegmentElapsedSeconds: (n: number) => void;
  setTotalElapsedSeconds: (n: number) => void;
  setIsRunning: (running: boolean) => void;
  getTimerState: () => { segmentElapsedSeconds: number; totalElapsedSeconds: number; isRunning: boolean };
  pathname: string;
  router: { replace: (url: string, opts?: { scroll: boolean }) => void };
  setMeeting?: React.Dispatch<React.SetStateAction<Meeting | null>>;
  onMeetingEnded?: () => void;
  onTimerSynced?: (segmentElapsedSeconds: number, totalElapsedSeconds: number) => void;
}

export function MeetingRealtimeSync({
  meetingId,
  syncEmitRef,
  setCurrentSection,
  setSegmentElapsedSeconds,
  setTotalElapsedSeconds,
  setIsRunning,
  getTimerState,
  pathname,
  router,
  setMeeting,
  onMeetingEnded,
  onTimerSynced,
}: MeetingRealtimeSyncProps) {
  const { socket } = useMeetingSocket();
  const getTimerStateRef = useRef(getTimerState);
  getTimerStateRef.current = getTimerState;

  // Expose emit functions to parent so they can be called from handlers
  useEffect(() => {
    if (!socket || !meetingId) {
      syncEmitRef.current = null;
      return;
    }
    syncEmitRef.current = {
      emitSegmentChange: (segmentId: string) => {
        if (VALID_SEGMENT_IDS.includes(segmentId)) {
          socket.emit('segment_change', { meetingId, segmentId });
        }
      },
      emitTimerSync: (override) => {
        const state = override ?? getTimerStateRef.current();
        socket.emit('timer_sync', {
          meetingId,
          segmentElapsedSeconds: state.segmentElapsedSeconds,
          totalElapsedSeconds: state.totalElapsedSeconds,
          isRunning: state.isRunning,
        });
      },
    };
    return () => {
      syncEmitRef.current = null;
    };
  }, [socket, meetingId, syncEmitRef]);

  // Listen for meeting_attendances (participants join/leave) and update meeting state
  useEffect(() => {
    if (!socket || !setMeeting) return;
    const onMeetingAttendances = (payload: {
      attendances: Array<{ id: string; present: boolean; user: { id: string; email: string; name?: string } }>;
    }) => {
      const list = payload?.attendances;
      if (!Array.isArray(list)) return;
      setMeeting((prev) =>
        prev ? { ...prev, attendances: list } : null
      );
    };
    socket.on('meeting_attendances', onMeetingAttendances);
    return () => {
      socket.off('meeting_attendances', onMeetingAttendances);
    };
  }, [socket, setMeeting]);

  // Listen for meeting_updated (e.g. scribe changed) so all participants see new permissions without refresh
  useEffect(() => {
    if (!socket || !setMeeting) return;
    const onMeetingUpdated = (payload: Partial<Meeting>) => {
      if (!payload || typeof payload !== 'object') return;
      setMeeting((prev) => {
        if (!prev) return null;
        return { ...prev, ...payload, attendances: (payload as Meeting).attendances ?? prev.attendances };
      });
    };
    socket.on('meeting_updated', onMeetingUpdated);
    return () => {
      socket.off('meeting_updated', onMeetingUpdated);
    };
  }, [socket, setMeeting]);

  // When facilitator ends meeting, all members are kicked (redirect to meetings list)
  useEffect(() => {
    if (!socket || !onMeetingEnded) return;
    const onMeetingEndedEvent = () => {
      onMeetingEnded();
    };
    socket.on('meeting_ended', onMeetingEndedEvent);
    return () => {
      socket.off('meeting_ended', onMeetingEndedEvent);
    };
  }, [socket, onMeetingEnded]);

  // Listen for segment_changed and timer_updated from other participants
  useEffect(() => {
    if (!socket) return;
    const onSegmentChanged = (payload: { segmentId?: string }) => {
      const segmentId = payload?.segmentId;
      if (segmentId && VALID_SEGMENT_IDS.includes(segmentId)) {
        setCurrentSection(segmentId);
        setSegmentElapsedSeconds(0);
        const state = getTimerStateRef.current();
        if (onTimerSynced) onTimerSynced(0, state.totalElapsedSeconds);
        router.replace(`${pathname}?segment=${segmentId}`, { scroll: false });
      }
    };
    const onTimerUpdated = (payload: {
      segmentElapsedSeconds?: number;
      totalElapsedSeconds?: number;
      isRunning?: boolean;
    }) => {
      const segment = typeof payload.segmentElapsedSeconds === 'number' ? Math.max(0, payload.segmentElapsedSeconds) : undefined;
      const total = typeof payload.totalElapsedSeconds === 'number' ? Math.max(0, payload.totalElapsedSeconds) : undefined;
      if (segment !== undefined) setSegmentElapsedSeconds(segment);
      if (total !== undefined) setTotalElapsedSeconds(total);
      if (typeof payload.isRunning === 'boolean') {
        setIsRunning(payload.isRunning);
      }
      if (segment !== undefined && total !== undefined && onTimerSynced) {
        onTimerSynced(segment, total);
      }
    };
    socket.on('segment_changed', onSegmentChanged);
    socket.on('timer_updated', onTimerUpdated);
    return () => {
      socket.off('segment_changed', onSegmentChanged);
      socket.off('timer_updated', onTimerUpdated);
    };
  }, [
    socket,
    setCurrentSection,
    setSegmentElapsedSeconds,
    setTotalElapsedSeconds,
    setIsRunning,
    onTimerSynced,
    pathname,
    router,
  ]);

  return null;
}
