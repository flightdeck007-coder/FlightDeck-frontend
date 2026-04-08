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
  meetingId?: string;
  title: string;
  description?: string;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  linkedEntityTitle?: string | null;
  comments?: Array<{ id: string; text: string; authorInitials?: string; authorName?: string; createdAt: string }>;
  attachments?: Array<{ id: string; name: string; uploadedAt: string }>;
  createdAt: string;
  createdAgo: string;
  ownerInitials: string;
  archived: boolean;
}

export interface CascadingMessageItem {
  id: string;
  meetingId?: string;
  title: string;
  from: string;
  description?: string;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  linkedEntityTitle?: string | null;
  comments?: Array<{ id: string; text: string; authorInitials?: string; authorName?: string; createdAt: string }>;
  attachments?: Array<{ id: string; name: string; uploadedAt: string }>;
  createdAt: string;
  createdAgo: string;
  ownerInitials: string;
  archived: boolean;
}

interface HeadlinesContextValue {
  headlines: HeadlineItem[];
  cascadingMessages: CascadingMessageItem[];
  addHeadline: (item: Omit<HeadlineItem, 'id'>) => Promise<string | undefined>;
  addCascadingMessage: (item: Omit<CascadingMessageItem, 'id'>) => Promise<string | undefined>;
  reorderHeadlines: (fromIndex: number, toIndex: number) => void;
  reorderCascadingMessages: (fromIndex: number, toIndex: number) => void;
  archiveHeadline: (id: string) => void;
  archiveCascadingMessage: (id: string) => void;
  updateHeadline: (id: string, patch: { title?: string; description?: string; ownerInitials?: string; linkedEntityType?: string | null; linkedEntityId?: string | null; linkedEntityTitle?: string | null; comments?: Array<{ id: string; text: string; authorInitials?: string; authorName?: string; createdAt: string }>; attachments?: Array<{ id: string; name: string; uploadedAt: string }>; archived?: boolean }) => void;
  updateCascadingMessage: (id: string, patch: { title?: string; description?: string; from?: string; ownerInitials?: string; linkedEntityType?: string | null; linkedEntityId?: string | null; linkedEntityTitle?: string | null; comments?: Array<{ id: string; text: string; authorInitials?: string; authorName?: string; createdAt: string }>; attachments?: Array<{ id: string; name: string; uploadedAt: string }>; archived?: boolean }) => void;
  deleteHeadline: (id: string) => void;
  deleteCascadingMessage: (id: string) => void;
  isLoading: boolean;
}

const HeadlinesContext = createContext<HeadlinesContextValue | null>(null);

function normalizeComments(
  value: unknown
): Array<{ id: string; text: string; authorInitials?: string; authorName?: string; createdAt: string }> {
  if (!Array.isArray(value)) return [];
  const normalized: Array<{ id: string; text: string; authorInitials?: string; authorName?: string; createdAt: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id : `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const text = typeof obj.text === 'string' ? obj.text : '';
    if (!text.trim()) continue;
    const createdAt = typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString();
    normalized.push({
      id,
      text,
      createdAt,
      authorInitials: typeof obj.authorInitials === 'string' ? obj.authorInitials : undefined,
      authorName: typeof obj.authorName === 'string' ? obj.authorName : undefined,
    });
  }
  return normalized;
}

function normalizeAttachments(
  value: unknown
): Array<{ id: string; name: string; uploadedAt: string }> {
  if (!Array.isArray(value)) return [];
  const normalized: Array<{ id: string; name: string; uploadedAt: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id : `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const name =
      typeof obj.name === 'string'
        ? obj.name
        : typeof obj.fileName === 'string'
          ? obj.fileName
          : '';
    if (!name.trim()) continue;
    const uploadedAt =
      typeof obj.uploadedAt === 'string'
        ? obj.uploadedAt
        : typeof obj.createdAt === 'string'
          ? obj.createdAt
          : new Date().toISOString();
    normalized.push({ id, name, uploadedAt });
  }
  return normalized;
}

