'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
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
import { FLIGHT_TERMS } from '@/lib/constants/flightTerminology';
import { ContentAreaLoader } from '@/components/ui/loaders';
import { RichTextEditor } from './RichTextEditor';

const COLUMN_LABELS: Record<RockColumnId, string> = {
  current: 'Current',
  next: 'Next',
  later: 'Later',
  future: 'Future',
  long_term: 'Long-Term Turbulence (Issues)',
};

const STATUS_LABEL: Record<Rock['status'], string> = {
  on_track: 'On track',
  off_track: 'Off track',
  at_risk: 'At risk',
  done: 'Done',
};

function statusBadgeClass(status: Rock['status']): string {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium';
  switch (status) {
    case 'on_track':
      return `${base} bg-primary/15 text-primary`;
    case 'off_track':
      return `${base} bg-destructive/15 text-destructive`;
    case 'at_risk':
      return `${base} bg-amber-500/15 text-amber-600 dark:text-amber-400`;
    case 'done':
      return `${base} bg-muted text-muted-foreground`;
    default:
      return `${base} bg-muted text-muted-foreground`;
  }
}

/** Estimated width of the rock actions dropdown so we can keep it on-screen */
const ROCK_ACTIONS_MENU_WIDTH = 248;
const ROCK_ACTIONS_MENU_GAP = 8;

type CreatePopupType = 'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message';

interface RocksSegmentViewProps {
  sectionTitle?: string;
  embedded?: boolean;
  meetingId?: string;
  isFacilitator?: boolean;
  /** Scribe or facilitator can change filters and create (recording) */
  canRecord?: boolean;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; linkedEntity?: { type: 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message'; id: string; title: string } }) => void;
}

export function RocksSegmentView({
  sectionTitle = 'Waypoint Review (Rocks)',
  embedded = false,
  meetingId,
  isFacilitator = true,
  canRecord,
  onOpenCreate,
}: RocksSegmentViewProps) {
  const canUseFilters = canRecord ?? isFacilitator;
  const [teamFilter, setTeamFilter] = useState('Leadership Team');
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'rocks' | 'planning' | 'archive'>(
    'rocks'
  );
  const [vtoExpanded, setVtoExpanded] = useState(true);
  const [selectedRockId, setSelectedRockId] = useState<string | null>(null);
  const [datePickerRockId, setDatePickerRockId] = useState<string | null>(null);
  const { socket } = useMeetingSocket();

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
          <span className="text-muted-foreground text-sm">Team:</span>
          <Select
            value={teamFilter}
            onChange={(v) => {
              if (!canUseFilters) return;
              setTeamFilter(v);
              if (meetingId && socket) socket.emit('rocks_filter', { meetingId, teamFilter: v });
            }}
            disabled={!canUseFilters}
            options={[{ label: 'Leadership Team', value: 'Leadership Team' }]}
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
            vtoExpanded={vtoExpanded}
            onVtoToggle={() => setVtoExpanded((e) => !e)}
            onOpenCreate={onOpenCreate}
            meetingId={meetingId}
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
            onOpenCreate={onOpenCreate}
            meetingId={meetingId}
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
  vtoExpanded,
  onVtoToggle,
  onAddRock,
  onOpenCreate,
  meetingId,
  onOpenDetail,
  onOpenDatePicker,
}: {
  companyRocks: Rock[];
  rocksByOwner: { ownerName: string; rocks: Rock[] }[];
  vtoExpanded: boolean;
  onVtoToggle: () => void;
  onAddRock: () => void;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string }) => void;
  meetingId?: string;
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
                  <RockRow key={rock.id} rock={rock} onOpenCreate={onOpenCreate} meetingId={meetingId} onOpenDetail={onOpenDetail} onOpenDatePicker={onOpenDatePicker} hideAccordion />
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
                    <RockRow key={rock.id} rock={rock} showMilestone onOpenCreate={onOpenCreate} meetingId={meetingId} onOpenDetail={onOpenDetail} onOpenDatePicker={onOpenDatePicker} />
                  ))}
                  <tr>
                    <td colSpan={7} className="px-4 py-3">
                      <button
                        type="button"
                        onClick={onAddRock}
                        className="text-primary hover:underline text-sm font-medium flex items-center gap-1"
                      >
                        + Add Rock
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
              + Add Rock
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
 * Dropdown menu for a single rock's actions (Create linked Waypoint (Rock)/To-Do/Issue/Headline, Archive, Print, Copy Link, Delete).
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
  isArchiveView,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  rock: Rock;
  onArchive: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; linkedEntity?: { type: 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message'; id: string; title: string } }) => void;
  meetingId?: string;
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
            Create linked Waypoint (Rock)
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => { onOpenCreate?.('todo', { title: `To-Do: ${rock.title}`, description: linkedDescription(rock), linkedEntity: linkedRock }); onClose(); }}
            role="menuitem"
          >
            <CheckSquare className={iconClass} />
            Create linked To-Do
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => { onOpenCreate?.('issue', { title: `Issue: ${rock.title}`, description: linkedDescription(rock), linkedEntity: linkedRock }); onClose(); }}
            role="menuitem"
          >
            <AlertCircle className={iconClass} />
            Create linked Issue
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

