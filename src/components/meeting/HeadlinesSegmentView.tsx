'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMeetingSocket } from '@/contexts/MeetingSocketContext';
import {
  DndContext,
  type DragEndEvent,
  pointerWithin,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Select, Input } from 'antd';
import {
  MoreHorizontal,
  GripVertical,
  Mountain,
  CheckSquare,
  AlertCircle,
  Megaphone,
  Send,
  Archive,
  Link2,
  Trash2,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import {
  useHeadlines,
  type HeadlineItem,
  type CascadingMessageItem,
} from '@/contexts/HeadlinesContext';
import { ContentAreaLoader } from '@/components/ui/loaders';
import { formatDateTime, formatRelativeTime } from '@/lib/formatDate';

const MENU_WIDTH = 248;
const MENU_GAP = 8;

type CreatePopupType = 'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message';

interface HeadlinesSegmentViewProps {
  teamName?: string;
  embedded?: boolean;
  meetingId?: string;
  isFacilitator?: boolean;
  /** Scribe or facilitator can change filters and create (recording) */
  canRecord?: boolean;
  onOpenCreate?: (type: CreatePopupType) => void;
}

export function HeadlinesSegmentView({
  teamName = 'No team found',
  embedded = false,
  meetingId,
  isFacilitator = true,
  canRecord,
  onOpenCreate,
}: HeadlinesSegmentViewProps) {
  const canUseFilters = canRecord ?? isFacilitator;
  const [teamFilter, setTeamFilter] = useState(teamName);
  const [archiveOn, setArchiveOn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { socket } = useMeetingSocket();

  const {
    headlines,
    cascadingMessages,
    addHeadline,
    addCascadingMessage,
    reorderHeadlines,
    reorderCascadingMessages,
    isLoading,
  } = useHeadlines();

  const [isAddingHeadline, setIsAddingHeadline] = useState(false);
  const [newHeadlineTitle, setNewHeadlineTitle] = useState('');
  const [isSavingHeadline, setIsSavingHeadline] = useState(false);

  // Sync headlines filters from facilitator to members
  useEffect(() => {
    if (!socket || !meetingId) return;
    const onHeadlinesFilter = (payload: {
      teamFilter?: string;
      archiveOn?: boolean;
      searchQuery?: string;
    }) => {
      if (payload.teamFilter !== undefined) setTeamFilter(payload.teamFilter);
      if (payload.archiveOn !== undefined) setArchiveOn(payload.archiveOn);
      if (payload.searchQuery !== undefined) setSearchQuery(payload.searchQuery);
    };
    socket.on('headlines_filter', onHeadlinesFilter);
    return () => {
      socket.off('headlines_filter', onHeadlinesFilter);
    };
  }, [socket, meetingId]);

  const activeHeadlines = useMemo(
    () => headlines.filter((h) => !h.archived),
    [headlines]
  );
  const activeCascading = useMemo(
    () => cascadingMessages.filter((c) => !c.archived),
    [cascadingMessages]
  );
  const archivedHeadlines = useMemo(
    () => headlines.filter((h) => h.archived),
    [headlines]
  );
  const archivedCascading = useMemo(
    () => cascadingMessages.filter((c) => c.archived),
    [cascadingMessages]
  );

  const filteredHeadlines = useMemo(() => {
    if (!searchQuery.trim()) return activeHeadlines;
    const q = searchQuery.toLowerCase();
    return activeHeadlines.filter((h) => h.title.toLowerCase().includes(q));
  }, [activeHeadlines, searchQuery]);

  const filteredCascading = useMemo(() => {
    if (!searchQuery.trim()) return activeCascading;
    const q = searchQuery.toLowerCase();
    return activeCascading.filter((c) => c.title.toLowerCase().includes(q));
  }, [activeCascading, searchQuery]);

  const handleSaveNewHeadline = () => {
    const title = newHeadlineTitle.trim() || 'New headline';
    setIsSavingHeadline(true);
    addHeadline({
      title,
      createdAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      createdAgo: 'Just now',
      ownerInitials: 'JD',
      archived: false,
    });
    setIsAddingHeadline(false);
    setNewHeadlineTitle('');
    setIsSavingHeadline(false);
  };

  const headlineIds = useMemo(() => filteredHeadlines.map((h) => h.id), [filteredHeadlines]);
  const cascadingIds = useMemo(() => filteredCascading.map((c) => c.id), [filteredCascading]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (headlineIds.includes(activeId)) {
      const from = headlineIds.indexOf(activeId);
      const to = headlineIds.indexOf(overId);
      if (from !== -1 && to !== -1) reorderHeadlines(from, to);
    } else if (cascadingIds.includes(activeId)) {
      const from = cascadingIds.indexOf(activeId);
      const to = cascadingIds.indexOf(overId);
      if (from !== -1 && to !== -1) reorderCascadingMessages(from, to);
    }
  };

  const wrap = embedded ? 'pt-0 pb-4' : 'pt-0 pb-6';
  const contentPad = embedded ? 'px-4' : 'px-6';
  return (
    <div className={`flex flex-col min-h-0 h-full ${wrap}`}>
      {/* Filter row — full width; facilitator-only with sync */}
      <div className="flex flex-wrap items-center gap-3 py-3 -mx-6 px-4 border-t border-b border-border bg-muted/30 shrink-0">
        <div className={`flex items-center gap-1 ${!canUseFilters ? 'cursor-not-allowed opacity-70' : ''}`}>
          <span className="text-muted-foreground text-sm">Flight Crew:</span>
          <Select
            value={teamFilter || undefined}
            onChange={(v) => {
              if (!canUseFilters) return;
              setTeamFilter(v ?? teamName);
              if (meetingId && socket) socket.emit('headlines_filter', { meetingId, teamFilter: v ?? teamName });
            }}
            disabled={!canUseFilters || !teamName}
            options={teamName ? [{ label: teamName, value: teamName }] : []}
            className="w-[160px]"
            placeholder="Flight Crew"
          />
        </div>
        <label className={`flex items-center gap-2 group ${!canUseFilters ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
          <span className="text-sm text-foreground group-hover:text-foreground/90">Archive</span>
          <button
            type="button"
            role="switch"
            aria-checked={archiveOn}
            disabled={!canUseFilters}
            onClick={() => {
              if (!canUseFilters) return;
              setArchiveOn((o) => {
                const next = !o;
                if (meetingId && socket) socket.emit('headlines_filter', { meetingId, archiveOn: next });
                return next;
              });
            }}
            className={`relative w-11 h-6 rounded-full transition-colors border-2 flex items-center ${
              archiveOn
                ? 'bg-primary border-primary justify-end'
                : 'bg-muted border-border justify-start hover:bg-muted/80'
            } ${!canUseFilters ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow border border-border shrink-0 m-0.5" />
          </button>
        </label>
        <div className="flex-1 min-w-[200px] flex justify-end">
          <Input.Search
            placeholder="Search Flight Announcements..."
            value={searchQuery}
            onChange={(e) => {
              if (!canUseFilters) return;
              const v = e.target.value;
              setSearchQuery(v);
              if (meetingId && socket) socket.emit('headlines_filter', { meetingId, searchQuery: v });
            }}
            disabled={!canUseFilters}
            allowClear
            className="max-w-xs w-full"
          />
        </div>
      </div>

      {/* Content: padding after filter bar — or full-area loader when fetching */}
      {isLoading ? (
        <ContentAreaLoader label="Loading headlines…" />
      ) : (
      <div className={`flex-1 overflow-auto min-h-0 mt-6 ${contentPad}`}>
        {archiveOn ? (
          <>
            <ArchivedSection
              title="Archived Flight Announcements"
              count={archivedHeadlines.length}
              subtitle="Customer/Employee Headlines"
              emptyMessage="Your crew doesn't have any archived flight announcements."
              hint="Flight announcements are a great way to share updates across flight crews."
              learnLink="Learn more about Flight Announcements."
            />
            <ArchivedSection
              title="Archived Cascading Messages"
              count={archivedCascading.length}
              emptyMessage="Your crew doesn't have any archived cascading messages."
              hint="Cascading messages help communicate across the organization."
              learnLink="Learn more about Cascading Messages."
              className="mt-6"
            />
          </>
        ) : (
          <>
            <DndContext
              onDragEnd={handleDragEnd}
              collisionDetection={pointerWithin}
            >
              <HeadlinesList
                items={filteredHeadlines}
                onCreateClick={
                  onOpenCreate
                    ? () => onOpenCreate('headline')
                    : () => setIsAddingHeadline(true)
                }
                sectionTitle="Flight Announcements"
                sectionSubtitle="Customer/Employee Headlines"
                createLabel="Create Headline"
                isAdding={isAddingHeadline}
                newTitle={newHeadlineTitle}
                onNewTitleChange={setNewHeadlineTitle}
                onSaveNew={handleSaveNewHeadline}
                onCancelNew={() => {
                  setIsAddingHeadline(false);
                  setNewHeadlineTitle('');
                }}
                isSaving={isSavingHeadline}
              />
              <CascadingList
                items={filteredCascading}
                teamName={teamFilter}
                onCreateClick={
                  onOpenCreate
                    ? () => onOpenCreate('cascading_message')
                    : () =>
                        addCascadingMessage({
                          title: 'New cascading message',
                          from: teamFilter,
                          createdAt: new Date().toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }),
                          createdAgo: 'Just now',
                          ownerInitials: 'JD',
                          archived: false,
                        })
                }
              />
            </DndContext>
          </>
        )}
      </div>
      )}
    </div>
  );
}

function ArchivedSection({
  title,
  count,
  subtitle,
  emptyMessage,
  hint,
  learnLink,
  className = '',
}: {
  title: string;
  count: number;
  subtitle?: string;
  emptyMessage: string;
  hint: string;
  learnLink: string;
  className?: string;
}) {
  return (
    <div className={`bg-card border border-border rounded-lg p-8 ${className}`}>
      <h3 className="text-lg font-semibold text-foreground">
        {title} {count}
      </h3>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      )}
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Megaphone className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-foreground font-medium">{emptyMessage}</p>
        <p className="text-sm text-muted-foreground mt-1">{hint}</p>
        <button
          type="button"
          className="text-primary hover:underline text-sm font-medium mt-2"
        >
          {learnLink}
        </button>
      </div>
    </div>
  );
}

