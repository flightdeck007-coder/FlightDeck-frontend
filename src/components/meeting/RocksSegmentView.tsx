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
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Search,
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
} from 'lucide-react';
import {
  useRocks,
  type Rock,
  type RockColumnId,
} from '@/contexts/RocksContext';
import { ContentAreaLoader } from '@/components/ui/loaders';

const COLUMN_LABELS: Record<RockColumnId, string> = {
  current: 'Current',
  next: 'Next',
  later: 'Later',
  future: 'Future',
  long_term: 'Long-Term Issues',
};

/** Estimated width of the rock actions dropdown so we can keep it on-screen */
const ROCK_ACTIONS_MENU_WIDTH = 248;
const ROCK_ACTIONS_MENU_GAP = 8;

type CreatePopupType = 'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message';

interface RocksSegmentViewProps {
  sectionTitle?: string;
  embedded?: boolean;
  meetingId?: string;
  isFacilitator?: boolean;
  onOpenCreate?: (type: CreatePopupType) => void;
}

export function RocksSegmentView({
  sectionTitle = 'ROCK REVIEW',
  embedded = false,
  meetingId,
  isFacilitator = true,
  onOpenCreate,
}: RocksSegmentViewProps) {
  const [teamFilter, setTeamFilter] = useState('Leadership Team');
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'rocks' | 'planning' | 'archive'>(
    'rocks'
  );
  const [vtoExpanded, setVtoExpanded] = useState(true);
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
  const userRocks = useMemo(
    () => filteredRocks.filter((r) => !r.isCompanyRock),
    [filteredRocks]
  );

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
        <div className={`relative ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
          <span className="text-muted-foreground text-sm mr-1">Team:</span>
          <select
            value={teamFilter}
            onChange={(e) => {
              if (!isFacilitator) return;
              const v = e.target.value;
              setTeamFilter(v);
              if (meetingId && socket) socket.emit('rocks_filter', { meetingId, teamFilter: v });
            }}
            disabled={!isFacilitator}
            className={`pl-3 pr-8 py-2 border border-border rounded-lg bg-background text-foreground text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${!isFacilitator ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50 hover:border-foreground/20'}`}
          >
            <option>Leadership Team</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        <div className={`relative ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
          <span className="text-muted-foreground text-sm mr-1">Owner:</span>
          <select
            value={ownerFilter}
            onChange={(e) => {
              if (!isFacilitator) return;
              const v = e.target.value;
              setOwnerFilter(v);
              if (meetingId && socket) socket.emit('rocks_filter', { meetingId, ownerFilter: v });
            }}
            disabled={!isFacilitator}
            className={`pl-3 pr-8 py-2 border border-border rounded-lg bg-background text-foreground text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${!isFacilitator ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50 hover:border-foreground/20'}`}
          >
            <option>All</option>
            <option>John Doe</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        <div className={`relative ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
          <span className="text-muted-foreground text-sm mr-1">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              if (!isFacilitator) return;
              const v = e.target.value;
              setStatusFilter(v);
              if (meetingId && socket) socket.emit('rocks_filter', { meetingId, statusFilter: v });
            }}
            disabled={!isFacilitator}
            className={`pl-3 pr-8 py-2 border border-border rounded-lg bg-background text-foreground text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${!isFacilitator ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50 hover:border-foreground/20'}`}
          >
            <option>All</option>
            <option>On-track</option>
            <option>Off-track</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        {isFacilitator && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMoreActionsOpen((o) => !o)}
            className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
            title="More actions"
          >
            <MoreHorizontal className="w-4 h-4" />
            More actions
          </button>
          {moreActionsOpen && (
            <>
              <div className="absolute left-0 top-full mt-1 py-1 bg-card border border-border rounded-md shadow-lg z-20 min-w-[200px]">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                  onClick={() => setMoreActionsOpen(false)}
                >
                  <RefreshCw className="w-4 h-4" /> Refresh Rocks
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                  onClick={() => setMoreActionsOpen(false)}
                >
                  <FileDown className="w-4 h-4" /> Print to PDF
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                  onClick={() => setMoreActionsOpen(false)}
                >
                  <Download className="w-4 h-4" /> Download Excel
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                  onClick={() => setMoreActionsOpen(false)}
                >
                  <Archive className="w-4 h-4" /> Archive Completed
                </button>
              </div>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMoreActionsOpen(false)}
                aria-hidden
              />
            </>
          )}
        </div>
        )}
        <div className="flex-1 min-w-[200px] flex justify-end">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder={`Search ${sectionTitle}...`}
              value={searchQuery}
              onChange={(e) => {
                if (!isFacilitator) return;
                const v = e.target.value;
                setSearchQuery(v);
                if (meetingId && socket) socket.emit('rocks_filter', { meetingId, searchQuery: v });
              }}
              disabled={!isFacilitator}
              className={`w-full max-w-xs pl-9 pr-3 py-2 border border-border rounded-md bg-background text-foreground text-sm ${!isFacilitator ? 'cursor-not-allowed opacity-70' : ''}`}
            />
          </div>
        </div>
      </div>

      {/* Content: padding after filter bar — or full-area loader when fetching */}
      {isLoading ? (
        <ContentAreaLoader label="Loading rocks…" />
      ) : (
      <div className={`flex-1 flex flex-col min-h-0 mt-6 ${contentPad}`}>
      {/* Tabs — hover and transition for clickable UI */}
      <div className="flex gap-0 border-b border-border mb-4 shrink-0">
        {(
          [
            { id: 'rocks', label: 'Rocks', icon: List },
            { id: 'planning', label: 'Planning Board', icon: LayoutGrid },
            { id: 'archive', label: 'Archive', icon: ArchiveIcon },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              if (!isFacilitator) return;
              setActiveTab(tab.id);
              if (meetingId && socket) socket.emit('rocks_filter', { meetingId, activeTab: tab.id });
            }}
            disabled={!isFacilitator}
            className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors rounded-t-md ${
              activeTab === tab.id
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            } ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto min-h-0 mt-6">
        {activeTab === 'rocks' && (
          <RocksTabContent
            companyRocks={companyRocks}
            userRocks={userRocks}
            vtoExpanded={vtoExpanded}
            onVtoToggle={() => setVtoExpanded((e) => !e)}
            onAddRock={() => {
              if (onOpenCreate) onOpenCreate('rock');
              else addRock({
                title: 'New rock',
                ownerName: 'John Doe',
                ownerInitials: 'JD',
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
          <ArchiveTabContent rocks={archivedRocks} />
        )}
      </div>

      </div>
    )}
    </div>
  );
}

function RocksTabContent({
  companyRocks,
  userRocks,
  vtoExpanded,
  onVtoToggle,
  onAddRock,
}: {
  companyRocks: Rock[];
  userRocks: Rock[];
  vtoExpanded: boolean;
  onVtoToggle: () => void;
  onAddRock: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* V/TO section — when expanded: 90 Days (editable), Future Date, Revenue/Profit/Measurables */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={onVtoToggle}
          className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
        >
          {vtoExpanded ? (
            <ChevronUp className="w-4 h-4 text-primary" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">
            ∞
          </span>
          <span className="font-medium text-foreground">
            V/TO® | Revenue, Profit, Measurables
          </span>
        </button>
        {vtoExpanded && (
          <div className="border-t border-border p-4 space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">90 Days</span>
              <button
                type="button"
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                aria-label="Edit 90 Days"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
            <div>
              <span className="font-medium text-foreground">Future Date: </span>
              <span className="text-muted-foreground">February 28, 2023</span>
            </div>
            <div className="space-y-2">
              <div>
                <span className="font-medium text-foreground">Revenue:</span>
                <span className="text-muted-foreground ml-2">—</span>
              </div>
              <div>
                <span className="font-medium text-foreground">Profit:</span>
                <span className="text-muted-foreground ml-2">—</span>
              </div>
              <div>
                <span className="font-medium text-foreground">Measurables:</span>
                <span className="text-muted-foreground ml-2">—</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Company Rocks */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/20">
          <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs text-foreground/70">
            ∿
          </span>
          <h3 className="font-semibold text-foreground">
            Company Rocks {companyRocks.length}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
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
                  <RockRow key={rock.id} rock={rock} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User rocks (e.g. John Doe) */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/20">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
            JD
          </div>
          <h3 className="font-semibold text-foreground">
            John Doe {userRocks.length}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
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
              {userRocks.map((rock) => (
                <RockRow key={rock.id} rock={rock} showMilestone />
              ))}
              <tr>
                <td colSpan={6} className="px-4 py-3">
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
    </div>
  );
}

/**
 * Dropdown menu for a single rock's actions (Create linked Rock/To-Do/Issue/Headline, Archive, Print, Copy Link, Delete).
 * Rendered via portal so it appears above the page and is not clipped by table overflow.
 */
function RockActionsMenu({
  anchorRect,
  onClose,
  rock,
  onArchive,
  onDelete,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  rock: Rock;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
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
    'w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 rounded-md flex items-center gap-3 transition-colors';
  const iconClass = 'w-4 h-4 text-muted-foreground shrink-0';

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
          <button type="button" className={buttonClass} onClick={onClose} role="menuitem">
            <Mountain className={iconClass} />
            Create linked Rock
          </button>
          <button type="button" className={buttonClass} onClick={onClose} role="menuitem">
            <CheckSquare className={iconClass} />
            Create linked To-Do
          </button>
          <button type="button" className={buttonClass} onClick={onClose} role="menuitem">
            <AlertCircle className={iconClass} />
            Create linked Issue
          </button>
          <button type="button" className={buttonClass} onClick={onClose} role="menuitem">
            <Megaphone className={iconClass} />
            Create linked Headline
          </button>
        </div>
        <div className="border-t border-border my-1" />
        <div className="px-2 py-1">
          <button
            type="button"
            className={buttonClass}
            onClick={() => { onArchive(rock.id); onClose(); }}
            role="menuitem"
          >
            <Archive className={iconClass} />
            Archive
          </button>
          <button type="button" className={buttonClass} onClick={onClose} role="menuitem">
            <FileDown className={iconClass} />
            Print to PDF
          </button>
          <button type="button" className={buttonClass} onClick={onClose} role="menuitem">
            <Link2 className={iconClass} />
            Copy Link
          </button>
        </div>
        <div className="border-t border-border my-1" />
        <div className="px-2 py-1">
          <button
            type="button"
            className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md flex items-center gap-3 transition-colors"
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

function RockRow({
  rock,
  showMilestone,
}: {
  rock: Rock;
  showMilestone?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { archiveRock, deleteRock } = useRocks();

  const openMenu = () => {
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

  return (
    <>
      <tr className="border-b border-border hover:bg-muted/10 transition-colors">
        <td className="px-4 py-3 w-10 align-middle">
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
        <td className="px-4 py-3 align-middle">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
            <ThumbsUp className="w-3.5 h-3.5" />
            On-track
          </span>
        </td>
        <td className="px-4 py-3 font-medium text-foreground align-middle">
          {rock.title}
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
        <td className="px-4 py-3 text-muted-foreground align-middle">
          {rock.dueBy}
        </td>
        <td className="px-4 py-3 w-12 align-middle text-right">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (menuOpen) closeMenu();
              else openMenu();
            }}
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
              onDelete={deleteRock}
            />
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border bg-muted/5">
          <td colSpan={showMilestone ? 6 : 7} className="px-4 py-2 pl-12">
            <button
              type="button"
              className="text-primary hover:underline text-sm font-medium flex items-center gap-1.5 py-1 transition-colors"
              onClick={() => {}}
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
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
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
      className={`flex-shrink-0 w-64 rounded-lg border-2 bg-muted/10 min-h-[520px] flex flex-col ${
        isOver ? 'border-primary bg-primary/5' : 'border-border'
      }`}
    >
      <div className="flex items-center justify-between gap-2 p-3 border-b border-border shrink-0">
        <span className="font-medium text-foreground">
          {title} {rocks.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-1.5 rounded hover:bg-accent text-muted-foreground"
            title="Add"
          >
            +
          </button>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-accent text-muted-foreground"
            title="Sort"
          >
            ↕
          </button>
          {columnId === 'long_term' && (
            <button
              type="button"
              className="p-1.5 rounded hover:bg-accent text-muted-foreground"
              title="Filter"
            >
              <Filter className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        {rocks.length === 0 ? (
          <p className="text-sm text-muted-foreground px-2 py-4 text-center">
            {title} does not contain any items
          </p>
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <ThumbsUp className="w-3 h-3" />
          On-track
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
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <Link2 className="w-3 h-3" /> Link Goal
        </button>
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
          {rock.ownerInitials}
        </div>
      </div>
    </div>
  );
}

function ArchiveTabContent({ rocks }: { rocks: Rock[] }) {
  return (
    <div className="space-y-2">
      {rocks.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No achieved rocks in archive
        </p>
      ) : (
        rocks.map((rock) => (
          <div
            key={rock.id}
            className="bg-card border border-border rounded-lg p-4 flex items-center gap-4"
          >
            <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
              Done
            </span>
            <span className="font-medium text-foreground">{rock.title}</span>
            <span className="text-sm text-muted-foreground">
              {rock.ownerName} · Due {rock.dueBy}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
