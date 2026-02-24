'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

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

const RocksContext = createContext<RocksContextValue | null>(null);

export function RocksProvider({ children }: { children: ReactNode }) {
  const [rocks, setRocks] = useState<Rock[]>(initialRocks);

  const addRock = useCallback(
    (rock: Omit<Rock, 'id'> & { id?: string }) => {
      const id = rock.id ?? `rock-${Date.now()}`;
      setRocks((prev) => [...prev, { ...rock, id } as Rock]);
    },
    []
  );

  const updateRock = useCallback((id: string, updates: Partial<Rock>) => {
    setRocks((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  }, []);

  const moveRockToColumn = useCallback((rockId: string, column: RockColumnId) => {
    setRocks((prev) =>
      prev.map((r) => (r.id === rockId ? { ...r, column } : r))
    );
  }, []);

  const archiveRock = useCallback((id: string) => {
    setRocks((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, achieved: true, status: 'done' as RockStatus } : r
      )
    );
  }, []);

  const deleteRock = useCallback((id: string) => {
    setRocks((prev) => prev.filter((r) => r.id !== id));
  }, []);

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
