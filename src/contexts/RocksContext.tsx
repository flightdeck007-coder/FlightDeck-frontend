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
import { useMeetingSocket } from './MeetingSocketContext';
import { meetingsService } from '@/lib/api/meetings.service';

export type RockStatus = 'on_track' | 'off_track' | 'at_risk' | 'done' | 'other';
export type RockColumnId =
  | 'current'
  | 'next'
  | 'later'
  | 'future'
  | 'long_term';

export interface Rock {
  id: string;
  title: string;
  ownerName: string;
  ownerInitials: string;
  dueBy: string;
  status: RockStatus;
  column: RockColumnId;
  achieved: boolean;
  isCompanyRock?: boolean;
  milestoneLabel?: string;
}

const COLUMN_ORDER: RockColumnId[] = [
  'current',
  'next',
  'later',
  'future',
  'long_term',
];

function apiToRock(r: {
  id: string;
  title: string;
  ownerName: string;
  ownerInitials: string;
  dueBy: string;
  status: string;
  column: string;
  achieved: boolean;
  isCompanyRock?: boolean;
  milestoneLabel?: string | null;
}): Rock {
  return {
    id: r.id,
    title: r.title,
    ownerName: r.ownerName,
    ownerInitials: r.ownerInitials,
    dueBy: r.dueBy,
    status: r.status as RockStatus,
    column: r.column as RockColumnId,
    achieved: r.achieved,
    isCompanyRock: r.isCompanyRock,
    milestoneLabel: r.milestoneLabel ?? undefined,
  };
}

interface RocksContextValue {
  rocks: Rock[];
  addRock: (rock: Omit<Rock, 'id'> & { id?: string }) => void;
  updateRock: (id: string, updates: Partial<Rock>) => void;
  moveRockToColumn: (rockId: string, column: RockColumnId) => void;
  archiveRock: (id: string) => void;
  unarchiveRock: (id: string) => void;
  deleteRock: (id: string) => void;
  getRocksByColumn: (column: RockColumnId) => Rock[];
  getActiveRocks: () => Rock[];
  getArchivedRocks: () => Rock[];
  columnOrder: RockColumnId[];
  isLoading: boolean;
}

const RocksContext = createContext<RocksContextValue | null>(null);

export function RocksProvider({
  children,
  meetingId,
  organizationId,
}: { children: ReactNode; meetingId?: string; organizationId?: string }) {
  const { socket } = useMeetingSocket();
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRocks = useCallback(async () => {
    if (!organizationId || !meetingId || typeof window === 'undefined') {
      setRocks([]);
      return;
    }
    setIsLoading(true);
    try {
      const list = await meetingsService.getRocks(organizationId, meetingId);
      setRocks(list.map(apiToRock));
    } catch {
      setRocks([]);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, meetingId]);

  useEffect(() => {
    fetchRocks();
  }, [fetchRocks]);

  useEffect(() => {
    if (!meetingId) setRocks([]);
  }, [meetingId]);

  useEffect(() => {
    if (!socket || !meetingId) return;
    const onRockCreated = (payload: { meetingId: string; rock: Rock }) => {
      if (payload.meetingId !== meetingId || !payload.rock?.id) return;
      const rock = apiToRock(payload.rock as Parameters<typeof apiToRock>[0]);
      setRocks((prev) =>
        prev.some((r) => r.id === rock.id) ? prev : [...prev, rock]
      );
    };
    const onRockUpdated = (payload: { meetingId: string; rock: Rock }) => {
      if (payload.meetingId !== meetingId || !payload.rock?.id) return;
      const rock = apiToRock(payload.rock as Parameters<typeof apiToRock>[0]);
      setRocks((prev) =>
        prev.map((r) => (r.id === rock.id ? rock : r))
      );
    };
    const onRockDeleted = (payload: { meetingId: string; rockId: string }) => {
      if (payload.meetingId !== meetingId || !payload.rockId) return;
      setRocks((prev) => prev.filter((r) => r.id !== payload.rockId));
    };
    socket.on('rock_created', onRockCreated);
    socket.on('rock_updated', onRockUpdated);
    socket.on('rock_deleted', onRockDeleted);
    return () => {
      socket.off('rock_created', onRockCreated);
      socket.off('rock_updated', onRockUpdated);
      socket.off('rock_deleted', onRockDeleted);
    };
  }, [socket, meetingId]);

  const addRock = useCallback(
    async (rock: Omit<Rock, 'id'> & { id?: string }) => {
      if (!organizationId || !meetingId) return;
      try {
        const created = await meetingsService.createRock(organizationId, meetingId, {
          title: rock.title,
          ownerName: rock.ownerName,
          ownerInitials: rock.ownerInitials,
          dueBy: rock.dueBy,
          status: rock.status,
          column: rock.column,
          achieved: rock.achieved,
          isCompanyRock: rock.isCompanyRock,
          milestoneLabel: rock.milestoneLabel,
        });
        const newRock = apiToRock(created);
        setRocks((prev) =>
          prev.some((r) => r.id === newRock.id) ? prev : [...prev, newRock]
        );
      } catch {
        // keep UI unchanged on error
      }
    },
    [organizationId, meetingId]
  );

  const updateRock = useCallback(
    async (id: string, updates: Partial<Rock>) => {
      if (!organizationId || !meetingId) return;
      setRocks((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
      try {
        await meetingsService.updateRock(organizationId, meetingId, id, updates);
      } catch {
        fetchRocks();
      }
    },
    [organizationId, meetingId, fetchRocks]
  );

  const moveRockToColumn = useCallback(
    (rockId: string, column: RockColumnId) => {
      updateRock(rockId, { column });
    },
    [updateRock]
  );

  const archiveRock = useCallback(
    (id: string) => {
      updateRock(id, { achieved: true, status: 'done' });
    },
    [updateRock]
  );

  const unarchiveRock = useCallback(
    (id: string) => {
      updateRock(id, { achieved: false, status: 'on_track' });
    },
    [updateRock]
  );

  const deleteRock = useCallback(
    async (id: string) => {
      if (!organizationId || !meetingId) return;
      setRocks((prev) => prev.filter((r) => r.id !== id));
      try {
        await meetingsService.deleteRock(organizationId, meetingId, id);
      } catch {
        fetchRocks();
      }
    },
    [organizationId, meetingId, fetchRocks]
  );

  const getRocksByColumn = useCallback(
    (column: RockColumnId) => rocks.filter((r) => !r.achieved && r.column === column),
    [rocks]
  );

  const getActiveRocks = useCallback(
    () => rocks.filter((r) => !r.achieved),
    [rocks]
  );

  const getArchivedRocks = useCallback(
    () => rocks.filter((r) => r.achieved),
    [rocks]
  );

  const value = useMemo(
    () => ({
      rocks,
      addRock,
      updateRock,
      moveRockToColumn,
      archiveRock,
      unarchiveRock,
      deleteRock,
      getRocksByColumn,
      getActiveRocks,
      getArchivedRocks,
      columnOrder: COLUMN_ORDER,
      isLoading,
    }),
    [
      rocks,
      addRock,
      updateRock,
      moveRockToColumn,
      archiveRock,
      unarchiveRock,
      deleteRock,
      getRocksByColumn,
      getActiveRocks,
      getArchivedRocks,
      isLoading,
    ]
  );

  return (
    <RocksContext.Provider value={value}>{children}</RocksContext.Provider>
  );
}

export function useRocks() {
  const ctx = useContext(RocksContext);
  if (!ctx) throw new Error('useRocks must be used within RocksProvider');
  return ctx;
}

export function useRocksOptional() {
  return useContext(RocksContext);
}
