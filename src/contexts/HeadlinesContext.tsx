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
import { meetingsService } from '@/lib/api/meetings.service';

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
  isLoading: boolean;
}

const HeadlinesContext = createContext<HeadlinesContextValue | null>(null);

export function HeadlinesProvider({
  children,
  meetingId,
  organizationId,
}: { children: ReactNode; meetingId?: string; organizationId?: string }) {
  const { socket } = useMeetingSocket();
  const [headlines, setHeadlines] = useState<HeadlineItem[]>([]);
  const [cascadingMessages, setCascadingMessages] = useState<CascadingMessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!organizationId || !meetingId || typeof window === 'undefined') {
      setHeadlines([]);
      setCascadingMessages([]);
      return;
    }
    setIsLoading(true);
    try {
      const [hList, cList] = await Promise.all([
        meetingsService.getHeadlines(organizationId, meetingId),
        meetingsService.getCascadingMessages(organizationId, meetingId),
      ]);
      setHeadlines(hList);
      setCascadingMessages(cList);
    } catch {
      setHeadlines([]);
      setCascadingMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, meetingId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!meetingId) {
      setHeadlines([]);
      setCascadingMessages([]);
    }
  }, [meetingId]);

  useEffect(() => {
    if (!socket || !meetingId) return;
    const onHeadlineCreated = (payload: { meetingId: string; headline: HeadlineItem }) => {
      if (payload.meetingId !== meetingId || !payload.headline?.id) return;
      setHeadlines((prev) =>
        prev.some((h) => h.id === payload.headline.id) ? prev : [...prev, payload.headline]
      );
    };
    const onHeadlineUpdated = (payload: { meetingId: string; headline: HeadlineItem }) => {
      if (payload.meetingId !== meetingId || !payload.headline?.id) return;
      setHeadlines((prev) =>
        prev.map((h) => (h.id === payload.headline.id ? payload.headline : h))
      );
    };
    const onHeadlineDeleted = (payload: { meetingId: string; headlineId: string }) => {
      if (payload.meetingId !== meetingId) return;
      setHeadlines((prev) => prev.filter((h) => h.id !== payload.headlineId));
    };
    const onHeadlinesReordered = (payload: { meetingId: string; headlines: HeadlineItem[] }) => {
      if (payload.meetingId !== meetingId || !Array.isArray(payload.headlines)) return;
      setHeadlines(payload.headlines);
    };
    const onCascadingCreated = (payload: { meetingId: string; message: CascadingMessageItem }) => {
      if (payload.meetingId !== meetingId || !payload.message?.id) return;
      setCascadingMessages((prev) =>
        prev.some((c) => c.id === payload.message.id) ? prev : [...prev, payload.message]
      );
    };
    const onCascadingUpdated = (payload: { meetingId: string; message: CascadingMessageItem }) => {
      if (payload.meetingId !== meetingId || !payload.message?.id) return;
      setCascadingMessages((prev) =>
        prev.map((c) => (c.id === payload.message.id ? payload.message : c))
      );
    };
    const onCascadingDeleted = (payload: { meetingId: string; messageId: string }) => {
      if (payload.meetingId !== meetingId) return;
      setCascadingMessages((prev) => prev.filter((c) => c.id !== payload.messageId));
    };
    const onCascadingReordered = (payload: { meetingId: string; messages: CascadingMessageItem[] }) => {
      if (payload.meetingId !== meetingId || !Array.isArray(payload.messages)) return;
      setCascadingMessages(payload.messages);
    };
    socket.on('headline_created', onHeadlineCreated);
    socket.on('headline_updated', onHeadlineUpdated);
    socket.on('headline_deleted', onHeadlineDeleted);
    socket.on('headlines_reordered', onHeadlinesReordered);
    socket.on('cascading_message_created', onCascadingCreated);
    socket.on('cascading_message_updated', onCascadingUpdated);
    socket.on('cascading_message_deleted', onCascadingDeleted);
    socket.on('cascading_messages_reordered', onCascadingReordered);
    return () => {
      socket.off('headline_created', onHeadlineCreated);
      socket.off('headline_updated', onHeadlineUpdated);
      socket.off('headline_deleted', onHeadlineDeleted);
      socket.off('headlines_reordered', onHeadlinesReordered);
      socket.off('cascading_message_created', onCascadingCreated);
      socket.off('cascading_message_updated', onCascadingUpdated);
      socket.off('cascading_message_deleted', onCascadingDeleted);
      socket.off('cascading_messages_reordered', onCascadingReordered);
    };
  }, [socket, meetingId]);

  const addHeadline = useCallback(
    async (item: Omit<HeadlineItem, 'id'>) => {
      if (!organizationId || !meetingId) return;
      try {
        const created = await meetingsService.createHeadline(organizationId, meetingId, {
          title: item.title,
          ownerInitials: item.ownerInitials,
        });
        setHeadlines((prev) =>
          prev.some((h) => h.id === created.id) ? prev : [...prev, created]
        );
      } catch {
        // keep UI unchanged on error
      }
    },
    [organizationId, meetingId]
  );

  const addCascadingMessage = useCallback(
    async (item: Omit<CascadingMessageItem, 'id'>) => {
      if (!organizationId || !meetingId) return;
      try {
        const created = await meetingsService.createCascadingMessage(
          organizationId,
          meetingId,
          { title: item.title, from: item.from, ownerInitials: item.ownerInitials }
        );
        setCascadingMessages((prev) =>
          prev.some((c) => c.id === created.id) ? prev : [...prev, created]
        );
      } catch {
        // keep UI unchanged on error
      }
    },
    [organizationId, meetingId]
  );

  const reorderHeadlines = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!organizationId || !meetingId) return;
      const active = headlines.filter((h) => !h.archived);
      const archived = headlines.filter((h) => h.archived);
      const reordered = arrayMove(active, fromIndex, toIndex);
      const next = [...reordered, ...archived];
      setHeadlines(next);
      try {
        const list = await meetingsService.reorderHeadlines(
          organizationId,
          meetingId,
          next.map((h) => h.id)
        );
        setHeadlines(list);
      } catch {
        fetchAll();
      }
    },
    [organizationId, meetingId, headlines, fetchAll]
  );

  const reorderCascadingMessages = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!organizationId || !meetingId) return;
      const active = cascadingMessages.filter((c) => !c.archived);
      const archived = cascadingMessages.filter((c) => c.archived);
      const reordered = arrayMove(active, fromIndex, toIndex);
      const next = [...reordered, ...archived];
      setCascadingMessages(next);
      try {
        const list = await meetingsService.reorderCascadingMessages(
          organizationId,
          meetingId,
          next.map((c) => c.id)
        );
        setCascadingMessages(list);
      } catch {
        fetchAll();
      }
    },
    [organizationId, meetingId, cascadingMessages, fetchAll]
  );

  const archiveHeadline = useCallback(
    async (id: string) => {
      if (!organizationId || !meetingId) return;
      setHeadlines((prev) =>
        prev.map((h) => (h.id === id ? { ...h, archived: true } : h))
      );
      try {
        await meetingsService.updateHeadline(organizationId, meetingId, id, { archived: true });
      } catch {
        fetchAll();
      }
    },
    [organizationId, meetingId, fetchAll]
  );

  const archiveCascadingMessage = useCallback(
    async (id: string) => {
      if (!organizationId || !meetingId) return;
      setCascadingMessages((prev) =>
        prev.map((c) => (c.id === id ? { ...c, archived: true } : c))
      );
      try {
        await meetingsService.updateCascadingMessage(
          organizationId,
          meetingId,
          id,
          { archived: true }
        );
      } catch {
        fetchAll();
      }
    },
    [organizationId, meetingId, fetchAll]
  );

  const deleteHeadline = useCallback(
    async (id: string) => {
      if (!organizationId || !meetingId) return;
      setHeadlines((prev) => prev.filter((h) => h.id !== id));
      try {
        await meetingsService.deleteHeadline(organizationId, meetingId, id);
      } catch {
        fetchAll();
      }
    },
    [organizationId, meetingId, fetchAll]
  );

  const deleteCascadingMessage = useCallback(
    async (id: string) => {
      if (!organizationId || !meetingId) return;
      setCascadingMessages((prev) => prev.filter((c) => c.id !== id));
      try {
        await meetingsService.deleteCascadingMessage(organizationId, meetingId, id);
      } catch {
        fetchAll();
      }
    },
    [organizationId, meetingId, fetchAll]
  );

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
      isLoading,
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
      isLoading,
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