function HeadlinesList({
  items,
  onCreateClick,
  sectionTitle,
  sectionSubtitle,
  createLabel,
  isAdding,
  newTitle,
  onNewTitleChange,
  onSaveNew,
  onCancelNew,
  isSaving,
}: {
  items: HeadlineItem[];
  onCreateClick: () => void;
  sectionTitle: string;
  sectionSubtitle: string;
  createLabel: string;
  isAdding?: boolean;
  newTitle?: string;
  onNewTitleChange?: (v: string) => void;
  onSaveNew?: () => void;
  onCancelNew?: () => void;
  isSaving?: boolean;
}) {
  const showInlineAdd = isAdding && onSaveNew && onCancelNew;
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">
          {sectionTitle} {items.length}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">{sectionSubtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="w-10 px-4 py-2" />
              <th className="w-8 px-4 py-2" />
              <th className="text-left font-medium text-foreground px-4 py-2">
                Title
              </th>
              <th className="text-left font-medium text-foreground px-4 py-2">
                Created
              </th>
              <th className="text-left font-medium text-foreground px-4 py-2 w-24">
                Owner
              </th>
              <th className="text-right font-medium text-foreground px-4 py-2 w-14">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {showInlineAdd && (
              <tr className="border-b border-border bg-primary/5">
                <td className="px-4 py-2 w-10" />
                <td className="px-4 py-2 w-8" />
                <td className="px-4 py-2" colSpan={2}>
                  <input
                    type="text"
                    placeholder="Type headline title..."
                    value={newTitle ?? ''}
                    onChange={(e) => onNewTitleChange?.(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSaveNew?.();
                      if (e.key === 'Escape') onCancelNew?.();
                    }}
                    autoFocus
                    className="w-full px-3 py-1.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </td>
                <td className="px-4 py-2">—</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={onCancelNew}
                      disabled={isSaving}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-50"
                      aria-label="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={onSaveNew}
                      disabled={isSaving}
                      className="p-1.5 rounded hover:bg-primary/20 text-primary disabled:opacity-50 flex items-center gap-1"
                      aria-label="Save"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            )}
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item) => (
                <HeadlineRow key={item.id} item={item} />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-border">
        {!isAdding && (
          <button
            type="button"
            onClick={onCreateClick}
            className="text-primary hover:underline text-sm font-medium"
          >
            + {createLabel}
          </button>
        )}
        {isAdding && (
          <span className="text-sm text-muted-foreground">Type title above and click ✓ to save</span>
        )}
      </div>
    </div>
  );
}

