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
import { issuesService, type IssueApiItem } from '@/lib/api/issues.service';
import { useMeetingSocket } from './MeetingSocketContext';

export interface IssueItem {
  id: string;
  title: string;
  description?: string | null;
  priority: number;
  termType: 'short_term' | 'long_term';
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  ownerInitials: string;
  attachmentCount?: number; // placeholder for future
}

function apiToItem(i: IssueApiItem): IssueItem {
  return {
    id: i.id,
    title: i.title,
    description: i.description,
    priority: i.priority,
    termType: i.termType,
    resolvedAt: i.resolvedAt,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    createdById: i.createdById,
    ownerInitials: i.ownerInitials,
  };
}

interface IssuesContextValue {
  shortTerm: IssueItem[];
  longTerm: IssueItem[];
  addIssue: (data: {
    title: string;
    description?: string;
    priority?: number;
    termType?: 'short_term' | 'long_term';
  }) => Promise<string>;
  updateIssue: (id: string, patch: Partial<IssueItem>) => void;
  deleteIssue: (id: string) => void;
  setResolved: (id: string, resolved: boolean) => void;
  makeLongTerm: (id: string) => void;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const IssuesContext = createContext<IssuesContextValue | null>(null);

export function IssuesProvider({
  children,
  organizationId,
  teamId,
  meetingId,
}: {
  children: ReactNode;
  organizationId?: string;
  teamId?: string;
  meetingId?: string;
}) {
  const { socket } = useMeetingSocket();
  const [shortTerm, setShortTerm] = useState<IssueItem[]>([]);
  const [longTerm, setLongTerm] = useState<IssueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchIssues = useCallback(async () => {
    if (!organizationId || !teamId || typeof window === 'undefined') {
      setShortTerm([]);
      setLongTerm([]);
      return;
    }
    setIsLoading(true);
    try {
      const [short, long] = await Promise.all([
        issuesService.findAll(organizationId, teamId, 'short_term', false),
        issuesService.findAll(organizationId, teamId, 'long_term', false),
      ]);
      setShortTerm(short.map(apiToItem));
      setLongTerm(long.map(apiToItem));
    } catch {
      setShortTerm([]);
      setLongTerm([]);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, teamId]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Real-time: issue_created, issue_updated, issue_deleted + issue_list_changed (refetch) from other members
  useEffect(() => {
    if (!socket || !teamId) return;
    const onIssueCreated = (raw: IssueApiItem) => {
      const item = apiToItem(raw);
      if (item.termType === 'short_term') {
        setShortTerm((prev) =>
          prev.some((i) => i.id === item.id) ? prev : [...prev, item].sort((a, b) => b.priority - a.priority)
        );
      } else {
        setLongTerm((prev) =>
          prev.some((i) => i.id === item.id) ? prev : [...prev, item].sort((a, b) => b.priority - a.priority)
        );
      }
    };
    const onIssueUpdated = (raw: IssueApiItem) => {
      const item = apiToItem(raw);
      if (item.resolvedAt) {
        setShortTerm((prev) => prev.filter((t) => t.id !== item.id));
        setLongTerm((prev) => prev.filter((t) => t.id !== item.id));
        return;
      }
      if (item.termType === 'short_term') {
        setShortTerm((prev) =>
          prev.some((t) => t.id === item.id)
            ? prev.map((t) => (t.id === item.id ? item : t))
            : [...prev, item].sort((a, b) => b.priority - a.priority)
        );
        setLongTerm((prev) => prev.filter((t) => t.id !== item.id));
      } else {
        setLongTerm((prev) =>
          prev.some((t) => t.id === item.id)
            ? prev.map((t) => (t.id === item.id ? item : t))
            : [...prev, item].sort((a, b) => b.priority - a.priority)
        );
        setShortTerm((prev) => prev.filter((t) => t.id !== item.id));
      }
    };
    const onIssueDeleted = (payload: { issueId: string }) => {
      const id = payload?.issueId;
      if (id) {
        setShortTerm((prev) => prev.filter((t) => t.id !== id));
        setLongTerm((prev) => prev.filter((t) => t.id !== id));
      }
    };
    const onIssueListChanged = () => {
      fetchIssues();
    };
    socket.on('issue_created', onIssueCreated);
    socket.on('issue_updated', onIssueUpdated);
    socket.on('issue_deleted', onIssueDeleted);
    socket.on('issue_list_changed', onIssueListChanged);
    return () => {
      socket.off('issue_created', onIssueCreated);
      socket.off('issue_updated', onIssueUpdated);
      socket.off('issue_deleted', onIssueDeleted);
      socket.off('issue_list_changed', onIssueListChanged);
    };
  }, [socket, teamId, fetchIssues]);

  const addIssue = useCallback(
    async (data: {
      title: string;
      description?: string;
      priority?: number;
      termType?: 'short_term' | 'long_term';
    }): Promise<string> => {
      if (!organizationId || !teamId) return '';
      const term = data.termType ?? 'short_term';
      try {
        const created = await issuesService.create(
          organizationId,
          teamId,
          { ...data, termType: term },
          meetingId
        );
        const item = apiToItem(created);
        if (term === 'short_term') {
          setShortTerm((prev) => [...prev, item].sort((a, b) => b.priority - a.priority));
        } else {
          setLongTerm((prev) => [...prev, item].sort((a, b) => b.priority - a.priority));
        }
        return created.id;
      } catch {
        return '';
      }
    },
    [organizationId, teamId, meetingId]
  );

  const updateIssue = useCallback(
    async (id: string, patch: Partial<IssueItem>) => {
      if (!organizationId) return;
      try {
        const updated = await issuesService.update(
          organizationId,
          id,
          {
            title: patch.title,
            description: patch.description,
            priority: patch.priority,
            termType: patch.termType,
            resolvedAt: patch.resolvedAt,
          },
          meetingId
        );
        const item = apiToItem(updated);
        if (item.resolvedAt) {
          setShortTerm((prev) => prev.filter((t) => t.id !== id));
          setLongTerm((prev) => prev.filter((t) => t.id !== id));
          return;
        }
        if (item.termType === 'short_term') {
          setShortTerm((prev) =>
            prev.some((t) => t.id === id)
              ? prev.map((t) => (t.id === id ? item : t))
              : [...prev, item].sort((a, b) => b.priority - a.priority)
          );
          setLongTerm((prev) => prev.filter((t) => t.id !== id));
        } else {
          setLongTerm((prev) =>
            prev.some((t) => t.id === id)
              ? prev.map((t) => (t.id === id ? item : t))
              : [...prev, item].sort((a, b) => b.priority - a.priority)
          );
          setShortTerm((prev) => prev.filter((t) => t.id !== id));
        }
      } catch {
        setShortTerm((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
        setLongTerm((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      }
    },
    [organizationId, meetingId]
  );

  const deleteIssue = useCallback(
    async (id: string) => {
      if (!organizationId) return;
      try {
        await issuesService.delete(organizationId, id, meetingId);
        setShortTerm((prev) => prev.filter((t) => t.id !== id));
        setLongTerm((prev) => prev.filter((t) => t.id !== id));
      } catch {
        setShortTerm((prev) => prev.filter((t) => t.id !== id));
        setLongTerm((prev) => prev.filter((t) => t.id !== id));
      }
    },
    [organizationId, meetingId]
  );

  const setResolved = useCallback(
    (id: string, resolved: boolean) => {
      updateIssue(id, {
        resolvedAt: resolved ? new Date().toISOString() : null,
      });
    },
    [updateIssue]
  );

  const makeLongTerm = useCallback(
    (id: string) => {
      const moved = shortTerm.find((t) => t.id === id);
      if (!moved) return;
      updateIssue(id, { termType: 'long_term' });
      setShortTerm((prev) => prev.filter((t) => t.id !== id));
      setLongTerm((prev) =>
        [...prev, { ...moved, termType: 'long_term' as const }].sort(
          (a, b) => b.priority - a.priority
        )
      );
    },
    [shortTerm, updateIssue]
  );

  const value = useMemo(
    () => ({
      shortTerm,
      longTerm,
      addIssue,
      updateIssue,
      deleteIssue,
      setResolved,
      makeLongTerm,
      isLoading,
      refetch: fetchIssues,
    }),
    [
      shortTerm,
      longTerm,
      addIssue,
      updateIssue,
      deleteIssue,
      setResolved,
      makeLongTerm,
      isLoading,
      fetchIssues,
    ]
  );

  return (
    <IssuesContext.Provider value={value}>{children}</IssuesContext.Provider>
  );
}

export function useIssues() {
  const ctx = useContext(IssuesContext);
  if (!ctx) throw new Error('useIssues must be used within IssuesProvider');
  return ctx;
}

export function useIssuesOptional() {
  return useContext(IssuesContext);
}
