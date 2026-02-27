'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMeetingSocket } from '@/contexts/MeetingSocketContext';
import {
  Search,
  MoreVertical,
  CheckCircle2,
  Circle,
  Mountain,
  CheckSquare,
  AlertCircle,
  Megaphone,
  Archive,
  Link2,
  Trash2,
  RotateCw,
  FileDown,
  Download,
  Package,
  ChevronDown,
  ChevronUp,
  LayoutList,
  LayoutGrid,
  Eye,
  EyeOff,
  Paperclip,
  Settings,
  Loader2,
} from 'lucide-react';
import { useIssues, type IssueItem } from '@/contexts/IssuesContext';

const MENU_WIDTH = 248;
const MENU_GAP = 8;
const PAGE_SIZES = [10, 25, 50];

type CreatePopupType = 'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message';

interface IssuesSegmentViewProps {
  teamName?: string;
  embedded?: boolean;
  meetingId?: string;
  isFacilitator?: boolean;
  onOpenCreate?: (type: CreatePopupType) => void;
  onOpenCreateIssue?: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function FilterIconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      aria-label={label}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

export function IssuesSegmentView({
  teamName = 'Leadership Team',
  embedded = false,
  meetingId,
  isFacilitator = true,
  onOpenCreate,
  onOpenCreateIssue,
}: IssuesSegmentViewProps) {
  const [teamFilter, setTeamFilter] = useState(teamName);
  const [archiveOn, setArchiveOn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'short_term' | 'long_term'>('short_term');
  const [statsVisible, setStatsVisible] = useState(true);
  const [topThreeOnly, setTopThreeOnly] = useState(false);
  const [layout, setLayout] = useState<'list' | 'column'>('list');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [page, setPage] = useState(0);

  const { socket } = useMeetingSocket();

  useEffect(() => {
    if (!socket || !meetingId) return;
    const onIssuesFilter = (payload: {
      teamFilter?: string;
      archiveOn?: boolean;
      searchQuery?: string;
      activeTab?: 'short_term' | 'long_term';
      statsVisible?: boolean;
      topThreeOnly?: boolean;
      layout?: 'list' | 'column';
    }) => {
      if (payload.teamFilter !== undefined) setTeamFilter(payload.teamFilter);
      if (payload.archiveOn !== undefined) setArchiveOn(payload.archiveOn);
      if (payload.searchQuery !== undefined) setSearchQuery(payload.searchQuery);
      if (payload.activeTab !== undefined) setActiveTab(payload.activeTab);
      if (payload.statsVisible !== undefined) setStatsVisible(payload.statsVisible);
      if (payload.topThreeOnly !== undefined) setTopThreeOnly(payload.topThreeOnly);
      if (payload.layout !== undefined) setLayout(payload.layout);
    };
    socket.on('issues_filter', onIssuesFilter);
    return () => {
      socket.off('issues_filter', onIssuesFilter);
      return;
    };
  }, [socket, meetingId]);

  const {
    shortTerm,
    longTerm,
    updateIssue,
    deleteIssue,
    setResolved,
    makeLongTerm,
    refetch,
    isLoading,
  } = useIssues();

  const currentList = activeTab === 'short_term' ? shortTerm : longTerm;
  const filteredList = useMemo(() => {
    let list = [...currentList];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (topThreeOnly) {
      list = list
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 3);
    }
    return list;
  }, [currentList, searchQuery, topThreeOnly]);

  const totalItems = filteredList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, currentPage, itemsPerPage]);

  const solvedLastMeeting = 0;
  const solvedToday = 0;
  const solveRate = currentList.length > 0
    ? Math.round(((solvedLastMeeting + solvedToday) / currentList.length) * 100)
    : 0;

  const wrap = embedded ? 'pt-0 pb-4' : 'pt-0 pb-6';
  const contentPad = embedded ? 'px-4' : 'px-6';
  return (
    <div className={`flex flex-col min-h-0 h-full ${wrap}`}>
      {/* Filter bar — full width */}
      <div className="flex flex-wrap items-center gap-3 py-3 -mx-6 px-4 border-t border-b border-border bg-muted/30 shrink-0">
        <div className="relative">
          <span className="text-muted-foreground text-sm mr-1">Team:</span>
          <select
            value={teamFilter}
            onChange={(e) => {
              const v = e.target.value;
              setTeamFilter(v);
              if (meetingId && socket) socket.emit('issues_filter', { meetingId, teamFilter: v });
            }}
            disabled={!isFacilitator}
            className={`pl-3 pr-8 py-2 border border-border rounded-lg bg-background text-foreground text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-muted/50 hover:border-foreground/20 transition-colors'}`}
          >
            <option>{teamName}</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        <label className={`flex items-center gap-2 group ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
          <span className="text-sm text-foreground group-hover:text-foreground/90">Archive</span>
          <button
            type="button"
            role="switch"
            aria-checked={archiveOn}
            disabled={!isFacilitator}
            onClick={() => {
              setArchiveOn((o) => {
                const next = !o;
                if (meetingId && socket) socket.emit('issues_filter', { meetingId, archiveOn: next });
                return next;
              });
            }}
            className={`relative w-11 h-6 rounded-full transition-colors border-2 flex items-center ${!isFacilitator ? 'cursor-not-allowed' : ''} ${
              archiveOn
                ? 'bg-primary border-primary justify-end'
                : 'bg-muted border-border justify-start hover:bg-muted/80'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow border border-border shrink-0 m-0.5" />
          </button>
        </label>
        <span className="flex-1" />
        <button
          type="button"
          onClick={isFacilitator ? () => refetch() : undefined}
          disabled={!isFacilitator}
          className={`p-2 rounded-lg transition-colors ${!isFacilitator ? 'cursor-not-allowed opacity-70 text-muted-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer'}`}
          aria-label="Refresh"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={!isFacilitator}
          className={`p-2 rounded-lg transition-colors ${!isFacilitator ? 'cursor-not-allowed opacity-70 text-muted-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer'}`}
          aria-label="Export PDF"
        >
          <FileDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={!isFacilitator}
          className={`p-2 rounded-lg transition-colors ${!isFacilitator ? 'cursor-not-allowed opacity-70 text-muted-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer'}`}
          aria-label="Download"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={!isFacilitator}
          className={`p-2 rounded-lg transition-colors ${!isFacilitator ? 'cursor-not-allowed opacity-70 text-muted-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer'}`}
          aria-label="Archive all completed"
        >
          <Package className="w-4 h-4" />
        </button>
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search IDS™ | Level 10 Meeting™..."
            value={searchQuery}
            onChange={(e) => {
              const v = e.target.value;
              setSearchQuery(v);
              if (meetingId && socket) socket.emit('issues_filter', { meetingId, searchQuery: v });
            }}
            disabled={!isFacilitator}
            className={`w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'hover:border-foreground/20'}`}
          />
        </div>
        <button
          type="button"
          disabled={!isFacilitator}
          className={`p-2 rounded-lg transition-colors ${!isFacilitator ? 'cursor-not-allowed opacity-70 text-muted-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer'}`}
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Content: padding after filter bar */}
      <div className={`flex-1 overflow-auto min-h-0 mt-4 ${contentPad}`}>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border shrink-0">
        <button
          type="button"
          disabled={!isFacilitator}
          onClick={() => {
            setActiveTab('short_term');
            if (meetingId && socket) socket.emit('issues_filter', { meetingId, activeTab: 'short_term' });
          }}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${!isFacilitator ? 'cursor-not-allowed opacity-70' : ''} ${
            activeTab === 'short_term'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          Short-Term
        </button>
        <button
          type="button"
          disabled={!isFacilitator}
          onClick={() => {
            setActiveTab('long_term');
            if (meetingId && socket) socket.emit('issues_filter', { meetingId, activeTab: 'long_term' });
          }}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${!isFacilitator ? 'cursor-not-allowed opacity-70' : ''} ${
            activeTab === 'long_term'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          Long-Term
        </button>
      </div>

      {/* Short-Term only: stats row above the Short-Term card, controlled by Show/Hide */}
      {activeTab === 'short_term' && statsVisible && (
        <div className="grid grid-cols-4 gap-4 py-4 shrink-0">
          <div className="border border-border rounded-lg p-4 bg-card">
            <p className="text-sm text-muted-foreground">Total Tracked Issues</p>
            <p className="text-2xl font-bold text-foreground mt-1">{currentList.length}</p>
          </div>
          <div className="border border-border rounded-lg p-4 bg-card">
            <p className="text-sm text-muted-foreground">Issues Solved Last Meeting</p>
            <p className="text-2xl font-bold text-muted-foreground mt-1">{solvedLastMeeting}</p>
          </div>
          <div className="border border-border rounded-lg p-4 bg-card">
            <p className="text-sm text-muted-foreground">Issues Solved Today</p>
            <p className="text-2xl font-bold text-foreground mt-1">{solvedToday}</p>
          </div>
          <div className="border border-border rounded-lg p-4 bg-card">
            <p className="text-sm text-muted-foreground">Solve Rate</p>
            <p className="text-2xl font-bold text-foreground mt-1">{solveRate}%</p>
          </div>
        </div>
      )}

      {/* Content card */}
      <div className="flex-1 overflow-auto min-h-0 mt-4 bg-card border border-border rounded-lg flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-foreground">
            {activeTab === 'short_term' ? 'Short-Term' : 'Long-Term'} {currentList.length}
          </h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!isFacilitator}
              onClick={() => {
                setStatsVisible((v) => {
                  const next = !v;
                  if (meetingId && socket) socket.emit('issues_filter', { meetingId, statsVisible: next });
                  return next;
                });
              }}
              className={`flex items-center gap-1.5 text-sm transition-colors ${!isFacilitator ? 'cursor-not-allowed opacity-70 text-muted-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {statsVisible ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Show
                </>
              )}
            </button>
            <button
              type="button"
              disabled={!isFacilitator}
              onClick={() => {
                setTopThreeOnly((v) => {
                  const next = !v;
                  if (meetingId && socket) socket.emit('issues_filter', { meetingId, topThreeOnly: next });
                  return next;
                });
              }}
              className={`p-1.5 rounded transition-colors ${!isFacilitator ? 'cursor-not-allowed opacity-70 text-muted-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
              title="Selected top 3 priority issues"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5">
              <button
                type="button"
                disabled={!isFacilitator}
                onClick={() => {
                  setLayout('list');
                  if (meetingId && socket) socket.emit('issues_filter', { meetingId, layout: 'list' });
                }}
                className={`p-1.5 rounded transition-colors ${!isFacilitator ? 'cursor-not-allowed opacity-70' : ''} ${
                  layout === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                }`}
                title="List view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={!isFacilitator}
                onClick={() => {
                  setLayout('column');
                  if (meetingId && socket) socket.emit('issues_filter', { meetingId, layout: 'column' });
                }}
                className={`p-1.5 rounded transition-colors ${!isFacilitator ? 'cursor-not-allowed opacity-70' : ''} ${
                  layout === 'column' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                }`}
                title="Column view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Loading" />
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-10 px-4 py-2" />
                <th className="text-left font-medium text-foreground px-4 py-2">Title</th>
                <th className="text-left font-medium text-foreground px-4 py-2 w-16">#</th>
                <th className="text-left font-medium text-foreground px-4 py-2 w-24">Created</th>
                <th className="text-left font-medium text-foreground px-4 py-2 w-20">Owner</th>
                <th className="text-right font-medium text-foreground px-4 py-2 w-14" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item) => (
                <IssueRow
                  key={item.id}
                  item={item}
                  onToggleResolved={(resolved) => setResolved(item.id, resolved)}
                  onPriorityChange={(priority) => updateIssue(item.id, { priority })}
                  onArchive={() => setResolved(item.id, true)}
                  onDelete={() => deleteIssue(item.id)}
                  onMakeLongTerm={activeTab === 'short_term' ? () => makeLongTerm(item.id) : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-border flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenCreate ? () => onOpenCreate('issue') : onOpenCreateIssue}
            className="text-primary hover:underline text-sm font-medium hover:text-primary/90 transition-colors cursor-pointer"
          >
            + Add Issue
          </button>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              Items per page:
              <span className="relative inline-flex items-center">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setPage(0);
                  }}
                  className="pl-2 pr-7 py-1 border border-border rounded-lg bg-background text-foreground appearance-none cursor-pointer"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </span>
            </span>
            <span>
              {totalItems === 0
                ? '0-0 of 0'
                : `${currentPage * itemsPerPage + 1}-${Math.min(
                    (currentPage + 1) * itemsPerPage,
                    totalItems
                  )} of ${totalItems}`}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setPage(0)}
                disabled={currentPage === 0}
                className="p-1.5 rounded hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                aria-label="First page"
              >
                |
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="p-1.5 rounded hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Previous"
              >
                &lt;
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="p-1.5 rounded hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Next"
              >
                &gt;
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages - 1)}
                disabled={currentPage >= totalPages - 1}
                className="p-1.5 rounded hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Last page"
              >
                |
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function IssueRow({
  item,
  onToggleResolved,
  onPriorityChange,
  onArchive,
  onDelete,
  onMakeLongTerm,
}: {
  item: IssueItem;
  onToggleResolved: (resolved: boolean) => void;
  onPriorityChange: (priority: number) => void;
  onArchive: () => void;
  onDelete: () => void;
  onMakeLongTerm?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const resolved = !!item.resolvedAt;

  const openMenu = () => {
    if (buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect());
      setMenuOpen(true);
    }
  };

  return (
    <>
      <tr className="border-b border-border hover:bg-muted/10">
        <td className="px-4 py-2 w-10 align-middle">
          <button
            type="button"
            onClick={() => onToggleResolved(!resolved)}
            className="rounded-full w-6 h-6 flex items-center justify-center hover:bg-muted/80 text-muted-foreground hover:text-foreground"
            aria-label={resolved ? 'Mark unresolved' : 'Mark resolved'}
          >
            {resolved ? (
              <CheckCircle2 className="w-5 h-5 text-primary" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>
        </td>
        <td className="px-4 py-2 font-medium text-foreground align-middle">
          <div className="flex items-center gap-2">
            <span>{item.title}</span>
            {(item.attachmentCount ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-muted-foreground text-xs">
                <Paperclip className="w-3 h-3" />
                {item.attachmentCount}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-2 align-middle">
          <span className="relative inline-flex items-center">
            <select
              value={item.priority}
              onChange={(e) => onPriorityChange(Number(e.target.value))}
              className="pl-2 pr-6 py-1 border border-border rounded bg-background text-foreground text-sm appearance-none cursor-pointer"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 w-4 h-4 text-muted-foreground pointer-events-none" />
          </span>
        </td>
        <td className="px-4 py-2 text-muted-foreground align-middle">
          {formatDate(item.createdAt)}
        </td>
        <td className="px-4 py-2 align-middle">
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
            {item.ownerInitials}
          </div>
        </td>
        <td className="px-4 py-2 align-middle text-right">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
            className="p-2 rounded-md hover:bg-muted/80 text-muted-foreground"
            aria-label="More actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && anchorRect && typeof document !== 'undefined' && (
            <IssueRowMenu
              anchorRect={anchorRect}
              onClose={() => {
                setMenuOpen(false);
                setAnchorRect(null);
              }}
              onArchive={onArchive}
              onDelete={onDelete}
              onMakeLongTerm={onMakeLongTerm}
            />
          )}
        </td>
      </tr>
    </>
  );
}

function IssueRowMenu({
  anchorRect,
  onClose,
  onArchive,
  onDelete,
  onMakeLongTerm,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onMakeLongTerm?: () => void;
}) {
  const position = useMemo(() => {
    if (typeof window === 'undefined')
      return { top: anchorRect.top, left: anchorRect.right + MENU_GAP };
    const padding = 8;
    const maxLeft = window.innerWidth - MENU_WIDTH - padding;
    const leftWhenRight = anchorRect.right + MENU_GAP;
    const left =
      leftWhenRight > maxLeft
        ? anchorRect.left - MENU_WIDTH - MENU_GAP
        : leftWhenRight;
    const top = Math.min(
      anchorRect.top,
      Math.max(padding, window.innerHeight - 420)
    );
    return { top, left };
  }, [anchorRect]);

  const btn =
    'w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 rounded-md flex items-center gap-3 transition-colors';
  const icon = 'w-4 h-4 text-muted-foreground shrink-0';

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        className="fixed z-50 py-2 bg-card border border-border rounded-lg shadow-xl min-w-[240px]"
        style={{ top: position.top, left: position.left }}
        role="menu"
        aria-label="Row actions"
      >
        <div className="px-2 py-1">
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <ChevronUp className={icon} />
            Top of List
          </button>
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <ChevronDown className={icon} />
            Bottom of List
          </button>
        </div>
        <div className="border-t border-border my-1" />
        <div className="px-2 py-1">
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <Mountain className={icon} />
            Create linked Rock
          </button>
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <CheckSquare className={icon} />
            Create linked To-Do
          </button>
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <AlertCircle className={icon} />
            Create linked Issue
          </button>
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <Megaphone className={icon} />
            Create linked Headline
          </button>
        </div>
        <div className="border-t border-border my-1" />
        <div className="px-2 py-1">
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            Merge into Another Issue
          </button>
          {onMakeLongTerm && (
            <button
              type="button"
              className={btn}
              onClick={() => {
                onMakeLongTerm();
                onClose();
              }}
              role="menuitem"
            >
              Make Long-Term Issue
            </button>
          )}
        </div>
        <div className="border-t border-border my-1" />
        <div className="px-2 py-1">
          <button
            type="button"
            className={btn}
            onClick={() => {
              onArchive();
              onClose();
            }}
            role="menuitem"
          >
            <Archive className={icon} />
            Archive
          </button>
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <Link2 className={icon} />
            Copy Link
          </button>
        </div>
        <div className="border-t border-border my-1" />
        <div className="px-2 py-1">
          <button
            type="button"
            className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md flex items-center gap-3 transition-colors"
            onClick={() => {
              onDelete();
              onClose();
            }}
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
