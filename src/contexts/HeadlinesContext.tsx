'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { useMeetingSocket } from './MeetingSocketContext';

export interface HeadlineItem {
  id: string;
  title: string;
  createdAt: string;
  createdAgo: string;
  ownerInitials: string;
  archived: boolean;
}

export interface CascadingMessageItem {
  id: string;
  title: string;
  from: string;
  createdAt: string;
  createdAgo: string;
  ownerInitials: string;
  archived: boolean;
}

interface HeadlinesContextValue {
  headlines: HeadlineItem[];
  cascadingMessages: CascadingMessageItem[];
  addHeadline: (item: Omit<HeadlineItem, 'id'>) => void;
  addCascadingMessage: (item: Omit<CascadingMessageItem, 'id'>) => void;
  reorderHeadlines: (fromIndex: number, toIndex: number) => void;
  reorderCascadingMessages: (fromIndex: number, toIndex: number) => void;
  archiveHeadline: (id: string) => void;
  archiveCascadingMessage: (id: string) => void;
  deleteHeadline: (id: string) => void;
  deleteCascadingMessage: (id: string) => void;
}

const STORAGE_KEY = (meetingId: string) => `meeting-${meetingId}-headlines`;

const HeadlinesContext = createContext<HeadlinesContextValue | null>(null);

export function HeadlinesProvider({
  children,
  meetingId,
}: { children: ReactNode; meetingId?: string }) {
  const { socket } = useMeetingSocket();
  const [headlines, setHeadlines] = useState<HeadlineItem[]>([]);
  const [cascadingMessages, setCascadingMessages] = useState<CascadingMessageItem[]>([]);

  useEffect(() => {
    if (!meetingId || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY(meetingId));
      if (raw) {
        const parsed = JSON.parse(raw) as {
          headlines: HeadlineItem[];
          cascadingMessages: CascadingMessageItem[];
        };
        if (Array.isArray(parsed?.headlines)) setHeadlines(parsed.headlines);
        if (Array.isArray(parsed?.cascadingMessages))
          setCascadingMessages(parsed.cascadingMessages);
      }
    } catch {
      // ignore invalid stored data
    }
  }, [meetingId]);

  useEffect(() => {
    if (!meetingId || typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        STORAGE_KEY(meetingId),
        JSON.stringify({ headlines, cascadingMessages })
      );
    } catch {
      // ignore
    }
  }, [meetingId, headlines, cascadingMessages]);

  useEffect(() => {
    if (!socket || !meetingId) return;
    const onHeadlineCreated = (payload: { meetingId: string; headline: HeadlineItem }) => {
      if (payload.meetingId !== meetingId || !payload.headline?.id) return;
      setHeadlines((prev) =>
        prev.some((h) => h.id === payload.headline.id) ? prev : [...prev, payload.headline]
      );
    };
    const onHeadlineDeleted = (payload: { meetingId: string; headlineId: string }) => {
      if (payload.meetingId !== meetingId) return;
      setHeadlines((prev) => prev.filter((h) => h.id !== payload.headlineId));
    };
    const onCascadingCreated = (payload: { meetingId: string; message: CascadingMessageItem }) => {
      if (payload.meetingId !== meetingId || !payload.message?.id) return;
      setCascadingMessages((prev) =>
        prev.some((c) => c.id === payload.message.id) ? prev : [...prev, payload.message]
      );
    };
    const onCascadingDeleted = (payload: { meetingId: string; messageId: string }) => {
      if (payload.meetingId !== meetingId) return;
      setCascadingMessages((prev) => prev.filter((c) => c.id !== payload.messageId));
    };
    socket.on('headline_created', onHeadlineCreated);
    socket.on('headline_deleted', onHeadlineDeleted);
    socket.on('cascading_message_created', onCascadingCreated);
    socket.on('cascading_message_deleted', onCascadingDeleted);
    return () => {
      socket.off('headline_created', onHeadlineCreated);
      socket.off('headline_deleted', onHeadlineDeleted);
      socket.off('cascading_message_created', onCascadingCreated);
      socket.off('cascading_message_deleted', onCascadingDeleted);
    };
  }, [socket, meetingId]);

  const addHeadline = useCallback((item: Omit<HeadlineItem, 'id'>) => {
    const id = `headline-${Date.now()}`;
    const newItem = { ...item, id };
    setHeadlines((prev) => [...prev, newItem]);
    if (socket && meetingId) socket.emit('headline_created', { meetingId, headline: newItem });
  }, [socket, meetingId]);

  const addCascadingMessage = useCallback((item: Omit<CascadingMessageItem, 'id'>) => {
    const id = `cascade-${Date.now()}`;
    const newItem = { ...item, id };
    setCascadingMessages((prev) => [...prev, newItem]);
    if (socket && meetingId) socket.emit('cascading_message_created', { meetingId, message: newItem });
  }, [socket, meetingId]);
  const reorderHeadlines = useCallback((fromIndex: number, toIndex: number) => {
    setHeadlines((prev) => {
      const active = prev.filter((h) => !h.archived);
      const archived = prev.filter((h) => h.archived);
      const reordered = arrayMove(active, fromIndex, toIndex);
      return [...reordered, ...archived];
    });
  }, []);

  const reorderCascadingMessages = useCallback((fromIndex: number, toIndex: number) => {
    setCascadingMessages((prev) => {
      const active = prev.filter((c) => !c.archived);
      const archived = prev.filter((c) => c.archived);
      const reordered = arrayMove(active, fromIndex, toIndex);
      return [...reordered, ...archived];
    });
  }, []);

  const archiveHeadline = useCallback((id: string) => {
    setHeadlines((prev) =>
      prev.map((h) => (h.id === id ? { ...h, archived: true } : h))
    );
  }, []);

  const archiveCascadingMessage = useCallback((id: string) => {
    setCascadingMessages((prev) =>
      prev.map((c) => (c.id === id ? { ...c, archived: true } : c))
    );
  }, []);

  const deleteHeadline = useCallback((id: string) => {
    setHeadlines((prev) => prev.filter((h) => h.id !== id));
    if (socket && meetingId) socket.emit('headline_deleted', { meetingId, headlineId: id });
  }, [socket, meetingId]);

  const deleteCascadingMessage = useCallback((id: string) => {
    setCascadingMessages((prev) => prev.filter((c) => c.id !== id));
    if (socket && meetingId) socket.emit('cascading_message_deleted', { meetingId, messageId: id });
  }, [socket, meetingId]);

  const value = useMemo(
    () => ({
      headlines,
      cascadingMessages,
      addHeadline,
      addCascadingMessage,
      reorderHeadlines,
      reorderCascadingMessages,
      archiveHeadline,
      archiveCascadingMessage,
      deleteHeadline,
      deleteCascadingMessage,
    }),
    [
      headlines,
      cascadingMessages,
      addHeadline,
      addCascadingMessage,
      reorderHeadlines,
      reorderCascadingMessages,
      archiveHeadline,
      archiveCascadingMessage,
      deleteHeadline,
      deleteCascadingMessage,
    ]
  );

  return (
    <HeadlinesContext.Provider value={value}>{children}</HeadlinesContext.Provider>
  );
}

export function useHeadlines() {
  const ctx = useContext(HeadlinesContext);
  if (!ctx) throw new Error('useHeadlines must be used within HeadlinesProvider');
  return ctx;
}

export function useHeadlinesOptional() {
  return useContext(HeadlinesContext);
}
