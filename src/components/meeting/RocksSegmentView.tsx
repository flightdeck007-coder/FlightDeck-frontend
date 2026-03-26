'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useMeetingSocket } from '@/contexts/MeetingSocketContext';
import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
  pointerWithin,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Select, Input } from 'antd';
import { issuesService } from '@/lib/api/issues.service';
import { todosService } from '@/lib/api/todos.service';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MoreHorizontal,
  RefreshCw,
  FileDown,
  Download,
  Archive,
  Mountain,
  CheckSquare,
  AlertCircle,
  Megaphone,
  Link2,
  Trash2,
  List,
  LayoutGrid,
  Archive as ArchiveIcon,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Filter,
  Pencil,
  X,
  Check,
  GripVertical,
  Calendar as CalendarIcon,
  Plus,
} from 'lucide-react';
import {
  useRocks,
  type Rock,
  type RockColumnId,
} from '@/contexts/RocksContext';
import { useIssuesOptional } from '@/contexts/IssuesContext';
import { useTodosOptional } from '@/contexts/TodosContext';
import { FLIGHT_TERMS } from '@/lib/constants/flightTerminology';
import { ContentAreaLoader } from '@/components/ui/loaders';
import { RichTextEditor } from './RichTextEditor';
import { teamsService } from '@/lib/api/teams.service';
import type { TeamMember } from '@/lib/api/teams.service';

const COLUMN_LABELS: Record<RockColumnId, string> = {
  current: 'Current',
  next: 'Next',
  later: 'Later',
  future: 'Future',
  long_term: 'Long-Term Turbulence',
};

const STATUS_LABEL: Record<Rock['status'], string> = {
  on_track: 'On-track',
  off_track: 'Off-track',
  at_risk: 'At-risk',
  done: 'Complete',
  other: 'Other',
};

function statusBadgeClass(status: Rock['status']): string {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium';
  switch (status) {
    case 'on_track':
      return `${base} bg-green-500/15 text-green-700 dark:text-green-400`;
    case 'off_track':
      return `${base} bg-red-500/15 text-red-700 dark:text-red-400`;
    case 'at_risk':
      return `${base} bg-yellow-500/15 text-yellow-700 dark:text-yellow-400`;
    case 'done':
      return `${base} bg-emerald-500/15 text-emerald-600 dark:text-emerald-400`;
    case 'other':
      return `${base} bg-slate-400/15 text-slate-600 dark:text-slate-300`;
    default:
      return `${base} bg-muted text-muted-foreground`;
  }
}

