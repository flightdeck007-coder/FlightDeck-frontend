'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { arrayMove } from '@dnd-kit/sortable';

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

const HeadlinesContext = createContext<HeadlinesContextValue | null>(null);

export function HeadlinesProvider({ children }: { children: ReactNode }) {
  const [headlines, setHeadlines] = useState<HeadlineItem[]>([]);
  const [cascadingMessages, setCascadingMessages] = useState<CascadingMessageItem[]>([]);

  const addHeadline = useCallback((item: Omit<HeadlineItem, 'id'>) => {
    const id = `headline-${Date.now()}`;
    setHeadlines((prev) => [...prev, { ...item, id }]);
  }, []);

  const addCascadingMessage = useCallback((item: Omit<CascadingMessageItem, 'id'>) => {
    const id = `cascade-${Date.now()}`;
    setCascadingMessages((prev) => [...prev, { ...item, id }]);
  }, []);
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
  }, []);

  const deleteCascadingMessage = useCallback((id: string) => {
    setCascadingMessages((prev) => prev.filter((c) => c.id !== id));
  }, []);

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