function HeadlineRow({ item }: { item: HeadlineItem }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const { archiveHeadline, deleteHeadline } = useHeadlines();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const openMenu = () => {
    if (buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect());
      setMenuOpen(true);
    }
  };

  return (
    <>
      <tr
        ref={setNodeRef}
        style={style}
        className={`border-b border-border hover:bg-muted/10 ${isDragging ? 'opacity-50 bg-muted/20' : ''}`}
      >
        <td className="px-4 py-2 w-10 align-middle">
          <button
            type="button"
            className="p-1 rounded text-muted-foreground hover:bg-muted/80 cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        </td>
        <td className="px-4 py-2 w-8 align-middle">
          <input type="checkbox" className="rounded border-border" />
        </td>
        <td className="px-4 py-2 font-medium text-foreground align-middle">
          {item.title}
        </td>
        <td className="px-4 py-2 text-muted-foreground align-middle">
          <div>{formatDateTime(item.createdAt)}</div>
          <div className="text-xs">{formatRelativeTime(item.createdAt)}</div>
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
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && anchorRect && typeof document !== 'undefined' && (
            <HeadlineRowMenu
              anchorRect={anchorRect}
              onClose={() => {
                setMenuOpen(false);
                setAnchorRect(null);
              }}
              item={item}
              onArchive={() => archiveHeadline(item.id)}
              onDelete={() => deleteHeadline(item.id)}
              includeCascade
            />
          )}
        </td>
      </tr>
    </>
  );
}