export function HeadlinesProvider({
  children,
  meetingId,
  organizationId,
  teamId,
  fallbackMeetingId,
}: {
  children: ReactNode;
  meetingId?: string;
  organizationId?: string;
  teamId?: string;
  fallbackMeetingId?: string;
}) {
  const { socket } = useMeetingSocket();
  const [headlines, setHeadlines] = useState<HeadlineItem[]>([]);
  const [cascadingMessages, setCascadingMessages] = useState<CascadingMessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!organizationId || typeof window === 'undefined') {
      setHeadlines([]);
      setCascadingMessages([]);
      return;
    }
    setIsLoading(true);
    try {
      const [hList, cList] = meetingId
        ? await Promise.all([
            meetingsService.getHeadlines(organizationId, meetingId),
            meetingsService.getCascadingMessages(organizationId, meetingId),
          ])
        : await Promise.all([
            meetingsService.getHeadlinesAll(organizationId, teamId),
            meetingsService.getCascadingMessagesAll(organizationId, teamId),
          ]);
      setHeadlines(
        hList.map((h) => ({
          ...h,
          comments: normalizeComments(h.comments),
          attachments: normalizeAttachments(h.attachments),
        }))
      );
      setCascadingMessages(
        cList.map((c) => ({
          ...c,
          comments: normalizeComments(c.comments),
          attachments: normalizeAttachments(c.attachments),
        }))
      );
    } catch {
      setHeadlines([]);
      setCascadingMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, meetingId, teamId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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
    socket.on('flight_directive_created', onCascadingCreated);
    socket.on('flight_directive_updated', onCascadingUpdated);
    socket.on('flight_directive_deleted', onCascadingDeleted);
    socket.on('flight_directives_reordered', onCascadingReordered);
    return () => {
      socket.off('headline_created', onHeadlineCreated);
      socket.off('headline_updated', onHeadlineUpdated);
      socket.off('headline_deleted', onHeadlineDeleted);
      socket.off('headlines_reordered', onHeadlinesReordered);
      socket.off('flight_directive_created', onCascadingCreated);
      socket.off('flight_directive_updated', onCascadingUpdated);
      socket.off('flight_directive_deleted', onCascadingDeleted);
      socket.off('flight_directives_reordered', onCascadingReordered);
    };
  }, [socket, meetingId]);

  const addHeadline = useCallback(
    async (item: Omit<HeadlineItem, 'id'>) => {
      if (!organizationId) return undefined;
      const targetMeetingId = meetingId ?? fallbackMeetingId;
      if (!targetMeetingId) return undefined;
      try {
        const created = meetingId
          ? await meetingsService.createHeadline(organizationId, targetMeetingId, {
              title: item.title,
              description: item.description,
              ownerInitials: item.ownerInitials,
              linkedEntityType: item.linkedEntityType ?? undefined,
              linkedEntityId: item.linkedEntityId ?? undefined,
              linkedEntityTitle: item.linkedEntityTitle ?? undefined,
            })
          : await meetingsService.createHeadlineAll(organizationId, targetMeetingId, {
              title: item.title,
              description: item.description,
              ownerInitials: item.ownerInitials,
              linkedEntityType: item.linkedEntityType ?? undefined,
              linkedEntityId: item.linkedEntityId ?? undefined,
              linkedEntityTitle: item.linkedEntityTitle ?? undefined,
            });
        setHeadlines((prev) =>
          prev.some((h) => h.id === created.id) ? prev : [...prev, created]
        );
        return created.id as string;
      } catch {
        return undefined;
      }
    },
    [organizationId, meetingId, fallbackMeetingId]
  );

  const addCascadingMessage = useCallback(
    async (item: Omit<CascadingMessageItem, 'id'>) => {
      if (!organizationId) return undefined;
      const targetMeetingId = meetingId ?? fallbackMeetingId;
      if (!targetMeetingId) return undefined;
      try {
        const created = meetingId
          ? await meetingsService.createCascadingMessage(
              organizationId,
              targetMeetingId,
              {
                title: item.title,
                description: item.description,
                from: item.from,
                ownerInitials: item.ownerInitials,
                linkedEntityType: item.linkedEntityType ?? undefined,
                linkedEntityId: item.linkedEntityId ?? undefined,
                linkedEntityTitle: item.linkedEntityTitle ?? undefined,
              }
            )
          : await meetingsService.createCascadingMessageAll(
              organizationId,
              targetMeetingId,
              {
                title: item.title,
                description: item.description,
                from: item.from,
                ownerInitials: item.ownerInitials,
                linkedEntityType: item.linkedEntityType ?? undefined,
                linkedEntityId: item.linkedEntityId ?? undefined,
                linkedEntityTitle: item.linkedEntityTitle ?? undefined,
              }
            );
        setCascadingMessages((prev) =>
          prev.some((c) => c.id === created.id) ? prev : [...prev, created]
        );
        return created.id as string;
      } catch {
        return undefined;
      }
    },
    [organizationId, meetingId, fallbackMeetingId]
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
      if (!organizationId) return;
      setHeadlines((prev) =>
        prev.map((h) => (h.id === id ? { ...h, archived: true } : h))
      );
      try {
        if (meetingId) {
          await meetingsService.updateHeadline(organizationId, meetingId, id, { archived: true });
        } else {
          await meetingsService.updateHeadlineById(organizationId, id, { archived: true });
        }
      } catch {
        fetchAll();
      }
    },
    [organizationId, meetingId, fetchAll]
  );

  const archiveCascadingMessage = useCallback(
    async (id: string) => {
      if (!organizationId) return;
      setCascadingMessages((prev) =>
        prev.map((c) => (c.id === id ? { ...c, archived: true } : c))
      );
      try {
        if (meetingId) {
          await meetingsService.updateCascadingMessage(
            organizationId,
            meetingId,
            id,
            { archived: true }
          );
        } else {
          await meetingsService.updateCascadingMessageById(organizationId, id, { archived: true });
        }
      } catch {
        fetchAll();
      }
    },
    [organizationId, meetingId, fetchAll]
  );

  const updateHeadline = useCallback(
    async (id: string, patch: { title?: string; description?: string; ownerInitials?: string; linkedEntityType?: string | null; linkedEntityId?: string | null; linkedEntityTitle?: string | null; comments?: Array<{ id: string; text: string; authorInitials?: string; authorName?: string; createdAt: string }>; attachments?: Array<{ id: string; name: string; uploadedAt: string }>; archived?: boolean }) => {
      if (!organizationId) return;
      const prev = headlines;
      setHeadlines((list) =>
        list.map((h) => (h.id === id ? { ...h, ...patch } : h))
      );
      try {
        if (meetingId) {
          await meetingsService.updateHeadline(organizationId, meetingId, id, patch);
        } else {
          await meetingsService.updateHeadlineById(organizationId, id, patch);
        }
      } catch {
        setHeadlines(prev);
        fetchAll();
      }
    },
    [organizationId, meetingId, headlines, fetchAll]
  );

  const updateCascadingMessage = useCallback(
    async (id: string, patch: { title?: string; description?: string; from?: string; ownerInitials?: string; linkedEntityType?: string | null; linkedEntityId?: string | null; linkedEntityTitle?: string | null; comments?: Array<{ id: string; text: string; authorInitials?: string; authorName?: string; createdAt: string }>; attachments?: Array<{ id: string; name: string; uploadedAt: string }>; archived?: boolean }) => {
      if (!organizationId) return;
      const prev = cascadingMessages;
      setCascadingMessages((list) =>
        list.map((c) => (c.id === id ? { ...c, ...patch } : c))
      );
      try {
        if (meetingId) {
          await meetingsService.updateCascadingMessage(organizationId, meetingId, id, patch);
        } else {
          await meetingsService.updateCascadingMessageById(organizationId, id, patch);
        }
      } catch {
        setCascadingMessages(prev);
        fetchAll();
      }
    },
    [organizationId, meetingId, cascadingMessages, fetchAll]
  );

  const deleteHeadline = useCallback(
    async (id: string) => {
      if (!organizationId) return;
      setHeadlines((prev) => prev.filter((h) => h.id !== id));
      try {
        if (meetingId) {
          await meetingsService.deleteHeadline(organizationId, meetingId, id);
        } else {
          await meetingsService.deleteHeadlineById(organizationId, id);
        }
      } catch {
        fetchAll();
      }
    },
    [organizationId, meetingId, fetchAll]
  );

  const deleteCascadingMessage = useCallback(
    async (id: string) => {
      if (!organizationId) return;
      setCascadingMessages((prev) => prev.filter((c) => c.id !== id));
      try {
        if (meetingId) {
          await meetingsService.deleteCascadingMessage(organizationId, meetingId, id);
        } else {
          await meetingsService.deleteCascadingMessageById(organizationId, id);
        }
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
      updateHeadline,
      updateCascadingMessage,
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
      updateHeadline,
      updateCascadingMessage,
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