function RockDetailPanel({
  rock,
  onClose,
  onOpenCreate,
}: {
  rock: Rock;
  onClose: () => void;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string }) => void;
}) {
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [linkExistingOpen, setLinkExistingOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [attachDragOver, setAttachDragOver] = useState(false);
  const [title, setTitle] = useState(rock.title);
  const [dueBy, setDueBy] = useState(rock.dueBy);
  const { updateRock } = useRocks();

  // V/TO section: edit mode and fields
  const [vtoEditMode, setVtoEditMode] = useState(false);
  const [vto90Days, setVto90Days] = useState('90 Days');
  const [vtoFutureDate, setVtoFutureDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  });
  type VtoRow = { id: string; description: string; value: string };
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

  const handleVtoSave = () => {
    setVtoEditMode(false);
    // Persist could go here when API exists
  };

  useEffect(() => {
    setTitle(rock.title);
    setDueBy(rock.dueBy);
  }, [rock.id, rock.title, rock.dueBy]);

  const saveTitle = () => {
    const t = title.trim();
    if (t && t !== rock.title) updateRock(rock.id, { title: t });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-card border-l border-border shadow-xl z-50 flex flex-col h-full">
        <header className="flex items-center justify-between gap-2 p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ThumbsUp className="w-5 h-5 text-primary shrink-0" />
            <h2 className="text-lg font-semibold text-foreground truncate">Edit Waypoint (Rock)</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" className="p-2 rounded-md hover:bg-muted text-muted-foreground" aria-label="More"><MoreHorizontal className="w-4 h-4" /></button>
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">{rock.ownerInitials}</div>
            <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-muted text-muted-foreground" aria-label="Close"><X className="w-5 h-5" /></button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-[4.5rem] py-6 space-y-0">
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
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Team</label>
                <Select options={[{ label: 'Leadership Team', value: 'leadership' }]} className="w-full" value="leadership" />
              </div>
            </div>
          </section>

          {/* V/TO® | Revenue, Profit, Measurables — clearly separated sections with spacer and border */}
          <section className="py-6 border-b border-border">
            <div className="flex items-center justify-between gap-2 mb-5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <span className="text-amber-600 dark:text-amber-400 font-semibold text-sm">V</span>
                </div>
                <h4 className="font-semibold text-foreground truncate">V/TO® | Revenue, Profit, Measurables</h4>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {vtoEditMode ? (
                  <button type="button" onClick={handleVtoSave} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Save"><Check className="w-4 h-4" /></button>
                ) : (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setVtoEditMode(true); }} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
                )}
                <button type="button" className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" aria-label="Collapse"><ChevronUp className="w-4 h-4" /></button>
              </div>
            </div>

            {/* 90 Days — view: text only; edit: label above + input (save is in V/TO header) */}
            <div className="pt-4 mt-4 border-t border-border">
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
                  <span className="font-medium text-foreground">{vto90Days}</span>
                )}
              </div>
            </div>

            {/* Future Date — label above; date + calendar icon inside one bordered field */}
            <div className="pt-5 mt-5 border-t border-border">
              <div className="py-2">
                {vtoEditMode ? (
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground block">Future Date</label>
                    <div className="flex items-center border border-border rounded-md bg-white overflow-hidden">
                      <input
                        type="date"
                        value={(() => {
                          try {
                            const d = new Date(vtoFutureDate);
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
                          if (v) setVtoFutureDate(new Date(v + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
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

            {/* Revenue — label + circular add (light grey border & fill, black plus) */}
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
          </section>

          {/* Milestones — title + button opens modal (no accordion) */}
          <section className="py-6 border-b border-border">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h4 className="font-medium text-foreground">Milestones 0</h4>
              <button type="button" onClick={() => setAddMilestoneOpen(true)} className="px-3 py-1.5 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/10 transition-colors">
                Add Milestone
              </button>
            </div>
            <p className="text-sm text-muted-foreground">Make your Rock timely by breaking it down into achievable Milestones.</p>
          </section>

          {/* Linked Items — title + button opens modal (no accordion) */}
          <section className="py-6 border-b border-border">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h4 className="font-medium text-foreground flex items-center gap-2"><Link2 className="w-4 h-4" /> Linked Items 0</h4>
              <button type="button" onClick={() => setLinkExistingOpen(true)} className="px-3 py-1.5 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/10 transition-colors">
                Edit
              </button>
            </div>
            <button type="button" onClick={() => setLinkExistingOpen(true)} className="text-primary hover:underline text-sm font-medium">
              + Linked Item
            </button>
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
        <AddMilestoneModal onClose={() => setAddMilestoneOpen(false)} onAdd={() => setAddMilestoneOpen(false)} />
      )}
      {linkExistingOpen && (
        <LinkExistingModal rockTitle={rock.title} onClose={() => setLinkExistingOpen(false)} onLink={() => setLinkExistingOpen(false)} />
      )}
    </>
  );
}

function AddMilestoneModal({ onClose, onAdd }: { onClose: () => void; onAdd: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[60]" onClick={onClose} aria-hidden />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-full max-w-md bg-card border border-border rounded-lg shadow-xl p-5">
        <h3 className="text-lg font-semibold text-foreground mb-4">Add a Milestone</h3>
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
          <button type="button" onClick={onAdd} className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">Add</button>
        </div>
      </div>
    </>
  );
}

function LinkExistingModal({ rockTitle, onClose, onLink }: { rockTitle: string; onClose: () => void; onLink: () => void }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'Rock' | 'Milestone' | 'To-Do' | 'Issue'>('Rock');
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[60]" onClick={onClose} aria-hidden />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-full max-w-lg bg-card border border-border rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="h-1 bg-primary shrink-0" />
        <header className="p-4 border-b border-border shrink-0 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Link to Existing Items</h3>
            <p className="text-sm text-muted-foreground">Link to Waypoints (Rocks): {rockTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded hover:bg-muted" aria-label="Close"><X className="w-5 h-5" /></button>
        </header>
        <div className="p-4 border-b border-border shrink-0">
          <Input.Search placeholder="Search for Waypoints (Rocks) on your team" value={search} onChange={(e) => setSearch(e.target.value)} allowClear className="w-full" />
          <p className="text-sm font-medium text-foreground mt-2">Waypoints (Rocks) in Leadership Team</p>
        </div>
        <div className="flex border-b border-border shrink-0">
          {(['Rock', 'Milestone', 'To-Do', 'Issue'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>{t}</button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center text-muted-foreground text-sm">
          There are no {tab === 'Rock' ? 'Waypoints (Rocks)' : tab === 'Milestone' ? 'Milestones' : tab === 'To-Do' ? 'Clearances (To-Dos)' : 'Turbulence (Issues)'} found with your team Leadership Team.
        </div>
        <footer className="p-4 border-t border-border shrink-0 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">0 item</span>
          <button type="button" onClick={onLink} disabled className="px-3 py-2 bg-muted text-muted-foreground rounded-md text-sm font-medium cursor-not-allowed">Link items to Waypoints (Rocks)</button>
        </footer>
      </div>
    </>
  );
}

function RockRow({
  rock,
  showMilestone,
  onOpenCreate,
  meetingId,
  isArchiveView,
  onUnarchive,
  onOpenDetail,
  onOpenDatePicker,
  hideAccordion,
}: {
  rock: Rock;
  showMilestone?: boolean;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string }) => void;
  meetingId?: string;
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

  useEffect(() => {
    setTitleInput(rock.title);
  }, [rock.title]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) titleInputRef.current.focus();
  }, [editingTitle]);

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

  const handleRowClick = () => {
    if (editingTitle) return;
    onOpenDetail?.(rock);
  };

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
        <td className="px-4 py-3 align-middle">
          <span className={statusBadgeClass(rock.status)}>
            {rock.status === 'on_track' && <ThumbsUp className="w-3.5 h-3.5" />}
            {STATUS_LABEL[rock.status]}
          </span>
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
          {showMilestone && rock.milestoneLabel ? (
            <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">
              {rock.milestoneLabel}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        {!showMilestone && (
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
        <tr className="border-b border-border bg-muted/5">
          <td colSpan={showMilestone ? 7 : 8} className="px-4 py-2 pl-12">
            <button
              type="button"
              className="text-primary hover:underline text-sm font-medium flex items-center gap-1.5 py-1 transition-colors"
              onClick={(e) => { e.stopPropagation(); onOpenDetail?.(rock); }}
            >
              + Add Milestone
            </button>
          </td>
        </tr>
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
  onOpenCreate,
  meetingId,
  onUnarchive,
  onOpenDetail,
  onOpenDatePicker,
}: {
  rocks: Rock[];
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string }) => void;
  meetingId?: string;
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
                    onOpenCreate={onOpenCreate}
                    meetingId={meetingId}
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
