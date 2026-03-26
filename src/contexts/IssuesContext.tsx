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
  resolvedByName: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  linkedEntityTitle?: string | null;
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
    resolvedByName: i.resolvedByName ?? null,
    linkedEntityType: i.linkedEntityType ?? null,
    linkedEntityId: i.linkedEntityId ?? null,
    linkedEntityTitle: i.linkedEntityTitle ?? null,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    createdById: i.createdById,
    ownerInitials: i.ownerInitials,
  };
}

interface IssuesContextValue {
  shortTerm: IssueItem[];
  longTerm: IssueItem[];
  shortTermResolved: IssueItem[];
  longTermResolved: IssueItem[];
  addIssue: (data: {
    title: string;
    description?: string;
    priority?: number;
    termType?: 'short_term' | 'long_term';
    linkedEntityType?: string;
    linkedEntityId?: string;
    linkedEntityTitle?: string;
    createdById?: string;
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
  const [shortTermResolved, setShortTermResolved] = useState<IssueItem[]>([]);
  const [longTermResolved, setLongTermResolved] = useState<IssueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchIssues = useCallback(async () => {
    if (!organizationId || !teamId || typeof window === 'undefined') {
      setShortTerm([]);
      setLongTerm([]);
      setShortTermResolved([]);
      setLongTermResolved([]);
      return;
    }
    setIsLoading(true);
    try {
      const fetches: Promise<IssueApiItem[]>[] = [
        issuesService.findAll(organizationId, teamId, 'short_term', false, meetingId),
        issuesService.findAll(organizationId, teamId, 'long_term', false, meetingId),
      ];
      if (meetingId) {
        fetches.push(
          issuesService.findAll(organizationId, teamId, 'short_term', true, meetingId),
          issuesService.findAll(organizationId, teamId, 'long_term', true, meetingId)
        );
      }
      const results = await Promise.all(fetches);
      setShortTerm(results[0].map(apiToItem));
      setLongTerm(results[1].map(apiToItem));
      if (meetingId && results.length >= 4) {
        setShortTermResolved(results[2].map(apiToItem));
        setLongTermResolved(results[3].map(apiToItem));
      } else {
        setShortTermResolved([]);
        setLongTermResolved([]);
      }
    } catch {
      setShortTerm([]);
      setLongTerm([]);
      setShortTermResolved([]);
      setLongTermResolved([]);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, teamId, meetingId]);

  // When meetingId changes (new meeting), clear and refetch so we don't show previous meeting's stale list
  useEffect(() => {
    setShortTerm([]);
    setLongTerm([]);
    setShortTermResolved([]);
    setLongTermResolved([]);
  }, [meetingId]);

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
        if (item.termType === 'short_term') {
          setShortTermResolved((prev) =>
            prev.some((i) => i.id === item.id) ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item]
          );
          setLongTermResolved((prev) => prev.filter((t) => t.id !== item.id));
        } else {
          setLongTermResolved((prev) =>
            prev.some((i) => i.id === item.id) ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item]
          );
          setShortTermResolved((prev) => prev.filter((t) => t.id !== item.id));
        }
        return;
      }
      setShortTermResolved((prev) => prev.filter((t) => t.id !== item.id));
      setLongTermResolved((prev) => prev.filter((t) => t.id !== item.id));
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
        setShortTermResolved((prev) => prev.filter((t) => t.id !== id));
        setLongTermResolved((prev) => prev.filter((t) => t.id !== id));
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
      linkedEntityType?: string;
      linkedEntityId?: string;
      linkedEntityTitle?: string;
      createdById?: string;
    }): Promise<string> => {
      if (!organizationId || !teamId) return '';
      const term = data.termType ?? 'short_term';
      try {
        const payload = {
          title: data.title,
          description: data.description,
          priority: data.priority,
          termType: term,
          linkedEntityType: data.linkedEntityType,
          linkedEntityId: data.linkedEntityId,
          linkedEntityTitle: data.linkedEntityTitle,
          createdById: data.createdById,
        };
        const created = await issuesService.create(
          organizationId,
          teamId,
          payload,
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
            linkedEntityType: patch.linkedEntityType,
            linkedEntityId: patch.linkedEntityId,
            linkedEntityTitle: patch.linkedEntityTitle,
            createdById: patch.createdById,
          },
          meetingId
        );
        const item = apiToItem(updated);
        if (item.resolvedAt) {
          setShortTerm((prev) => prev.filter((t) => t.id !== id));
          setLongTerm((prev) => prev.filter((t) => t.id !== id));
          if (item.termType === 'short_term') {
            setShortTermResolved((prev) =>
              prev.some((i) => i.id === id) ? prev.map((i) => (i.id === id ? item : i)) : [...prev, item]
            );
            setLongTermResolved((prev) => prev.filter((t) => t.id !== id));
          } else {
            setLongTermResolved((prev) =>
              prev.some((i) => i.id === id) ? prev.map((i) => (i.id === id ? item : i)) : [...prev, item]
            );
            setShortTermResolved((prev) => prev.filter((t) => t.id !== id));
          }
          return;
        }
        setShortTermResolved((prev) => prev.filter((t) => t.id !== id));
        setLongTermResolved((prev) => prev.filter((t) => t.id !== id));
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
      shortTermResolved,
      longTermResolved,
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
      shortTermResolved,
      longTermResolved,
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