const STATUS_OPTIONS: Array<{ value: Rock['status']; label: string; icon: React.ReactNode; optionClass: string }> = [
  { value: 'off_track', label: 'Off-track', icon: <ThumbsDown className="w-3.5 h-3.5" />, optionClass: 'bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20' },
  { value: 'on_track', label: 'On-track', icon: <ThumbsUp className="w-3.5 h-3.5" />, optionClass: 'bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20' },
  { value: 'at_risk', label: 'At-risk', icon: <AlertTriangle className="w-3.5 h-3.5" />, optionClass: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20' },
  { value: 'done', label: 'Complete', icon: <CheckCircle className="w-3.5 h-3.5" />, optionClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20' },
  { value: 'other', label: 'Other', icon: <HelpCircle className="w-3.5 h-3.5" />, optionClass: 'bg-slate-400/10 text-slate-600 dark:text-slate-300 hover:bg-slate-400/20' },
];

const DROPDOWN_OPTION_HEIGHT = 44;
const DROPDOWN_PADDING = 12;
const DROPDOWN_GAP = 4;
const DROPDOWN_EST_HEIGHT = STATUS_OPTIONS.length * DROPDOWN_OPTION_HEIGHT + DROPDOWN_PADDING * 2;

function RockStatusDropdown({ rock, onStatusChange }: { rock: Rock; onStatusChange: (status: Rock['status']) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; openUp: boolean } | null>(null);

  useEffect(() => {
    if (!open || !btnRef.current) {
      setPosition(null);
      return;
    }
    const rect = btnRef.current.getBoundingClientRect();
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 600;
    const spaceBelow = viewportH - rect.bottom - DROPDOWN_GAP;
    const openUp = spaceBelow < DROPDOWN_EST_HEIGHT && rect.top > spaceBelow;
    const rawTop = openUp ? rect.top - DROPDOWN_EST_HEIGHT - DROPDOWN_GAP : rect.bottom + DROPDOWN_GAP;
    const top = typeof window !== 'undefined' ? Math.max(8, rawTop) : rawTop;
    const minW = 140;
    let left = rect.left;
    if (typeof window !== 'undefined') {
      if (left + minW > window.innerWidth) left = window.innerWidth - minW - 8;
      if (left < 8) left = 8;
    }
    setPosition({ top, left, openUp });
  }, [open]);

  const current = STATUS_OPTIONS.find((o) => o.value === rock.status) ?? STATUS_OPTIONS[0];

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-transparent cursor-pointer transition-colors ${statusBadgeClass(rock.status)} hover:opacity-90`}
      >
        {current.icon}
        <span>{current.label}</span>
        <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && position && typeof document !== 'undefined' &&
        createPortal(
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
            <div
              className="fixed z-20 py-1.5 min-w-[140px] overflow-y-auto rounded-lg border border-border bg-card shadow-xl"
              style={{
                top: position.top,
                left: position.left,
                maxHeight:
                  typeof window !== 'undefined'
                    ? position.openUp
                      ? Math.min(280, position.top - 8)
                      : Math.min(280, window.innerHeight - position.top - 8)
                    : 280,
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onStatusChange(opt.value); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium rounded-md transition-colors ${opt.optionClass} ${rock.status === opt.value ? 'ring-1 ring-inset ring-current/30' : ''}`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

/** Estimated width of the rock actions dropdown so we can keep it on-screen */
const ROCK_ACTIONS_MENU_WIDTH = 248;
const ROCK_ACTIONS_MENU_GAP = 8;

type CreatePopupType = 'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message';
type RockMilestone = { id: string; title: string; dueDate: string; description?: string; completed?: boolean };
type LinkedEntityType = 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message' | 'rock_milestone';
type LinkedEntityOption = { type: LinkedEntityType; id: string; title: string };
type LinkedRockItem = { id: string; type: 'Clearance' | 'Turbulence'; entityType: 'todo' | 'issue'; title: string; subtitle?: string };

function milestoneStorageKey(rockId: string): string {
  return `rock-milestones-${rockId}`;
}

function readRockMilestones(rockId: string): RockMilestone[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(milestoneStorageKey(rockId));
    const parsed = raw ? (JSON.parse(raw) as RockMilestone[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRockMilestones(rockId: string, milestones: RockMilestone[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(milestoneStorageKey(rockId), JSON.stringify(milestones));
}

function formatIsoDateToUs(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface RocksSegmentViewProps {
  sectionTitle?: string;
  embedded?: boolean;
  meetingId?: string;
  organizationId?: string;
  teamId?: string | null;
  teamName?: string;
  isFacilitator?: boolean;
  /** Scribe or facilitator can change filters and create (recording) */
  canRecord?: boolean;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; linkedEntity?: LinkedEntityOption }) => void;
}

export function RocksSegmentView({
  sectionTitle = 'Waypoint Review',
  embedded = false,
  meetingId,
  organizationId,
  teamId,
  teamName,
  isFacilitator = true,
  canRecord,
  onOpenCreate,
}: RocksSegmentViewProps) {
  const canUseFilters = canRecord ?? isFacilitator;
  const resolvedTeamName = teamName ?? 'No team found';
  const [teamFilter, setTeamFilter] = useState(resolvedTeamName);
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'rocks' | 'planning' | 'archive'>(
    'rocks'
  );
  const [vtoExpanded, setVtoExpanded] = useState(false);
  const [selectedRockId, setSelectedRockId] = useState<string | null>(null);
  const [datePickerRockId, setDatePickerRockId] = useState<string | null>(null);
  const [milestonesByRock, setMilestonesByRock] = useState<Record<string, RockMilestone[]>>({});
  const { socket } = useMeetingSocket();
  useEffect(() => {
    setTeamFilter(resolvedTeamName);
  }, [resolvedTeamName]);

  // Sync rocks filters/tabs from facilitator to members
  useEffect(() => {
    if (!socket || !meetingId) return;
    const onRocksFilter = (payload: {
      activeTab?: 'rocks' | 'planning' | 'archive';
      teamFilter?: string;
      ownerFilter?: string;
      statusFilter?: string;
      searchQuery?: string;
    }) => {
      if (payload.activeTab !== undefined) setActiveTab(payload.activeTab);
      if (payload.teamFilter !== undefined) setTeamFilter(payload.teamFilter);
      if (payload.ownerFilter !== undefined) setOwnerFilter(payload.ownerFilter);
      if (payload.statusFilter !== undefined) setStatusFilter(payload.statusFilter);
      if (payload.searchQuery !== undefined) setSearchQuery(payload.searchQuery);
    };
    socket.on('rocks_filter', onRocksFilter);
    return () => {
      socket.off('rocks_filter', onRocksFilter);
    };
  }, [socket, meetingId]);

  const {
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
    columnOrder,
    isLoading,
  } = useRocks();

  useEffect(() => {
    const next: Record<string, RockMilestone[]> = {};
    rocks.forEach((r) => {
      const fromApi = (r.milestones ?? []) as RockMilestone[];
      if (fromApi.length > 0) {
        next[r.id] = fromApi;
        writeRockMilestones(r.id, fromApi);
        return;
      }
      const saved = readRockMilestones(r.id);
      if (saved.length > 0) next[r.id] = saved;
    });
    setMilestonesByRock(next);
  }, [rocks]);

  const activeRocks = getActiveRocks();
  const archivedRocks = getArchivedRocks();
  const filteredRocks = useMemo(() => {
    let list = activeRocks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.ownerName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeRocks, searchQuery]);

  const companyRocks = useMemo(
    () => filteredRocks.filter((r) => r.isCompanyRock),
    [filteredRocks]
  );
  /** Rocks grouped by owner (each owner's list includes their company rocks too — visible in both Company and under owner) */
  const rocksByOwner = useMemo(() => {
    const byOwner = new Map<string, Rock[]>();
    for (const r of filteredRocks) {
      const list = byOwner.get(r.ownerName) ?? [];
      list.push(r);
      byOwner.set(r.ownerName, list);
    }
    return Array.from(byOwner.entries()).map(([ownerName, list]) => ({ ownerName, rocks: list }));
  }, [filteredRocks]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const rockId = String(active.id);
    const overId = String(over.id);
    let col: RockColumnId | undefined;
    if (overId.startsWith('column-')) {
      col = overId.replace('column-', '') as RockColumnId;
    } else {
      const rock = rocks.find((r) => r.id === overId);
      if (rock) col = rock.column;
    }
    if (col && columnOrder.includes(col)) {
      moveRockToColumn(rockId, col);
      // TODO: when moving between columns, update rock "times" / due dates per column (Current/Next/Later/Future/Long-Term)
    }
  };

  const wrap = embedded ? 'pt-0 pb-4' : 'pt-0 pb-6';
  const contentPad = embedded ? 'px-4' : 'px-6';
  return (
    <div className={`flex flex-col min-h-0 h-full ${wrap}`}>
      {/* Filters row — full width like main header */}
      <div className="flex flex-wrap items-center gap-3 py-3 -mx-6 px-4 border-t border-b border-border bg-muted/30 shrink-0">
        <div className={`flex items-center gap-1 ${!canUseFilters ? 'cursor-not-allowed opacity-70' : ''}`}>
          <span className="text-muted-foreground text-sm">Flight Crew:</span>
          <Select
            value={teamFilter}
            onChange={(v) => {
              if (!canUseFilters) return;
              setTeamFilter(v);
              if (meetingId && socket) socket.emit('rocks_filter', { meetingId, teamFilter: v });
            }}
            disabled={!canUseFilters}
            options={[{ label: resolvedTeamName, value: resolvedTeamName }]}
            className="w-[160px]"
          />
        </div>
        <div className={`flex items-center gap-1 ${!canUseFilters ? 'cursor-not-allowed opacity-70' : ''}`}>
          <span className="text-muted-foreground text-sm">Owner:</span>
          <Select
            value={ownerFilter}
            onChange={(v) => {
              if (!canUseFilters) return;
              setOwnerFilter(v);
              if (meetingId && socket) socket.emit('rocks_filter', { meetingId, ownerFilter: v });
            }}
            disabled={!canUseFilters}
            options={[{ label: 'All', value: 'All' }]}
            className="w-[120px]"
          />
        </div>
        <div className={`flex items-center gap-1 ${!canUseFilters ? 'cursor-not-allowed opacity-70' : ''}`}>
          <span className="text-muted-foreground text-sm">Status:</span>
          <Select
            value={statusFilter}
            onChange={(v) => {
              if (!canUseFilters) return;
              setStatusFilter(v);
              if (meetingId && socket) socket.emit('rocks_filter', { meetingId, statusFilter: v });
            }}
            disabled={!canUseFilters}
            options={[
              { label: 'All', value: 'All' },
              { label: 'On-track', value: 'On-track' },
              { label: 'Off-track', value: 'Off-track' },
              { label: 'At-risk', value: 'At-risk' },
              { label: 'Complete', value: 'Complete' },
              { label: 'Other', value: 'Other' },
            ]}
            className="w-[120px]"
          />
        </div>
        <div className="flex-1 min-w-[200px] flex justify-end items-center gap-2">
          <Input.Search
            placeholder={`Search ${sectionTitle}...`}
            value={searchQuery}
            onChange={(e) => {
              if (!canUseFilters) return;
              const v = e.target.value;
              setSearchQuery(v);
              if (meetingId && socket) socket.emit('rocks_filter', { meetingId, searchQuery: v });
            }}
            disabled={!canUseFilters}
            allowClear
            className="max-w-xs"
            onSearch={(v) => {
              if (!canUseFilters) return;
              setSearchQuery(v);
              if (meetingId && socket) socket.emit('rocks_filter', { meetingId, searchQuery: v });
            }}
          />
          {canUseFilters && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreActionsOpen((o) => !o)}
                className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="More actions"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {moreActionsOpen && (
                <>
                  <div className="absolute right-0 top-full mt-1 py-1 bg-card border border-border rounded-md shadow-lg z-20 min-w-[200px]">
                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" onClick={() => setMoreActionsOpen(false)}>
                      <RefreshCw className="w-4 h-4" /> Refresh Waypoints
                    </button>
                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" onClick={() => setMoreActionsOpen(false)}>
                      <FileDown className="w-4 h-4" /> Print to PDF
                    </button>
                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" onClick={() => setMoreActionsOpen(false)}>
                      <Download className="w-4 h-4" /> Download Excel
                    </button>
                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" onClick={() => setMoreActionsOpen(false)}>
                      <Archive className="w-4 h-4" /> Archive Completed
                    </button>
                  </div>
                  <div className="fixed inset-0 z-10" onClick={() => setMoreActionsOpen(false)} aria-hidden />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content: padding after filter bar — or full-area loader when fetching */}
      {isLoading ? (
        <ContentAreaLoader label="Loading rocks…" />
      ) : (
      <div className="flex-1 flex flex-col min-h-0">
      {/* Tabs — full width, no side padding; white bg; no extra space above */}
      <div className="-mx-6 border-b border-border shrink-0 bg-background mt-0">
        <div className="flex gap-0">
          {(
            [
              { id: 'rocks', label: FLIGHT_TERMS.ROCKS, icon: List },
              { id: 'planning', label: FLIGHT_TERMS.PLANNING_BOARD, icon: LayoutGrid },
              { id: 'archive', label: 'Archive', icon: ArchiveIcon },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (!canUseFilters) return;
                setActiveTab(tab.id);
                if (meetingId && socket) socket.emit('rocks_filter', { meetingId, activeTab: tab.id });
              }}
              disabled={!canUseFilters}
              className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors rounded-t-md ${
                activeTab === tab.id
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              } ${!canUseFilters ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className={`flex-1 overflow-auto min-h-0 mt-4 ${contentPad}`}>
        {activeTab === 'rocks' && (
          <RocksTabContent
            companyRocks={companyRocks}
            rocksByOwner={rocksByOwner}
            milestonesByRock={milestonesByRock}
            onMilestonesChange={(rockId, next) => {
              setMilestonesByRock((prev) => ({ ...prev, [rockId]: next }));
              writeRockMilestones(rockId, next);
              updateRock(rockId, {
                milestones: next,
                milestoneLabel: next[next.length - 1]?.title ?? null,
              });
            }}
            vtoExpanded={vtoExpanded}
            onVtoToggle={() => setVtoExpanded((e) => !e)}
            onOpenCreate={onOpenCreate}
            meetingId={meetingId}
            organizationId={organizationId}
            teamId={teamId}
            teamName={resolvedTeamName}
            onOpenDetail={(rock) => setSelectedRockId(rock.id)}
            onOpenDatePicker={(rock) => setDatePickerRockId(rock.id)}
            onAddRock={() => {
              if (onOpenCreate) onOpenCreate('rock');
              else addRock({
                title: 'New rock',
                ownerName: 'User',
                ownerInitials: 'U',
                dueBy: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                status: 'on_track',
                column: 'current',
                achieved: false,
                isCompanyRock: false,
              });
            }}
          />
        )}
        {activeTab === 'planning' && (
          <DndContext
            onDragEnd={handleDragEnd}
            collisionDetection={pointerWithin}
          >
            <PlanningBoard
              columnOrder={columnOrder}
              getRocksByColumn={getRocksByColumn}
            />
          </DndContext>
        )}
        {activeTab === 'archive' && (
          <ArchiveTabContent
            rocks={archivedRocks}
            milestonesByRock={milestonesByRock}
            onOpenCreate={onOpenCreate}
            meetingId={meetingId}
            organizationId={organizationId}
            teamId={teamId}
            teamName={resolvedTeamName}
            onUnarchive={unarchiveRock}
            onOpenDetail={(rock) => setSelectedRockId(rock.id)}
            onOpenDatePicker={(rock) => setDatePickerRockId(rock.id)}
          />
        )}
      </div>

      {selectedRockId && (() => {
        const rock = rocks.find((r) => r.id === selectedRockId);
        return rock ? (
          <RockDetailPanel
            rock={rock}
            meetingId={meetingId}
            organizationId={organizationId}
            teamId={teamId}
            teamName={resolvedTeamName}
            initialMilestones={milestonesByRock[rock.id] ?? []}
            onMilestonesChange={(next) => {
              setMilestonesByRock((prev) => ({ ...prev, [rock.id]: next }));
              writeRockMilestones(rock.id, next);
              updateRock(rock.id, {
                milestones: next,
                milestoneLabel: next[next.length - 1]?.title ?? null,
              });
            }}
            onClose={() => setSelectedRockId(null)}
            onOpenCreate={onOpenCreate}
          />
        ) : null;
      })()}
      {datePickerRockId && (() => {
        const rock = rocks.find((r) => r.id === datePickerRockId);
        return rock ? (
          <RockDatePickerModal
            rock={rock}
            onClose={() => setDatePickerRockId(null)}
            onSave={(dueBy) => {
              updateRock(rock.id, { dueBy });
              setDatePickerRockId(null);
            }}
          />
        ) : null;
      })()}
      </div>
    )}
    </div>
  );
}

function RocksTabContent({
  companyRocks,
  rocksByOwner,
  milestonesByRock,
  onMilestonesChange,
  vtoExpanded,
  onVtoToggle,
  onAddRock,
  onOpenCreate,
  meetingId,
  organizationId,
  teamId,
  teamName,
  onOpenDetail,
  onOpenDatePicker,
}: {
  companyRocks: Rock[];
  rocksByOwner: { ownerName: string; rocks: Rock[] }[];
  milestonesByRock: Record<string, RockMilestone[]>;
  onMilestonesChange: (rockId: string, next: RockMilestone[]) => void;
  vtoExpanded: boolean;
  onVtoToggle: () => void;
  onAddRock: () => void;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; linkedEntity?: LinkedEntityOption }) => void;
  meetingId?: string;
  organizationId?: string;
  teamId?: string | null;
  teamName: string;
  onOpenDetail?: (rock: Rock) => void;
  onOpenDatePicker?: (rock: Rock) => void;
}) {
  // V/TO card: edit mode so pencil shows edit options (90 Days input, Future Date, Revenue/Profit/Measurables +)
  type VtoRow = { id: string; description: string; value: string };
  const [vtoEditMode, setVtoEditMode] = useState(false);
  const [vto90Days, setVto90Days] = useState('90 Days');
  const [vtoFutureDate, setVtoFutureDate] = useState('February 28, 2023');
  const [vtoFutureDateIso, setVtoFutureDateIso] = useState('2023-02-28');
  const [revenueRows, setRevenueRows] = useState<VtoRow[]>([]);
  const [profitRows, setProfitRows] = useState<VtoRow[]>([]);
  const [measurablesRows, setMeasurablesRows] = useState<VtoRow[]>([]);
  const addVtoRow = (setter: React.Dispatch<React.SetStateAction<VtoRow[]>>) => {
    setter((prev) => [...prev, { id: crypto.randomUUID(), description: '', value: '' }]);
  };
  const updateVtoRow = (setter: React.Dispatch<React.SetStateAction<VtoRow[]>>, id: string, field: 'description' | 'value', value: string) => {
    setter((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };
  const removeVtoRow = (setter: React.Dispatch<React.SetStateAction<VtoRow[]>>, id: string) => {
    setter((prev) => prev.filter((r) => r.id !== id));
  };
  const handleVtoCardSave = () => setVtoEditMode(false);

  return (
    <div className="space-y-4">
      {/* V/TO section — accordion header has Pencil/Save (tick) on the right when expanded; no duplicate heading */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center w-full">
          <button
            type="button"
            onClick={onVtoToggle}
            className="flex-1 flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors min-w-0"
          >
            {vtoExpanded ? (
              <ChevronUp className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <span className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
              ∞
            </span>
            <span className="font-medium text-foreground truncate">
              V/TO® | Revenue, Profit, Measurables
            </span>
          </button>
          {vtoExpanded && (
            <div className="shrink-0 pr-2" onClick={(e) => e.stopPropagation()}>
              {vtoEditMode ? (
                <button type="button" onClick={handleVtoCardSave} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Save"><Check className="w-4 h-4" /></button>
              ) : (
                <button type="button" onClick={(e) => { e.stopPropagation(); setVtoEditMode(true); }} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
              )}
            </div>
          )}
        </div>
        {vtoExpanded && (
          <div className="border-t border-border p-4 text-sm space-y-0">
            {/* 90 Days — view: text only; edit: label above + input (save/tick is in accordion header) */}
            <div className="pt-4 mt-4 border-t border-border first:border-t-0 first:mt-0 first:pt-2">
              <div className="py-2">
                {vtoEditMode ? (
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground block">90 Days</label>
                    <input
                      type="text"
                      value={vto90Days}
                      onChange={(e) => setVto90Days(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md bg-white text-foreground text-sm placeholder:text-muted-foreground"
                      placeholder="90 Days"
                    />
                  </div>
                ) : (
                  <span className="font-semibold text-foreground">90 Days</span>
                )}
              </div>
            </div>
            {/* Future Date — label above; date input with calendar icon inside the field */}
            <div className="pt-5 mt-5 border-t border-border">
              <div className="py-2">
                {vtoEditMode ? (
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground block">Future Date</label>
                    <div className="flex items-center border border-border rounded-md bg-white overflow-hidden">
                      <input
                        type="date"
                        value={vtoFutureDateIso}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) {
                            setVtoFutureDateIso(v);
                            setVtoFutureDate(new Date(v + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
                          }
                        }}
                        className="flex-1 min-w-0 px-3 py-2 border-0 bg-transparent text-foreground text-sm focus:outline-none focus:ring-0"
                      />
                      <span className="pr-3 flex items-center pointer-events-none text-muted-foreground"><CalendarIcon className="w-4 h-4" /></span>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-foreground">Future Date: {vtoFutureDate}</span>
                )}
              </div>
            </div>
            {/* Revenue — label + circular add button (light grey border & fill, black plus) */}
            <div className="pt-5 mt-5 border-t border-border">
              <div className="flex items-center gap-2 py-3">
                <span className="text-sm font-medium text-foreground">Revenue:</span>
                {vtoEditMode && (
                  <button type="button" onClick={() => addVtoRow(setRevenueRows)} className="w-7 h-7 rounded-full border border-border bg-muted/50 flex items-center justify-center text-foreground hover:bg-muted" aria-label="Add revenue"><Plus className="w-3.5 h-3.5" /></button>
                )}
              </div>
              {vtoEditMode && (
                <div className="space-y-2 mt-2">
                  {revenueRows.map((row) => (
                    <div key={row.id} className="flex flex-row items-center gap-2">
                      <input type="text" value={row.description} onChange={(e) => updateVtoRow(setRevenueRows, row.id, 'description', e.target.value)} placeholder="Description" className="flex-1 min-w-0 px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm" />
                      <input type="text" value={row.value} onChange={(e) => updateVtoRow(setRevenueRows, row.id, 'value', e.target.value)} placeholder="Value" className="w-28 shrink-0 px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm" />
                      <button type="button" onClick={() => removeVtoRow(setRevenueRows, row.id)} className="shrink-0 p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Profit */}
            <div className="pt-5 mt-5 border-t border-border">
              <div className="flex items-center gap-2 py-3">
                <span className="text-sm font-medium text-foreground">Profit:</span>
                {vtoEditMode && (
                  <button type="button" onClick={() => addVtoRow(setProfitRows)} className="w-7 h-7 rounded-full border border-border bg-muted/50 flex items-center justify-center text-foreground hover:bg-muted" aria-label="Add profit"><Plus className="w-3.5 h-3.5" /></button>
                )}
              </div>
              {vtoEditMode && (
                <div className="space-y-2 mt-2">
                  {profitRows.map((row) => (
                    <div key={row.id} className="flex flex-row items-center gap-2">
                      <input type="text" value={row.description} onChange={(e) => updateVtoRow(setProfitRows, row.id, 'description', e.target.value)} placeholder="Description" className="flex-1 min-w-0 px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm" />
                      <input type="text" value={row.value} onChange={(e) => updateVtoRow(setProfitRows, row.id, 'value', e.target.value)} placeholder="Value" className="w-28 shrink-0 px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm" />
                      <button type="button" onClick={() => removeVtoRow(setProfitRows, row.id)} className="shrink-0 p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Measurables */}
            <div className="pt-5 mt-5 border-t border-border">
              <div className="flex items-center gap-2 py-3">
                <span className="text-sm font-medium text-foreground">Measurables:</span>
                {vtoEditMode && (
                  <button type="button" onClick={() => addVtoRow(setMeasurablesRows)} className="w-7 h-7 rounded-full border border-border bg-muted/50 flex items-center justify-center text-foreground hover:bg-muted" aria-label="Add measurable"><Plus className="w-3.5 h-3.5" /></button>
                )}
              </div>
              {vtoEditMode && (
                <div className="space-y-2 mt-2">
                  {measurablesRows.map((row) => (
                    <div key={row.id} className="flex flex-row items-center gap-2">
                      <input type="text" value={row.description} onChange={(e) => updateVtoRow(setMeasurablesRows, row.id, 'description', e.target.value)} placeholder="Description" className="flex-1 min-w-0 px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm" />
                      <input type="text" value={row.value} onChange={(e) => updateVtoRow(setMeasurablesRows, row.id, 'value', e.target.value)} placeholder="Value" className="w-28 shrink-0 px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm" />
                      <button type="button" onClick={() => removeVtoRow(setMeasurablesRows, row.id)} className="shrink-0 p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Company Rocks — no accordion; drag handle on hover */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/20">
          <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs text-foreground/70">
            ∿
          </span>
          <h3 className="font-semibold text-foreground">
            {FLIGHT_TERMS.COMPANY_WAYPOINTS} {companyRocks.length}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-medium text-foreground px-2 py-2 w-10" aria-label="Drag" />
                <th className="text-left font-medium text-foreground px-4 py-2">
                  Status
                </th>
                <th className="text-left font-medium text-foreground px-4 py-2">
                  Title
                </th>
                <th className="text-left font-medium text-foreground px-4 py-2">
                  Milestone progress
                </th>
                <th className="text-left font-medium text-foreground px-4 py-2">
                  Owner
                </th>
                <th className="text-left font-medium text-foreground px-4 py-2">
                  Due by
                </th>
                <th className="text-right font-medium text-foreground px-4 py-2 w-14">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {companyRocks.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No company rocks
                  </td>
                </tr>
              ) : (
                companyRocks.map((rock) => (
                  <RockRow
                    key={rock.id}
                    rock={rock}
                    milestones={milestonesByRock[rock.id] ?? []}
                    onUpdateMilestones={onMilestonesChange}
                    showMilestone
                    showOwnerColumn
                    onOpenCreate={onOpenCreate}
                    meetingId={meetingId}
                    organizationId={organizationId}
                    teamId={teamId}
                    teamName={teamName}
                    onOpenDetail={onOpenDetail}
                    onOpenDatePicker={onOpenDatePicker}
                    hideAccordion
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rocks by owner (each owner's rocks include company rocks — visible to all) */}
      {rocksByOwner.map(({ ownerName, rocks }) => {
        const initials = rocks[0]?.ownerInitials ?? ownerName.slice(0, 2).toUpperCase();
        return (
          <div key={ownerName} className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/20">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
                {initials}
              </div>
              <h3 className="font-semibold text-foreground">
                {ownerName} {rocks.length}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left font-medium text-foreground px-2 py-2 w-10" aria-label="Drag" />
                    <th className="text-left font-medium text-foreground px-4 py-2 w-8" />
                    <th className="text-left font-medium text-foreground px-4 py-2">
                      Status
                    </th>
                    <th className="text-left font-medium text-foreground px-4 py-2">
                      Title
                    </th>
                    <th className="text-left font-medium text-foreground px-4 py-2">
                      Milestone progress
                    </th>
                    <th className="text-left font-medium text-foreground px-4 py-2">
                      Due by
                    </th>
                    <th className="text-right font-medium text-foreground px-4 py-2 w-14">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rocks.map((rock) => (
                    <RockRow
                      key={rock.id}
                      rock={rock}
                      milestones={milestonesByRock[rock.id] ?? []}
                      onUpdateMilestones={onMilestonesChange}
                      showMilestone
                      showOwnerColumn={false}
                      onOpenCreate={onOpenCreate}
                      meetingId={meetingId}
                      organizationId={organizationId}
                      teamId={teamId}
                      teamName={teamName}
                      onOpenDetail={onOpenDetail}
                      onOpenDatePicker={onOpenDatePicker}
                    />
                  ))}
                  <tr>
                    <td colSpan={7} className="px-4 py-3">
                      <button
                        type="button"
                        onClick={onAddRock}
                        className="text-primary hover:underline text-sm font-medium flex items-center gap-1"
                      >
                        + Add Waypoint
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {rocksByOwner.length === 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/20">
            <h3 className="font-semibold text-foreground">{FLIGHT_TERMS.WAYPOINTS_BY_OWNER}</h3>
          </div>
          <div className="px-4 py-6">
            <button
              type="button"
              onClick={onAddRock}
              className="text-primary hover:underline text-sm font-medium flex items-center gap-1"
            >
              + Add Waypoint
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Build description for linked items from a rock */
function linkedDescription(rock: Rock): string {
  return `Linked to rock: ${rock.title}\nOwner: ${rock.ownerName}${rock.dueBy ? ` · Due: ${rock.dueBy}` : ''}`;
}

/**
 * Dropdown menu for a single waypoint's actions (Create linked Waypoint/Clearance/Turbulence/Headline, Archive, Print, Copy Link, Delete).
 * Rendered via portal so it appears above the page and is not clipped by table overflow.
 */
function RockActionsMenu({
  anchorRect,
  onClose,
  rock,
  onArchive,
  onUnarchive,
  onDelete,
  onOpenCreate,
  meetingId,
  organizationId,
  teamId,
  teamName,
  isArchiveView,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  rock: Rock;
  onArchive: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; linkedEntity?: LinkedEntityOption }) => void;
  meetingId?: string;
  organizationId?: string;
  teamId?: string | null;
  teamName?: string;
  isArchiveView?: boolean;
}) {
  const linkedRock = useMemo(() => ({ type: 'rock' as const, id: rock.id, title: rock.title }), [rock.id, rock.title]);
  const position = useMemo(() => {
    if (typeof window === 'undefined') return { top: anchorRect.top, left: anchorRect.right + ROCK_ACTIONS_MENU_GAP };
    const padding = 8;
    const maxLeft = window.innerWidth - ROCK_ACTIONS_MENU_WIDTH - padding;
    const leftWhenRight = anchorRect.right + ROCK_ACTIONS_MENU_GAP;
    const left = leftWhenRight > maxLeft
      ? anchorRect.left - ROCK_ACTIONS_MENU_WIDTH - ROCK_ACTIONS_MENU_GAP
      : leftWhenRight;
    const top = Math.min(
      anchorRect.top,
      Math.max(padding, window.innerHeight - 420)
    );
    return { top, left };
  }, [anchorRect]);

  const buttonClass =
    'w-full text-left px-3 py-2.5 text-sm text-foreground rounded-md flex items-center gap-3 transition-colors cursor-pointer hover:bg-accent';
  const iconClass = 'w-4 h-4 text-muted-foreground shrink-0';

  const handlePrintPdf = () => {
    onClose();
    const win = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (win) {
      win.document.write(`
        <!DOCTYPE html><html><head><title>Rock: ${rock.title}</title></head>
        <body style="font-family:system-ui;padding:24px;">
          <h1>${rock.title}</h1>
          <p><strong>Owner:</strong> ${rock.ownerName}</p>
          <p><strong>Due:</strong> ${rock.dueBy}</p>
          <p><strong>Status:</strong> ${rock.status}</p>
        </body></html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); win.close(); }, 250);
    }
  };

  const handleCopyLink = () => {
    onClose();
    const url = typeof window !== 'undefined' && meetingId
      ? `${window.location.origin}/meeting/${meetingId}#rock-${rock.id}`
      : `${window.location?.origin ?? ''}#rock-${rock.id}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    }
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed z-50 py-2 bg-card border border-border rounded-lg shadow-xl min-w-[240px]"
        style={{ top: position.top, left: position.left }}
        role="menu"
        aria-label="Rock actions"
      >
        <div className="px-2 py-1">
          <button
            type="button"
            className={buttonClass}
            onClick={() => { onOpenCreate?.('rock', { title: rock.title, description: linkedDescription(rock), linkedEntity: linkedRock }); onClose(); }}
            role="menuitem"
          >
            <Mountain className={iconClass} />
            Create linked Waypoint
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => { onOpenCreate?.('todo', { title: `Clearance: ${rock.title}`, description: linkedDescription(rock), linkedEntity: linkedRock }); onClose(); }}
            role="menuitem"
          >
            <CheckSquare className={iconClass} />
            Create linked Clearance
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => { onOpenCreate?.('issue', { title: `Turbulence: ${rock.title}`, description: linkedDescription(rock), linkedEntity: linkedRock }); onClose(); }}
            role="menuitem"
          >
            <AlertCircle className={iconClass} />
            Create linked Turbulence
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => { onOpenCreate?.('headline', { title: rock.title, description: linkedDescription(rock), linkedEntity: linkedRock }); onClose(); }}
            role="menuitem"
          >
            <Megaphone className={iconClass} />
            Create linked Headline
          </button>
        </div>
        <div className="border-t border-border my-1" />
        <div className="px-2 py-1">
          {isArchiveView && onUnarchive ? (
            <button
              type="button"
              className={buttonClass}
              onClick={() => { onUnarchive(rock.id); onClose(); }}
              role="menuitem"
            >
              <Archive className={iconClass} />
              Unarchive
            </button>
          ) : (
            <button
              type="button"
              className={buttonClass}
              onClick={() => { onArchive(rock.id); onClose(); }}
              role="menuitem"
            >
              <Archive className={iconClass} />
              Archive
            </button>
          )}
          <button type="button" className={buttonClass} onClick={handlePrintPdf} role="menuitem">
            <FileDown className={iconClass} />
            Print to PDF
          </button>
          <button type="button" className={buttonClass} onClick={handleCopyLink} role="menuitem">
            <Link2 className={iconClass} />
            Copy Link
          </button>
        </div>
        <div className="border-t border-border my-1" />
        <div className="px-2 py-1">
          <button
            type="button"
            className="w-full text-left px-3 py-2.5 text-sm text-red-600 rounded-md flex items-center gap-3 transition-colors cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => { onDelete(rock.id); onClose(); }}
            role="menuitem"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            Delete
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

function RockDatePickerModal({
  rock,
  onClose,
  onSave,
}: {
  rock: Rock;
  onClose: () => void;
  onSave: (dueBy: string) => void;
}) {
  const [value, setValue] = useState(() => {
    const d = new Date(rock.dueBy);
    return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
  });
  const handleSave = () => {
    const d = new Date(value);
    onSave(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  };
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} aria-hidden />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-card border border-border rounded-lg shadow-xl p-5">
        <h3 className="text-lg font-semibold text-foreground mb-3">Update due date</h3>
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm mb-4"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted">Cancel</button>
          <button type="button" onClick={handleSave} className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">Save</button>
        </div>
      </div>
    </>
  );
}

function rockAssigneeInitials(name?: string | null, email?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

function RockDetailPanel({
  rock,
  meetingId,
  organizationId,
  teamId,
  teamName,
  initialMilestones,
  onMilestonesChange,
  onClose,
  onOpenCreate,
}: {
  rock: Rock;
  meetingId?: string;
  organizationId?: string;
  teamId?: string | null;
  teamName: string;
  initialMilestones: RockMilestone[];
  onMilestonesChange: (next: RockMilestone[]) => void;
  onClose: () => void;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; linkedEntity?: LinkedEntityOption }) => void;
}) {
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<RockMilestone | null>(null);
  const [linkExistingOpen, setLinkExistingOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [attachDragOver, setAttachDragOver] = useState(false);
  const [title, setTitle] = useState(rock.title);
  const [dueBy, setDueBy] = useState(rock.dueBy);
  const [milestones, setMilestones] = useState<RockMilestone[]>(initialMilestones ?? []);
  const [linkedItems, setLinkedItems] = useState<LinkedRockItem[]>([]);
  const [linkedEditMode, setLinkedEditMode] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [ownerUserId, setOwnerUserId] = useState('');
  const { updateRock } = useRocks();

  useEffect(() => {
    setTitle(rock.title);
    setDueBy(rock.dueBy);
    setMilestones(initialMilestones ?? []);
  }, [rock.id, rock.title, rock.dueBy, initialMilestones]);

  useEffect(() => {
    if (!organizationId || !teamId) {
      setTeamMembers([]);
      return;
    }
    let cancelled = false;
    teamsService
      .getOne(organizationId, teamId)
      .then((t) => {
        if (!cancelled) setTeamMembers(t.members ?? []);
      })
      .catch(() => {
        if (!cancelled) setTeamMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, teamId]);

  useEffect(() => {
    const match = teamMembers.find((m) => {
      const u = m.user;
      if (!u) return false;
      const display = u.name || u.email || '';
      return display === rock.ownerName || u.email === rock.ownerName;
    });
    setOwnerUserId(match?.user?.id ?? '');
  }, [rock.id, rock.ownerName, teamMembers]);

  const loadLinkedItems = useCallback(async () => {
    if (!organizationId || !teamId) {
      setLinkedItems([]);
      return;
    }
    try {
      const [todos, shortIssues, longIssues] = await Promise.all([
        todosService.findAll(organizationId, teamId, false, meetingId),
        issuesService.findAll(organizationId, teamId, 'short_term', false, meetingId),
        issuesService.findAll(organizationId, teamId, 'long_term', false, meetingId),
      ]);
      const linkedTodos = todos
        .filter((t) => t.linkedEntityType === 'rock' && t.linkedEntityId === rock.id)
        .map((t) => ({ id: t.id, type: 'Clearance' as const, entityType: 'todo' as const, title: t.title, subtitle: t.status }));
      const linkedIssues = [...shortIssues, ...longIssues]
        .filter((i) => i.linkedEntityType === 'rock' && i.linkedEntityId === rock.id)
        .map((i) => ({
          id: i.id,
          type: 'Turbulence' as const,
          entityType: 'issue' as const,
          title: i.title,
          subtitle: i.termType === 'long_term' ? 'Long-Term' : 'Short-Term',
        }));
      setLinkedItems([...linkedTodos, ...linkedIssues]);
    } catch {
      setLinkedItems([]);
    }
  }, [organizationId, teamId, meetingId, rock.id]);

  useEffect(() => {
    loadLinkedItems();
  }, [loadLinkedItems]);

  const saveTitle = () => {
    const t = title.trim();
    if (t && t !== rock.title) updateRock(rock.id, { title: t });
  };

  const applyMilestones = (next: RockMilestone[]) => {
    setMilestones(next);
    onMilestonesChange(next);
    const latest = next[next.length - 1];
    updateRock(rock.id, { milestoneLabel: latest?.title ?? null });
  };

  const upsertMilestone = (milestone: RockMilestone) => {
    const exists = milestones.some((m) => m.id === milestone.id);
    const next = exists
      ? milestones.map((m) => (m.id === milestone.id ? milestone : m))
      : [...milestones, milestone];
    applyMilestones(next);
  };

  const unlinkItem = async (item: LinkedRockItem) => {
    if (!organizationId) return;
    if (item.entityType === 'todo') {
      await todosService.update(
        organizationId,
        item.id,
        { linkedEntityType: null, linkedEntityId: null, linkedEntityTitle: null },
        meetingId
      );
    } else {
      await issuesService.update(
        organizationId,
        item.id,
        { linkedEntityType: null, linkedEntityId: null, linkedEntityTitle: null },
        meetingId
      );
    }
    await loadLinkedItems();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-card border-l border-border shadow-xl z-50 flex flex-col h-full">
        <header className="flex items-center justify-between gap-2 p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ThumbsUp className="w-5 h-5 text-primary shrink-0" />
            <h2 className="text-lg font-semibold text-foreground truncate">Edit Waypoint</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" className="p-2 rounded-md hover:bg-muted text-muted-foreground" aria-label="More"><MoreHorizontal className="w-4 h-4" /></button>
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">{rock.ownerInitials}</div>
            <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-muted text-muted-foreground" aria-label="Close"><X className="w-5 h-5" /></button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-0">
          {/* Rock details block */}
          <section className="pb-10 border-b border-border">
            {rock.isCompanyRock && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-amber-500/50 bg-amber-500/5 mb-5">
                <Check className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-foreground">Company Rock</span>
              </div>
            )}
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={saveTitle}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Quarter</label>
                <Select options={[{ label: 'Q1 FY 2026', value: 'Q1 FY 2026' }]} className="w-full" value="Q1 FY 2026" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Due Date</label>
                <input
                  type="date"
                  value={(() => {
                    try {
                      const d = new Date(dueBy);
                      if (Number.isNaN(d.getTime())) return '';
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      return `${y}-${m}-${day}`;
                    } catch {
                      return '';
                    }
                  })()}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                      const formatted = new Date(v + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      setDueBy(formatted);
                      updateRock(rock.id, { dueBy: formatted });
                    }
                  }}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description (optional)</label>
                <RichTextEditor value={description} onChange={setDescription} placeholder="Description..." className="min-h-[80px]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Flight crew</label>
                  <Select
                    options={[{ label: teamName, value: 'team' }]}
                    className="w-full"
                    value="team"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Owner (optional)</label>
                  <Select
                    value={ownerUserId || undefined}
                    allowClear
                    placeholder="Assign from crew"
                    disabled={!organizationId || !teamId}
                    onChange={(v) => {
                      setOwnerUserId(v ?? '');
                      if (!v) {
                        updateRock(rock.id, {
                          ownerName: teamName,
                          ownerInitials: rockAssigneeInitials(teamName, '').slice(0, 2),
                        });
                        return;
                      }
                      const m = teamMembers.find((x) => (x.user?.id ?? x.userId) === v);
                      const u = m?.user;
                      if (u) {
                        updateRock(rock.id, {
                          ownerName: u.name || u.email || 'User',
                          ownerInitials: rockAssigneeInitials(u.name, u.email).slice(0, 2),
                        });
                      }
                    }}
                    options={teamMembers.map((m) => ({
                      label: m.user?.name || m.user?.email || m.userId,
                      value: m.user?.id ?? m.userId,
                    }))}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Assign to a member of this flight crew (optional).
                  </p>
                </div>
              </div>
            </div>
          </section>

          <hr className="border-border my-0" />

          {/* Milestones — title + button opens modal (no accordion) */}
          <section className="py-6 border-b border-border">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h4 className="font-medium text-foreground">Milestones {milestones.length}</h4>
              <button type="button" onClick={() => setAddMilestoneOpen(true)} className="px-3 py-1.5 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/10 transition-colors">
                Add Milestone
              </button>
            </div>
            <p className="text-sm text-muted-foreground">Make your Rock timely by breaking it down into achievable Milestones.</p>
            {milestones.length > 0 && (
              <div className="mt-3 space-y-2">
                {milestones.map((m) => (
                  <div key={m.id} className="rounded-md border border-border p-2 flex items-start justify-between gap-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(m.completed)}
                        onChange={(e) => {
                          const next = milestones.map((x) => (x.id === m.id ? { ...x, completed: e.target.checked } : x));
                          applyMilestones(next);
                        }}
                      />
                      <span className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{m.dueDate}</p>
                      </span>
                    </label>
                    <div className="shrink-0 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingMilestone(m)}
                        className="px-2 py-1 text-xs border border-border rounded hover:bg-muted"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMilestones(milestones.filter((x) => x.id !== m.id))}
                        className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Linked Items — title + button opens modal (no accordion) */}
          <section className="py-6 border-b border-border">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <Link2 className="w-4 h-4" /> Linked Items <span className="px-1.5 py-0.5 rounded bg-muted text-xs">{linkedItems.length}</span>
              </h4>
              <button
                type="button"
                onClick={() => setLinkedEditMode((v) => !v)}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                {linkedEditMode ? 'Done' : 'Edit'}
              </button>
            </div>
            <button type="button" onClick={() => setLinkExistingOpen(true)} className="text-primary hover:underline text-sm font-medium">
              + Linked Item
            </button>
            {linkedItems.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-semibold text-foreground">Linked Items</p>
                {linkedItems.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="rounded-xl border border-border px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.type}{item.subtitle ? ` - ${item.subtitle}` : ''}</p>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{rock.dueBy}</span>
                      <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">{rock.ownerInitials}</span>
                      {linkedEditMode && (
                        <button
                          type="button"
                          onClick={() => unlinkItem(item)}
                          className="text-xs uppercase tracking-wide text-red-500 hover:text-red-600"
                        >
                          Unlink
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Attachments — drag and drop */}
          <section className="py-6 border-b border-border">
            <h4 className="font-medium text-foreground mb-3">Attachments 0</h4>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground transition-colors ${attachDragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
              onDragOver={(e) => { e.preventDefault(); setAttachDragOver(true); }}
              onDragLeave={() => setAttachDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setAttachDragOver(false); /* TODO: upload files */ }}
            >
              Drag and drop files to attach, or <button type="button" className="text-primary hover:underline">browse</button>
            </div>
          </section>

          {/* Comments */}
          <section className="py-6">
            <h4 className="font-medium text-foreground mb-3">Comments 0</h4>
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground shrink-0">{rock.ownerInitials}</div>
              <input type="text" placeholder="Add a comment..." className="flex-1 min-w-0 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm" />
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-right">0/10000</p>
          </section>
        </div>
        <footer className="p-4 border-t border-border shrink-0 flex items-center justify-between text-xs text-muted-foreground">
          <span>Created by {rock.ownerName} on {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          <span className="flex items-center gap-1"><Check className="w-4 h-4" /> Following</span>
        </footer>
      </div>

      {addMilestoneOpen && (
        <AddMilestoneModal
          title="Add Milestone"
          onClose={() => setAddMilestoneOpen(false)}
          onAdd={(milestone) => {
            applyMilestones([...milestones, milestone]);
            setAddMilestoneOpen(false);
          }}
        />
      )}
      {editingMilestone && (
        <MilestoneDetailPanel
          rock={rock}
          milestone={editingMilestone}
          meetingId={meetingId}
          organizationId={organizationId}
          teamId={teamId}
          teamName={teamName}
          milestones={milestones}
          onOpenCreate={onOpenCreate}
          onClose={() => setEditingMilestone(null)}
          onSave={(milestone) => {
            upsertMilestone(milestone);
            setEditingMilestone(null);
          }}
        />
      )}
      {linkExistingOpen && (
        <LinkExistingModal
          rock={rock}
          meetingId={meetingId}
          organizationId={organizationId}
          teamId={teamId}
          teamName={teamName}
          milestones={milestones}
          onClose={() => setLinkExistingOpen(false)}
          onLink={() => {
            setLinkExistingOpen(false);
            loadLinkedItems();
          }}
        />
      )}
    </>
  );
}

function AddMilestoneModal({
  title: modalTitle,
  initialMilestone,
  onClose,
  onAdd,
}: {
  title?: string;
  initialMilestone?: RockMilestone;
  onClose: () => void;
  onAdd: (m: RockMilestone) => void;
}) {
  const [title, setTitle] = useState(initialMilestone?.title ?? '');
  const [date, setDate] = useState(() => {
    if (initialMilestone?.dueDate) {
      const d = new Date(initialMilestone.dueDate);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [description, setDescription] = useState(initialMilestone?.description ?? '');
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[60]" onClick={onClose} aria-hidden />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-full max-w-md bg-card border border-border rounded-lg shadow-xl p-5">
        <h3 className="text-lg font-semibold text-foreground mb-4">{modalTitle ?? 'Add a Milestone'}</h3>
        <div className="flex gap-2 mb-4">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground shrink-0">GS</div>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="flex-1 min-w-0 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm w-[140px]" />
        </div>
        <div className="mb-4">
          <RichTextEditor value={description} onChange={setDescription} placeholder="Description..." className="min-h-[60px]" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted">Cancel</button>
          <button
            type="button"
            onClick={() => {
              const t = title.trim();
              if (!t) return;
              onAdd({
                id: initialMilestone?.id ?? crypto.randomUUID(),
                title: t,
                dueDate: formatIsoDateToUs(date),
                description: description.trim() || undefined,
                completed: initialMilestone?.completed ?? false,
              });
            }}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
          >
            {initialMilestone ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </>
  );
}

function MilestoneDetailPanel({
  rock,
  milestone,
  meetingId,
  organizationId,
  teamId,
  teamName,
  milestones,
  onOpenCreate,
  onClose,
  onSave,
}: {
  rock: Rock;
  milestone: RockMilestone;
  meetingId?: string;
  organizationId?: string;
  teamId?: string | null;
  teamName: string;
  milestones: RockMilestone[];
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; linkedEntity?: LinkedEntityOption }) => void;
  onClose: () => void;
  onSave: (m: RockMilestone) => void;
}) {
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? '');
  const [completed, setCompleted] = useState(Boolean(milestone.completed));
  const [dueDateIso, setDueDateIso] = useState(() => {
    const d = new Date(milestone.dueDate);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  });
  const [linkExistingOpen, setLinkExistingOpen] = useState(false);
  const [linkedItems, setLinkedItems] = useState<LinkedRockItem[]>([]);
  const [linkedEditMode, setLinkedEditMode] = useState(false);

  useEffect(() => {
    setTitle(milestone.title);
    setDescription(milestone.description ?? '');
    setCompleted(Boolean(milestone.completed));
    const d = new Date(milestone.dueDate);
    setDueDateIso(Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10));
  }, [milestone]);

  const loadLinkedItems = useCallback(async () => {
    if (!organizationId || !teamId) {
      setLinkedItems([]);
      return;
    }
    try {
      const [todos, shortIssues, longIssues] = await Promise.all([
        todosService.findAll(organizationId, teamId, false, meetingId),
        issuesService.findAll(organizationId, teamId, 'short_term', false, meetingId),
        issuesService.findAll(organizationId, teamId, 'long_term', false, meetingId),
      ]);
      const linkedTodos = todos
        .filter((t) => t.linkedEntityType === 'rock_milestone' && t.linkedEntityId === milestone.id)
        .map((t) => ({ id: t.id, type: 'Clearance' as const, entityType: 'todo' as const, title: t.title, subtitle: t.status }));
      const linkedIssues = [...shortIssues, ...longIssues]
        .filter((i) => i.linkedEntityType === 'rock_milestone' && i.linkedEntityId === milestone.id)
        .map((i) => ({
          id: i.id,
          type: 'Turbulence' as const,
          entityType: 'issue' as const,
          title: i.title,
          subtitle: i.termType === 'long_term' ? 'Long-Term' : 'Short-Term',
        }));
      setLinkedItems([...linkedTodos, ...linkedIssues]);
    } catch {
      setLinkedItems([]);
    }
  }, [organizationId, teamId, meetingId, milestone.id]);

  useEffect(() => {
    loadLinkedItems();
  }, [loadLinkedItems]);

  const unlinkItem = async (item: LinkedRockItem) => {
    if (!organizationId) return;
    if (item.entityType === 'todo') {
      await todosService.update(
        organizationId,
        item.id,
        { linkedEntityType: null, linkedEntityId: null, linkedEntityTitle: null },
        meetingId
      );
    } else {
      await issuesService.update(
        organizationId,
        item.id,
        { linkedEntityType: null, linkedEntityId: null, linkedEntityTitle: null },
        meetingId
      );
    }
    await loadLinkedItems();
  };

  const handleSave = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave({
      ...milestone,
      title: trimmed,
      description: description.trim() || undefined,
      completed,
      dueDate: dueDateIso ? formatIsoDateToUs(dueDateIso) : milestone.dueDate,
    });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[70]" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-card border-l border-border shadow-xl z-[71] flex flex-col h-full">
        <header className="flex items-center justify-between gap-2 p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} className="shrink-0" aria-label="Mark milestone complete" />
            <h2 className="text-2xl font-semibold text-foreground truncate">Edit Milestone</h2>
            <Mountain className="w-5 h-5 text-muted-foreground shrink-0" />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" className="p-2 rounded-md hover:bg-muted text-muted-foreground" aria-label="More"><MoreHorizontal className="w-4 h-4" /></button>
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">{rock.ownerInitials}</div>
            <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-muted text-muted-foreground" aria-label="Close"><X className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-0">
          <section className="pb-8 border-b border-border">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDateIso}
                  onChange={(e) => setDueDateIso(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description (optional)</label>
                <RichTextEditor value={description} onChange={setDescription} placeholder="Description..." className="min-h-[80px]" />
              </div>
            </div>
          </section>

          <section className="py-6 border-b border-border">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h4 className="font-medium text-foreground flex items-center gap-2"><Link2 className="w-4 h-4" /> Linked Items <span className="px-1.5 py-0.5 rounded bg-muted text-xs">{linkedItems.length}</span></h4>
              <button
                type="button"
                onClick={() => setLinkedEditMode((v) => !v)}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                {linkedEditMode ? 'Done' : 'Edit'}
              </button>
            </div>
            <button type="button" onClick={() => setLinkExistingOpen(true)} className="text-primary hover:underline text-sm font-medium">
              + Linked Item
            </button>
            {linkedItems.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-semibold text-foreground">Linked Items</p>
                {linkedItems.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="rounded-xl border border-border px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.type}{item.subtitle ? ` - ${item.subtitle}` : ''}</p>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{milestone.dueDate}</span>
                      <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">{rock.ownerInitials}</span>
                      {linkedEditMode && (
                        <button
                          type="button"
                          onClick={() => unlinkItem(item)}
                          className="text-xs uppercase tracking-wide text-red-500 hover:text-red-600"
                        >
                          Unlink
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="py-6 border-b border-border">
            <h4 className="font-medium text-foreground mb-3">Attachments <span className="px-1.5 py-0.5 rounded bg-muted text-xs">0</span></h4>
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground border-border">
              Drag and drop files to attach, or <button type="button" className="text-primary hover:underline">browse</button>
            </div>
          </section>

          <section className="py-6">
            <h4 className="font-medium text-foreground mb-3">Comments <span className="px-1.5 py-0.5 rounded bg-muted text-xs">0</span></h4>
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground shrink-0">{rock.ownerInitials}</div>
              <input type="text" placeholder="Add a comment..." className="flex-1 min-w-0 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm" />
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-right">0/10000</p>
          </section>
        </div>

        <footer className="p-4 border-t border-border shrink-0 flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Check className="w-4 h-4" /> Following</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted">Cancel</button>
            <button type="button" onClick={handleSave} className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">Save</button>
          </div>
        </footer>
      </div>
      {linkExistingOpen && (
        <LinkExistingModal
          rock={rock}
          meetingId={meetingId}
          organizationId={organizationId}
          teamId={teamId}
          teamName={teamName}
          milestones={milestones}
          linkTarget={{ id: milestone.id, type: 'rock_milestone', title: milestone.title }}
          onClose={() => setLinkExistingOpen(false)}
          onLink={() => {
            setLinkExistingOpen(false);
            loadLinkedItems();
          }}
        />
      )}
    </>
  );
}

function LinkExistingModal({
  rock,
  meetingId,
  organizationId,
  teamId,
  teamName,
  milestones,
  linkTarget,
  onClose,
  onLink,
}: {
  rock: Rock;
  meetingId?: string;
  organizationId?: string;
  teamId?: string | null;
  teamName: string;
  milestones: Array<{ id: string; title: string; dueDate: string; description?: string }>;
  linkTarget?: LinkedEntityOption;
  onClose: () => void;
  onLink: () => void;
}) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'Waypoint' | 'Milestone' | 'Clearance' | 'Turbulence'>('Waypoint');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<{ id: string; title: string; subtitle?: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { updateRock, rocks } = useRocks();
  const issuesApi = useIssuesOptional();
  const todosApi = useTodosOptional();
  const target = linkTarget ?? { id: rock.id, type: 'rock' as const, title: rock.title };

  useEffect(() => {
    let active = true;
    const run = async () => {
      setSelectedIds(new Set());
      const q = search.trim().toLowerCase();
      if (tab === 'Waypoint') {
        const rows = rocks
          .filter((r) => r.id !== rock.id)
          .filter((r) => !q || r.title.toLowerCase().includes(q))
          .map((r) => ({ id: r.id, title: r.title, subtitle: r.ownerName }));
        setItems(rows);
        return;
      }
      if (tab === 'Milestone') {
        const rows = milestones
          .filter((m) => !q || m.title.toLowerCase().includes(q))
          .map((m) => ({ id: m.id, title: m.title, subtitle: m.dueDate }));
        setItems(rows);
        return;
      }
      if (!organizationId || !teamId) {
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        if (tab === 'Turbulence') {
          const [short, long] = await Promise.all([
            issuesService.findAll(organizationId, teamId, 'short_term', false, meetingId),
            issuesService.findAll(organizationId, teamId, 'long_term', false, meetingId),
          ]);
          const rows = [...short, ...long]
            .filter((i) => !q || i.title.toLowerCase().includes(q))
            .map((i) => ({ id: i.id, title: i.title, subtitle: i.termType === 'long_term' ? 'Long-Term' : 'Short-Term' }));
          if (active) setItems(rows);
        } else {
          const list = await todosService.findAll(organizationId, teamId, false, meetingId);
          const rows = list
            .filter((t) => !q || t.title.toLowerCase().includes(q))
            .map((t) => ({ id: t.id, title: t.title, subtitle: t.status }));
          if (active) setItems(rows);
        }
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [tab, search, rock.id, rocks, milestones, organizationId, teamId, meetingId]);

  const handleLink = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (tab === 'Milestone') {
      const selected = milestones.find((m) => m.id === ids[0]);
      if (selected) updateRock(rock.id, { milestoneLabel: selected.title });
      onLink();
      return;
    }
    if (tab === 'Turbulence' && issuesApi) {
      await Promise.all(
        ids.map(async (id) => {
          await issuesApi.updateIssue(id, {
            linkedEntityType: target.type,
            linkedEntityId: target.id,
            linkedEntityTitle: target.title,
          });
        })
      );
      onLink();
      return;
    }
    if (tab === 'Turbulence' && organizationId) {
      await Promise.all(
        ids.map(async (id) => {
          await issuesService.update(
            organizationId,
            id,
            {
              linkedEntityType: target.type,
              linkedEntityId: target.id,
              linkedEntityTitle: target.title,
            },
            meetingId
          );
        })
      );
      onLink();
      return;
    }
    if (tab === 'Clearance' && todosApi) {
      await Promise.all(
        ids.map(async (id) => {
          await todosApi.updateTodo(id, {
            linkedEntityType: target.type,
            linkedEntityId: target.id,
            linkedEntityTitle: target.title,
          });
        })
      );
      onLink();
      return;
    }
    if (tab === 'Clearance' && organizationId) {
      await Promise.all(
        ids.map(async (id) => {
          await todosService.update(
            organizationId,
            id,
            {
              linkedEntityType: target.type,
              linkedEntityId: target.id,
              linkedEntityTitle: target.title,
            },
            meetingId
          );
        })
      );
      onLink();
      return;
    }
    if (tab === 'Waypoint') {
      onLink();
      return;
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[90]" onClick={onClose} aria-hidden />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[91] w-full max-w-lg bg-card border border-border rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="h-1 bg-primary shrink-0" />
        <header className="p-4 border-b border-border shrink-0 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Link to Existing Items</h3>
            <p className="text-sm text-muted-foreground">Link to Waypoints: {rock.title}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded hover:bg-muted" aria-label="Close"><X className="w-5 h-5" /></button>
        </header>
        <div className="p-4 border-b border-border shrink-0">
          <Input.Search placeholder="Search items on your team" value={search} onChange={(e) => setSearch(e.target.value)} allowClear className="w-full" />
          <p className="text-sm font-medium text-foreground mt-2">Items in {teamName}</p>
        </div>
        <div className="flex border-b border-border shrink-0">
          {(['Waypoint', 'Milestone', 'Clearance', 'Turbulence'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>{t}</button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center text-muted-foreground text-sm py-8">Loading…</div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center text-muted-foreground text-sm py-8">
              There are no {tab === 'Waypoint' ? 'Waypoints' : tab === 'Milestone' ? 'Milestones' : tab === 'Clearance' ? 'Clearances' : 'Turbulence'} found with your flight crew {teamName}.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => {
                const checked = selectedIds.has(item.id);
                return (
                  <label key={item.id} className="flex items-start gap-2 rounded-md border border-border p-2 cursor-pointer hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        });
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-foreground truncate">{item.title}</span>
                      {item.subtitle && <span className="block text-xs text-muted-foreground">{item.subtitle}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <footer className="p-4 border-t border-border shrink-0 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{selectedIds.size} item</span>
          <button
            type="button"
            onClick={handleLink}
            disabled={selectedIds.size === 0}
            className={`px-3 py-2 rounded-md text-sm font-medium ${selectedIds.size === 0 ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
          >
            Link items to Waypoints
          </button>
        </footer>
      </div>
    </>
  );
}

function RockRow({
  rock,
  milestones = [],
  onUpdateMilestones,
  showMilestone,
  showOwnerColumn = !showMilestone,
  onOpenCreate,
  meetingId,
  organizationId,
  teamId,
  teamName,
  isArchiveView,
  onUnarchive,
  onOpenDetail,
  onOpenDatePicker,
  hideAccordion,
}: {
  rock: Rock;
  milestones?: RockMilestone[];
  onUpdateMilestones?: (rockId: string, next: RockMilestone[]) => void;
  showMilestone?: boolean;
  showOwnerColumn?: boolean;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; linkedEntity?: LinkedEntityOption }) => void;
  meetingId?: string;
  organizationId?: string;
  teamId?: string | null;
  teamName?: string;
  isArchiveView?: boolean;
  onUnarchive?: (id: string) => void;
  onOpenDetail?: (rock: Rock) => void;
  onOpenDatePicker?: (rock: Rock) => void;
  /** Company rocks: no expand arrow / accordion */
  hideAccordion?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(rock.title);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { archiveRock, deleteRock, updateRock } = useRocks();
  const [milestoneMenuAnchor, setMilestoneMenuAnchor] = useState<{ milestone: RockMilestone; rect: DOMRect } | null>(null);
  const [editingMilestoneTitleId, setEditingMilestoneTitleId] = useState<string | null>(null);
  const [milestoneTitleDraft, setMilestoneTitleDraft] = useState('');
  const milestoneTitleInputRef = useRef<HTMLInputElement>(null);

  const [editingMilestoneDateId, setEditingMilestoneDateId] = useState<string | null>(null);
  const [milestoneDateDraft, setMilestoneDateDraft] = useState('');
  const [editingMilestoneModal, setEditingMilestoneModal] = useState<RockMilestone | null>(null);

  useEffect(() => {
    setTitleInput(rock.title);
  }, [rock.title]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) titleInputRef.current.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (editingMilestoneTitleId && milestoneTitleInputRef.current) milestoneTitleInputRef.current.focus();
  }, [editingMilestoneTitleId]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = menuButtonRef.current;
    if (el) {
      setAnchorRect(el.getBoundingClientRect());
      setMenuOpen(true);
    }
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setAnchorRect(null);
  };

  const saveTitle = () => {
    const t = titleInput.trim();
    if (t && t !== rock.title) updateRock(rock.id, { title: t });
    setEditingTitle(false);
  };

  const upsertMilestone = (milestoneId: string, patch: Partial<RockMilestone>) => {
    const next = milestones.map((m) => (m.id === milestoneId ? { ...m, ...patch } : m));
    onUpdateMilestones?.(rock.id, next);
  };

  const saveMilestoneTitle = (milestoneId: string) => {
    const t = milestoneTitleDraft.trim();
    if (!t) {
      setEditingMilestoneTitleId(null);
      setMilestoneTitleDraft('');
      return;
    }
    upsertMilestone(milestoneId, { title: t });
    setEditingMilestoneTitleId(null);
    setMilestoneTitleDraft('');
  };

  const dueDateToInputValue = (dueDate: string) => {
    const d = new Date(dueDate);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  const inputValueToDueDate = (originalDueDate: string, inputIso: string) => {
    // Keep existing format if it looks like an ISO date.
    if (/^\d{4}-\d{2}-\d{2}$/.test(originalDueDate)) return inputIso;
    return formatIsoDateToUs(inputIso);
  };

  const saveMilestoneDueDate = (milestoneId: string, originalDueDate: string) => {
    if (!milestoneDateDraft) return;
    const nextDueDate = inputValueToDueDate(originalDueDate, milestoneDateDraft);
    upsertMilestone(milestoneId, { dueDate: nextDueDate });
    setEditingMilestoneDateId(null);
    setMilestoneDateDraft('');
  };

  const handleRowClick = () => {
    if (editingTitle) return;
    onOpenDetail?.(rock);
  };
  const completedMilestones = milestones.filter((m) => m.completed).length;
  const milestoneTotal = milestones.length;
  const milestonePercent = milestoneTotal > 0 ? Math.round((completedMilestones / milestoneTotal) * 100) : 0;

  return (
    <>
      <tr
        className="group border-b border-border hover:bg-muted/10 transition-colors cursor-pointer"
        onClick={handleRowClick}
      >
        {/* 6-dot drag handle — visible on row hover */}
        <td className="px-2 py-3 w-10 align-middle opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <span className="inline-flex cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground" aria-label="Drag to reorder">
            <GripVertical className="w-4 h-4" />
          </span>
        </td>
        {!hideAccordion && (
          <td className="px-4 py-3 w-10 align-middle" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="p-1 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </td>
        )}
        <td className="px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
          <RockStatusDropdown rock={rock} onStatusChange={(status) => updateRock(rock.id, { status })} />
        </td>
        <td className="px-4 py-3 font-medium text-foreground align-middle" onClick={(e) => e.stopPropagation()}>
          {editingTitle ? (
            <div className="flex items-center gap-1">
              <input
                ref={titleInputRef}
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleInput(rock.title); setEditingTitle(false); } }}
                className="flex-1 min-w-0 px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
              />
              <button type="button" onClick={() => { setTitleInput(rock.title); setEditingTitle(false); }} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Cancel"><X className="w-4 h-4" /></button>
              <button type="button" onClick={saveTitle} className="p-1 rounded hover:bg-muted text-primary" aria-label="Save"><Check className="w-4 h-4" /></button>
            </div>
          ) : (
            <span
              className="block min-w-0 truncate"
              onClick={(e) => { e.stopPropagation(); setEditingTitle(true); }}
            >
              {rock.title}
            </span>
          )}
        </td>
        <td className="px-4 py-3 align-middle">
          {showMilestone && milestoneTotal > 0 ? (
            <div className="flex items-center gap-3 min-w-[200px]">
              {/* Track uses theme tokens that exist in globals.css (accent/border). bg-muted is not defined there, so the bar looked like empty whitespace. */}
              <div
                className="h-2.5 min-w-[80px] flex-1 rounded-full border border-border bg-accent overflow-hidden"
                role="progressbar"
                aria-valuenow={milestonePercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Milestones completed: ${completedMilestones} of ${milestoneTotal}`}
              >
                <div
                  className="h-full min-w-0 rounded-full bg-primary transition-[width] duration-300 ease-out"
                  style={{ width: `${milestonePercent}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">{completedMilestones}/{milestoneTotal}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        {showOwnerColumn && (
          <td className="px-4 py-3 align-middle">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
              {rock.ownerInitials}
            </div>
          </td>
        )}
        <td className="px-4 py-3 text-muted-foreground align-middle" onClick={(e) => e.stopPropagation()}>
          <span className="inline-flex items-center gap-1">
            {rock.dueBy}
            {onOpenDatePicker && (
              <button
                type="button"
                onClick={() => onOpenDatePicker(rock)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Change date"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </span>
        </td>
        <td className="px-4 py-3 w-12 align-middle text-right" onClick={(e) => e.stopPropagation()}>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={openMenu}
            className="p-2 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="More actions"
            title="More actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && anchorRect && typeof document !== 'undefined' && (
            <RockActionsMenu
              anchorRect={anchorRect}
              onClose={closeMenu}
              rock={rock}
              onArchive={archiveRock}
              onUnarchive={isArchiveView ? onUnarchive : undefined}
              onDelete={deleteRock}
              onOpenCreate={onOpenCreate}
              meetingId={meetingId}
              isArchiveView={isArchiveView}
            />
          )}
        </td>
      </tr>
      {!hideAccordion && expanded && (
        <>
          {milestones.map((m) => {
            const isTitleEditing = editingMilestoneTitleId === m.id;
            const isDateEditing = editingMilestoneDateId === m.id;
            const openMilestoneEdit = () => {
              setEditingMilestoneModal(m);
            };
            return (
              <tr
                key={m.id}
                className="border-b border-border hover:bg-muted/5 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isTitleEditing && !isDateEditing) openMilestoneEdit();
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  openMilestoneEdit();
                }}
              >
                {/* Drag handle spacer (milestones aren't draggable) */}
                <td className="px-2 py-3 w-10 align-middle opacity-60" />
                {/* Accordion spacer */}
                <td className="px-4 py-3 w-10 align-middle" />

                {/* "Status" column becomes milestone name + completion toggle */}
                <td className="px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                  {isTitleEditing ? (
                    <div className="flex items-center gap-1 min-w-0">
                      <input
                        ref={milestoneTitleInputRef}
                        type="text"
                        value={milestoneTitleDraft}
                        onChange={(e) => setMilestoneTitleDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveMilestoneTitle(m.id);
                          if (e.key === 'Escape') {
                            setEditingMilestoneTitleId(null);
                            setMilestoneTitleDraft('');
                          }
                        }}
                        className="flex-1 min-w-0 px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMilestoneTitleId(null);
                          setMilestoneTitleDraft('');
                        }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                        aria-label="Cancel milestone title edit"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => saveMilestoneTitle(m.id)}
                        className="p-1 rounded hover:bg-muted text-primary"
                        aria-label="Save milestone title"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={Boolean(m.completed)}
                        onChange={(e) => upsertMilestone(m.id, { completed: e.target.checked })}
                        aria-label="Mark milestone complete"
                      />
                      <span
                        className={`block min-w-0 truncate cursor-text ${m.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                        title={m.title}
                        onClick={() => {
                          setEditingMilestoneTitleId(m.id);
                          setMilestoneTitleDraft(m.title);
                        }}
                      >
                        {m.title}
                      </span>
                    </div>
                  )}
                </td>

                {/* Title column (kept empty so columns align) */}
                <td className="px-4 py-3 align-middle" />

                {/* Milestone progress column */}
                <td className="px-4 py-3 align-middle" />

                {showOwnerColumn && (
                  <td className="px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
                      {rock.ownerInitials}
                    </div>
                  </td>
                )}

                {/* Due by column */}
                <td className="px-4 py-3 text-muted-foreground align-middle" onClick={(e) => e.stopPropagation()}>
                  {isDateEditing ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="date"
                        value={milestoneDateDraft}
                        onChange={(e) => setMilestoneDateDraft(e.target.value)}
                        className="px-2 py-1 border border-border rounded bg-background text-foreground text-sm w-[160px]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMilestoneDateId(null);
                          setMilestoneDateDraft('');
                        }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                        aria-label="Cancel milestone due date edit"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => saveMilestoneDueDate(m.id, m.dueDate)}
                        className="p-1 rounded hover:bg-muted text-primary"
                        aria-label="Save milestone due date"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="whitespace-nowrap">{m.dueDate}</span>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        aria-label="Edit milestone due date"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingMilestoneDateId(m.id);
                          setMilestoneDateDraft(dueDateToInputValue(m.dueDate));
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}
                </td>

                {/* Actions column */}
                <td className="px-4 py-3 w-12 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="p-2 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Milestone actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      const el = e.currentTarget as HTMLButtonElement;
                      setMilestoneMenuAnchor({ milestone: m, rect: el.getBoundingClientRect() });
                    }}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
          <tr className="border-b border-border bg-muted/5">
            <td colSpan={showOwnerColumn ? 8 : 7} className="px-4 py-2 pl-12">
              <button
                type="button"
                className="text-primary hover:underline text-sm font-medium flex items-center gap-1.5 py-1 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail?.(rock);
                }}
              >
                + Add Milestone
              </button>
            </td>
          </tr>
        </>
      )}
      {milestoneMenuAnchor && typeof document !== 'undefined' &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMilestoneMenuAnchor(null)} aria-hidden />
            {(() => {
              const menuWidth = 220;
              const menuHeight = 170;
              const viewportWidth = window.innerWidth;
              const viewportHeight = window.innerHeight;
              const left = Math.min(
                Math.max(8, milestoneMenuAnchor.rect.right - menuWidth),
                Math.max(8, viewportWidth - menuWidth - 8),
              );
              const top = milestoneMenuAnchor.rect.bottom + menuHeight + 8 > viewportHeight
                ? Math.max(8, milestoneMenuAnchor.rect.top - menuHeight - 6)
                : milestoneMenuAnchor.rect.bottom + 6;
              return (
                <div
                  className="fixed z-50 py-2 bg-card border border-border rounded-lg shadow-xl min-w-[220px]"
                  style={{ top, left }}
                >
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                    onClick={() => {
                      setEditingMilestoneModal(milestoneMenuAnchor.milestone);
                      setMilestoneMenuAnchor(null);
                    }}
                  >
                    Edit milestone
                  </button>
                  <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent" onClick={() => { onOpenCreate?.('rock', { title: milestoneMenuAnchor.milestone.title, description: `Linked to milestone: ${milestoneMenuAnchor.milestone.title}` }); setMilestoneMenuAnchor(null); }}>
                    Create linked Waypoint
                  </button>
                  <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent" onClick={() => { onOpenCreate?.('todo', { title: `Clearance: ${milestoneMenuAnchor.milestone.title}`, description: `Linked to milestone: ${milestoneMenuAnchor.milestone.title}`, linkedEntity: { type: 'rock_milestone', id: milestoneMenuAnchor.milestone.id, title: milestoneMenuAnchor.milestone.title } }); setMilestoneMenuAnchor(null); }}>
                    Create linked Clearance
                  </button>
                  <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent" onClick={() => { onOpenCreate?.('issue', { title: `Turbulence: ${milestoneMenuAnchor.milestone.title}`, description: `Linked to milestone: ${milestoneMenuAnchor.milestone.title}`, linkedEntity: { type: 'rock_milestone', id: milestoneMenuAnchor.milestone.id, title: milestoneMenuAnchor.milestone.title } }); setMilestoneMenuAnchor(null); }}>
                    Create linked Turbulence
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    onClick={() => {
                      onUpdateMilestones?.(rock.id, milestones.filter((x) => x.id !== milestoneMenuAnchor.milestone.id));
                      setMilestoneMenuAnchor(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              );
            })()}
          </>,
          document.body
        )}
      {editingMilestoneModal && (
        <MilestoneDetailPanel
          rock={rock}
          milestone={editingMilestoneModal}
          meetingId={meetingId}
          organizationId={organizationId}
          teamId={teamId}
          teamName={teamName ?? rock.ownerName}
          milestones={milestones}
          onOpenCreate={onOpenCreate}
          onClose={() => setEditingMilestoneModal(null)}
          onSave={(milestone) => {
            upsertMilestone(milestone.id, {
              title: milestone.title,
              dueDate: milestone.dueDate,
              description: milestone.description,
              completed: milestone.completed,
            });
            setEditingMilestoneModal(null);
          }}
        />
      )}
    </>
  );
}

function PlanningBoard({
  columnOrder,
  getRocksByColumn,
}: {
  columnOrder: RockColumnId[];
  getRocksByColumn: (col: RockColumnId) => Rock[];
}) {
  return (
    <div className="flex gap-6 overflow-x-auto pb-4 min-h-[620px]">
      {columnOrder.map((colId) => (
        <BoardColumn
          key={colId}
          columnId={colId}
          title={COLUMN_LABELS[colId]}
          rocks={getRocksByColumn(colId)}
        />
      ))}
    </div>
  );
}

function BoardColumn({
  columnId,
  title,
  rocks,
}: {
  columnId: RockColumnId;
  title: string;
  rocks: Rock[];
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `column-${columnId}` });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-80 min-h-[560px] flex flex-col gap-3 ${
        isOver ? 'bg-primary/5' : ''
      }`}
    >
      {/* Column header (tab) — box with grey bg for Current / Next / Later etc. */}
      <div className="rounded-lg border border-border bg-muted/40 flex items-center justify-between gap-2 px-3 py-2.5 shrink-0 min-h-[40px]">
        <span className="font-medium text-foreground text-base">
          {title} <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md bg-muted/80 text-muted-foreground text-sm font-medium">{rocks.length}</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="w-8 h-8 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Add"
          >
            +
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Sort"
          >
            ↕
          </button>
          {columnId === 'long_term' && (
            <button
              type="button"
              className="w-8 h-8 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Filter"
            >
              <Filter className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
        {rocks.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/20 border-dashed p-4 text-center min-h-[72px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No {title} items
            </p>
          </div>
        ) : (
          rocks.map((rock) => (
            <DraggableRockCard key={rock.id} rock={rock} />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableRockCard({ rock }: { rock: Rock }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: rock.id });
  const { setNodeRef: setDropRef } = useDroppable({ id: rock.id });

  const setRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    setDropRef(node);
  };

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setRef}
      style={style}
      className={`bg-card border border-border rounded-lg p-3 shadow-sm ${
        isDragging ? 'opacity-50 shadow-md' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={statusBadgeClass(rock.status)}>
          {rock.status === 'on_track' && <ThumbsUp className="w-3 h-3" />}
          {STATUS_LABEL[rock.status]}
        </span>
        <span className="text-xs text-muted-foreground">{rock.dueBy}</span>
      </div>
      <div
        {...listeners}
        {...attributes}
        className="font-medium text-foreground cursor-grab active:cursor-grabbing mb-2"
      >
        {rock.title}
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-xs text-primary border border-border rounded-md px-2 py-1.5 hover:bg-muted/50 flex items-center gap-1.5 transition-colors"
        >
          <Link2 className="w-3 h-3" /> Link Goal
        </button>
        <div className="w-7 h-7 rounded-full border border-border bg-muted flex items-center justify-center text-xs font-medium text-foreground">
          {rock.ownerInitials}
        </div>
      </div>
    </div>
  );
}

function ArchiveTabContent({
  rocks,
  milestonesByRock,
  onOpenCreate,
  meetingId,
  organizationId,
  teamId,
  teamName,
  onUnarchive,
  onOpenDetail,
  onOpenDatePicker,
}: {
  rocks: Rock[];
  milestonesByRock: Record<string, RockMilestone[]>;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; linkedEntity?: LinkedEntityOption }) => void;
  meetingId?: string;
  organizationId?: string;
  teamId?: string | null;
  teamName: string;
  onUnarchive: (id: string) => void;
  onOpenDetail?: (rock: Rock) => void;
  onOpenDatePicker?: (rock: Rock) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/20">
          <ArchiveIcon className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Archive {rocks.length}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-medium text-foreground px-2 py-2 w-10" aria-label="Drag" />
                <th className="text-left font-medium text-foreground px-4 py-2 w-8" />
                <th className="text-left font-medium text-foreground px-4 py-2">
                  Status
                </th>
                <th className="text-left font-medium text-foreground px-4 py-2">
                  Title
                </th>
                <th className="text-left font-medium text-foreground px-4 py-2">
                  Milestone progress
                </th>
                <th className="text-left font-medium text-foreground px-4 py-2">
                  Owner
                </th>
                <th className="text-left font-medium text-foreground px-4 py-2">
                  Due by
                </th>
                <th className="text-right font-medium text-foreground px-4 py-2 w-14">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rocks.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No achieved rocks in archive
                  </td>
                </tr>
              ) : (
                rocks.map((rock) => (
                  <RockRow
                    key={rock.id}
                    rock={rock}
                    milestones={milestonesByRock[rock.id] ?? []}
                    onUpdateMilestones={() => {}}
                    showMilestone
                    showOwnerColumn
                    onOpenCreate={onOpenCreate}
                    meetingId={meetingId}
                    organizationId={organizationId}
                    teamId={teamId}
                    teamName={teamName}
                    isArchiveView
                    onUnarchive={onUnarchive}
                    onOpenDetail={onOpenDetail}
                    onOpenDatePicker={onOpenDatePicker}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
