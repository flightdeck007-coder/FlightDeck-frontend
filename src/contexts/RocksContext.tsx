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

export type RockStatus = 'on_track' | 'off_track' | 'at_risk' | 'done';
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

function createRock(
  overrides: Partial<Rock> & { id: string; title: string }
): Rock {
  return {
    ownerName: 'John Doe',
    ownerInitials: 'JD',
    dueBy: 'May 23',
    status: 'on_track',
    column: 'current',
    achieved: false,
    ...overrides,
  };
}

// No hardcoded rocks — rocks come from Create or API
const initialRocks: Rock[] = [];

interface RocksContextValue {
  rocks: Rock[];
  addRock: (rock: Omit<Rock, 'id'> & { id?: string }) => void;
  updateRock: (id: string, updates: Partial<Rock>) => void;
  moveRockToColumn: (rockId: string, column: RockColumnId) => void;
  archiveRock: (id: string) => void;
  deleteRock: (id: string) => void;
  getRocksByColumn: (column: RockColumnId) => Rock[];
  getActiveRocks: () => Rock[];
  getArchivedRocks: () => Rock[];
  columnOrder: RockColumnId[];
}

const STORAGE_KEY = (meetingId: string) => `meeting-${meetingId}-rocks`;

const RocksContext = createContext<RocksContextValue | null>(null);

export function RocksProvider({
  children,
  meetingId,
}: { children: ReactNode; meetingId?: string }) {
  const { socket } = useMeetingSocket();
  const [rocks, setRocks] = useState<Rock[]>(initialRocks);

  useEffect(() => {
    if (!meetingId || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY(meetingId));
      if (raw) {
        const parsed = JSON.parse(raw) as Rock[];
        if (Array.isArray(parsed) && parsed.length >= 0) setRocks(parsed);
      }
    } catch {
      // ignore invalid stored data
    }
  }, [meetingId]);

  useEffect(() => {
    if (!meetingId || typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY(meetingId), JSON.stringify(rocks));
    } catch {
      // ignore quota etc.
    }
  }, [meetingId, rocks]);

  // Live sync: receive rock_created, rock_updated, rock_deleted from other participants
  useEffect(() => {
    if (!socket || !meetingId) return;
    const onRockCreated = (payload: { meetingId: string; rock: Rock }) => {
      if (payload.meetingId !== meetingId || !payload.rock?.id) return;
      const rock = payload.rock as Rock;
      setRocks((prev) =>
        prev.some((r) => r.id === rock.id) ? prev : [...prev, rock]
      );
    };
    const onRockUpdated = (payload: { meetingId: string; rock: Rock }) => {
      if (payload.meetingId !== meetingId || !payload.rock?.id) return;
      const rock = payload.rock as Rock;
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
    (rock: Omit<Rock, 'id'> & { id?: string }) => {
      const id = rock.id ?? `rock-${Date.now()}`;
      const newRock = { ...rock, id } as Rock;
      setRocks((prev) => [...prev, newRock]);
      if (socket && meetingId) socket.emit('rock_created', { meetingId, rock: newRock });
    },
    [socket, meetingId]
  );

  const updateRock = useCallback((id: string, updates: Partial<Rock>) => {
    setRocks((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...updates } : r));
      const updated = next.find((r) => r.id === id);
      if (updated && socket && meetingId) socket.emit('rock_updated', { meetingId, rock: updated });
      return next;
    });
  }, [socket, meetingId]);

  const moveRockToColumn = useCallback((rockId: string, column: RockColumnId) => {
    setRocks((prev) => {
      const next = prev.map((r) => (r.id === rockId ? { ...r, column } : r));
      const updated = next.find((r) => r.id === rockId);
      if (updated && socket && meetingId) socket.emit('rock_updated', { meetingId, rock: updated });
      return next;
    });
  }, [socket, meetingId]);

  const archiveRock = useCallback((id: string) => {
    setRocks((prev) => {
      const next = prev.map((r) =>
        r.id === id ? { ...r, achieved: true, status: 'done' as RockStatus } : r
      );
      const updated = next.find((r) => r.id === id);
      if (updated && socket && meetingId) socket.emit('rock_updated', { meetingId, rock: updated });
      return next;
    });
  }, [socket, meetingId]);

  const deleteRock = useCallback((id: string) => {
    setRocks((prev) => prev.filter((r) => r.id !== id));
    if (socket && meetingId) socket.emit('rock_deleted', { meetingId, rockId: id });
  }, [socket, meetingId]);

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
      deleteRock,
      getRocksByColumn,
      getActiveRocks,
      getArchivedRocks,
      columnOrder: COLUMN_ORDER,
    }),
    [
      rocks,
      addRock,
      updateRock,
      moveRockToColumn,
      archiveRock,
      deleteRock,
      getRocksByColumn,
      getActiveRocks,
      getArchivedRocks,
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