function CascadingList({
  items,
  teamName,
  onCreateClick,
}: {
  items: CascadingMessageItem[];
  teamName: string;
  onCreateClick: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">
          Cascading Messages {items.length}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="w-10 px-4 py-2" />
              <th className="w-8 px-4 py-2" />
              <th className="text-left font-medium text-foreground px-4 py-2">
                Title
              </th>
              <th className="text-left font-medium text-foreground px-4 py-2">
                From
              </th>
              <th className="text-left font-medium text-foreground px-4 py-2">
                Created
              </th>
              <th className="text-left font-medium text-foreground px-4 py-2 w-24">
                Owner
              </th>
              <th className="text-right font-medium text-foreground px-4 py-2 w-14">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item) => (
                <CascadingRow key={item.id} item={item} />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-border">
        <button
          type="button"
          onClick={onCreateClick}
          className="text-primary hover:underline text-sm font-medium"
        >
          + Create Cascading Message
        </button>
      </div>
    </div>
  );
}

function CascadingRow({ item }: { item: CascadingMessageItem }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const { archiveCascadingMessage, deleteCascadingMessage } = useHeadlines();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const openMenu = () => {
    if (buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect());
      setMenuOpen(true);
    }
  };

  return (
    <>
      <tr
        ref={setNodeRef}
        style={style}
        className={`border-b border-border hover:bg-muted/10 ${isDragging ? 'opacity-50 bg-muted/20' : ''}`}
      >
        <td className="px-4 py-2 w-10 align-middle">
          <button
            type="button"
            className="p-1 rounded text-muted-foreground hover:bg-muted/80 cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        </td>
        <td className="px-4 py-2 w-8 align-middle">
          <input type="checkbox" className="rounded border-border" />
        </td>
        <td className="px-4 py-2 font-medium text-foreground align-middle">
          {item.title}
        </td>
        <td className="px-4 py-2 text-muted-foreground align-middle">
          {item.from}
        </td>
        <td className="px-4 py-2 text-muted-foreground align-middle">
          <div>{formatDateTime(item.createdAt)}</div>
          <div className="text-xs">{formatRelativeTime(item.createdAt)}</div>
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
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && anchorRect && typeof document !== 'undefined' && (
            <HeadlineRowMenu
              anchorRect={anchorRect}
              onClose={() => {
                setMenuOpen(false);
                setAnchorRect(null);
              }}
              item={{ id: item.id, title: item.title }}
              onArchive={() => archiveCascadingMessage(item.id)}
              onDelete={() => deleteCascadingMessage(item.id)}
              includeCascade={false}
            />
          )}
        </td>
      </tr>
    </>
  );
}

function HeadlineRowMenu({
  anchorRect,
  onClose,
  item,
  onArchive,
  onDelete,
  includeCascade,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  item: { id: string; title: string };
  onArchive: () => void;
  onDelete: () => void;
  includeCascade: boolean;
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
          {includeCascade && (
            <button type="button" className={btn} onClick={onClose} role="menuitem">
              <Send className={icon} />
              Cascade
            </button>
          )}
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <Mountain className={icon} />
            Create linked Waypoint
          </button>
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <CheckSquare className={icon} />
            Create linked Clearance
          </button>
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <AlertCircle className={icon} />
            Create linked Turbulence
          </button>
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <Megaphone className={icon} />
            Create linked Headline
          </button>
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
