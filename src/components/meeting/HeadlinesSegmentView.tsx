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
import { RichTextEditor } from '@/components/meeting/RichTextEditor';
import { formatDateTime, formatRelativeTime } from '@/lib/formatDate';

const MENU_WIDTH = 248;
const MENU_GAP = 8;

type CreatePopupType = 'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message';
type LinkedEntity = { type: 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message'; id: string; title: string };
type OpenCreateOptions = { title?: string; description?: string; linkedEntity?: LinkedEntity };

function getLinkedCreateOptions(
  source: { id: string; title: string },
  sourceType: 'headline' | 'cascading_message',
  target: CreatePopupType
): OpenCreateOptions {
  const linkedEntity: LinkedEntity = { type: sourceType, id: source.id, title: source.title };
  const sourceLabel = sourceType === 'headline' ? 'Announcement' : 'Flight Directive';
  const description = `${sourceLabel}: ${source.title}`;
  if (target === 'rock') return { title: `Waypoint: ${source.title}`, description, linkedEntity };
  if (target === 'todo') return { title: `Clearance: ${source.title}`, description, linkedEntity };
  if (target === 'issue') return { title: `Turbulence: ${source.title}`, description, linkedEntity };
  if (target === 'headline') return { title: `Announcement: ${source.title}`, description, linkedEntity };
  if (target === 'cascading_message') return { title: `Flight Directive: ${source.title}`, description, linkedEntity };
  return { title: source.title, description, linkedEntity };
}

interface HeadlinesSegmentViewProps {
  teamName?: string;
  owners?: Array<{ id: string; name?: string | null; email?: string }>;
  embedded?: boolean;
  meetingId?: string;
  isFacilitator?: boolean;
  /** Scribe or facilitator can change filters and create (recording) */
  canRecord?: boolean;
  onOpenCreate?: (type: CreatePopupType, options?: OpenCreateOptions) => void;
}

export function HeadlinesSegmentView({
  teamName = 'No team found',
  owners = [],
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
    archiveHeadline,
    archiveCascadingMessage,
    deleteHeadline,
    deleteCascadingMessage,
    updateHeadline,
    updateCascadingMessage,
    isLoading,
  } = useHeadlines();

  const [isAddingHeadline, setIsAddingHeadline] = useState(false);
  const [newHeadlineTitle, setNewHeadlineTitle] = useState('');
  const [isSavingHeadline, setIsSavingHeadline] = useState(false);
  const [selectedHeadlineId, setSelectedHeadlineId] = useState<string | null>(null);
  const [selectedDirectiveId, setSelectedDirectiveId] = useState<string | null>(null);

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
    const title = newHeadlineTitle.trim() || 'New announcement';
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
        <ContentAreaLoader label="Loading announcements…" />
      ) : (
      <div className={`flex-1 overflow-auto min-h-0 mt-6 ${contentPad}`}>
        {archiveOn ? (
          <>
            <ArchivedSection
              title="Archived Flight Announcements"
              count={archivedHeadlines.length}
              subtitle="Flight Announcements"
              emptyMessage="Your crew doesn't have any archived flight announcements."
              hint="Flight announcements are a great way to share updates across flight crews."
              learnLink="Learn more about Flight Announcements."
            />
            <ArchivedSection
              title="Archived Flight Directives"
              count={archivedCascading.length}
              emptyMessage="Your crew doesn't have any archived flight directives."
              hint="Flight directives help communicate across the organization."
              learnLink="Learn more about Flight Directives."
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
                onOpenEdit={(id) => setSelectedHeadlineId(id)}
                onOpenCreate={onOpenCreate}
                onCreateClick={
                  onOpenCreate
                    ? () => onOpenCreate('headline')
                    : () => setIsAddingHeadline(true)
                }
                sectionTitle="Flight Announcements"
                sectionSubtitle="Flight Announcements"
                createLabel="Create Announcement"
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
                onOpenEdit={(id) => setSelectedDirectiveId(id)}
                onOpenCreate={onOpenCreate}
                onCreateClick={
                  onOpenCreate
                    ? () => onOpenCreate('cascading_message')
                    : () =>
                        addCascadingMessage({
                          title: 'New flight directive',
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
      {selectedHeadlineId && (() => {
        const item = headlines.find((h) => h.id === selectedHeadlineId);
        return item ? (
          <HeadlineDetailPanel
            item={item}
            owners={owners}
            onOpenCreate={onOpenCreate}
            onClose={() => setSelectedHeadlineId(null)}
            onSave={(patch) => updateHeadline(item.id, patch)}
            onArchive={() => archiveHeadline(item.id)}
            onDelete={() => {
              deleteHeadline(item.id);
              setSelectedHeadlineId(null);
            }}
          />
        ) : null;
      })()}
      {selectedDirectiveId && (() => {
        const item = cascadingMessages.find((c) => c.id === selectedDirectiveId);
        return item ? (
          <CascadingDetailPanel
            item={item}
            teamName={teamName}
            owners={owners}
            onOpenCreate={onOpenCreate}
            onClose={() => setSelectedDirectiveId(null)}
            onSave={(patch) => updateCascadingMessage(item.id, patch)}
            onArchive={() => archiveCascadingMessage(item.id)}
            onDelete={() => {
              deleteCascadingMessage(item.id);
              setSelectedDirectiveId(null);
            }}
          />
        ) : null;
      })()}
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
  onOpenEdit,
  onOpenCreate,
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
  onOpenEdit: (id: string) => void;
  onOpenCreate?: (type: CreatePopupType, options?: OpenCreateOptions) => void;
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
                    placeholder="Type announcement title..."
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
                <HeadlineRow key={item.id} item={item} onOpenEdit={onOpenEdit} onOpenCreate={onOpenCreate} />
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

function HeadlineRow({ item, onOpenEdit, onOpenCreate }: { item: HeadlineItem; onOpenEdit: (id: string) => void; onOpenCreate?: (type: CreatePopupType, options?: OpenCreateOptions) => void }) {
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
        className={`border-b border-border hover:bg-muted/10 cursor-pointer ${isDragging ? 'opacity-50 bg-muted/20' : ''}`}
        onClick={() => onOpenEdit(item.id)}
      >
        <td className="px-4 py-2 w-10 align-middle">
          <button
            type="button"
            className="p-1 rounded text-muted-foreground hover:bg-muted/80 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
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
            onClick={(e) => {
              e.stopPropagation();
              menuOpen ? setMenuOpen(false) : openMenu();
            }}
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
              sourceType="headline"
              onOpenCreate={onOpenCreate}
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
  onOpenEdit,
  onOpenCreate,
  onCreateClick,
}: {
  items: CascadingMessageItem[];
  teamName: string;
  onOpenEdit: (id: string) => void;
  onOpenCreate?: (type: CreatePopupType, options?: OpenCreateOptions) => void;
  onCreateClick: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">
          Flight Directives {items.length}
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
                <CascadingRow key={item.id} item={item} onOpenEdit={onOpenEdit} onOpenCreate={onOpenCreate} />
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
          + Create Flight Directive
        </button>
      </div>
    </div>
  );
}

function CascadingRow({ item, onOpenEdit, onOpenCreate }: { item: CascadingMessageItem; onOpenEdit: (id: string) => void; onOpenCreate?: (type: CreatePopupType, options?: OpenCreateOptions) => void }) {
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
        className={`border-b border-border hover:bg-muted/10 cursor-pointer ${isDragging ? 'opacity-50 bg-muted/20' : ''}`}
        onClick={() => onOpenEdit(item.id)}
      >
        <td className="px-4 py-2 w-10 align-middle">
          <button
            type="button"
            className="p-1 rounded text-muted-foreground hover:bg-muted/80 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
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
            onClick={(e) => {
              e.stopPropagation();
              menuOpen ? setMenuOpen(false) : openMenu();
            }}
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
              sourceType="cascading_message"
              onOpenCreate={onOpenCreate}
            />
          )}
        </td>
      </tr>
    </>
  );
}

function ownerInitialsFromLabel(name?: string | null, email?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

function HeadlineDetailPanel({
  item,
  owners,
  onOpenCreate,
  onClose,
  onSave,
  onArchive,
  onDelete,
}: {
  item: HeadlineItem;
  owners: Array<{ id: string; name?: string | null; email?: string }>;
  onOpenCreate?: (type: CreatePopupType, options?: OpenCreateOptions) => void;
  onClose: () => void;
  onSave: (patch: { title?: string; description?: string; ownerInitials?: string; linkedEntityType?: string | null; linkedEntityId?: string | null; linkedEntityTitle?: string | null; comments?: Array<{ id: string; text: string; authorInitials?: string; authorName?: string; createdAt: string }>; attachments?: Array<{ id: string; name: string; uploadedAt: string }>; archived?: boolean }) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? '');
  const [ownerInitials, setOwnerInitials] = useState(item.ownerInitials);
  const [comments, setComments] = useState<Array<{ id: string; text: string; authorInitials?: string; authorName?: string; createdAt: string }>>(
    Array.isArray(item.comments) ? item.comments : []
  );
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; uploadedAt: string }>>(
    Array.isArray(item.attachments) ? item.attachments : []
  );
  const [newComment, setNewComment] = useState('');
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTitle(item.title);
    setDescription(item.description ?? '');
    setOwnerInitials(item.ownerInitials);
    setComments(Array.isArray(item.comments) ? item.comments : []);
    setAttachments(Array.isArray(item.attachments) ? item.attachments : []);
  }, [item.id, item.title, item.description, item.ownerInitials, item.comments, item.attachments]);

  const ownerCandidates = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase();
    return owners.filter((m) => {
      if (!q) return true;
      const label = `${m.name ?? ''} ${m.email ?? ''}`.toLowerCase();
      return label.includes(q);
    });
  }, [owners, ownerSearch]);

  const ownerLabel =
    owners.find((o) => ownerInitialsFromLabel(o.name, o.email) === ownerInitials)?.name ||
    owners.find((o) => ownerInitialsFromLabel(o.name, o.email) === ownerInitials)?.email ||
    ownerInitials ||
    'No owner';

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 right-0 w-[42%] min-w-[380px] max-w-[620px] bg-card border-l border-border shadow-xl z-50 flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-foreground">Edit Flight Announcement</h2>
          <div className="flex items-center gap-2">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => {
                if (menuOpen) setMenuOpen(false);
                else if (menuButtonRef.current) {
                  setMenuRect(menuButtonRef.current.getBoundingClientRect());
                  setMenuOpen(true);
                }
              }}
              className="p-2 rounded-md hover:bg-muted text-muted-foreground"
              aria-label="More options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOwnerPickerOpen((v) => !v)}
                className="w-9 h-9 rounded-full bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-xs font-semibold text-primary hover:bg-primary/20"
                title={`Owner: ${ownerLabel}`}
                aria-label="Change owner"
              >
                {ownerInitials || '?'}
              </button>
              {ownerPickerOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOwnerPickerOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full mt-2 z-20 w-[280px] bg-card border border-border rounded-lg shadow-xl p-2">
                    <input
                      type="text"
                      value={ownerSearch}
                      onChange={(e) => setOwnerSearch(e.target.value)}
                      placeholder="Search crew member..."
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm mb-2"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setOwnerInitials('?');
                        setOwnerPickerOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded hover:bg-muted text-sm text-muted-foreground"
                    >
                      No owner
                    </button>
                    <div className="max-h-60 overflow-auto">
                      {ownerCandidates.map((m) => {
                        const initials = ownerInitialsFromLabel(m.name, m.email);
                        const label = m.name || m.email || initials;
                        const isSelected = ownerInitials === initials;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setOwnerInitials(initials);
                              setOwnerPickerOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded flex items-center gap-2 text-sm ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}
                          >
                            <span className="w-6 h-6 rounded-full bg-muted inline-flex items-center justify-center text-xs">{initials}</span>
                            <span className="truncate">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-muted text-muted-foreground" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
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
            <label className="block text-sm font-medium text-foreground mb-1">Description (optional)</label>
            <RichTextEditor value={description} onChange={setDescription} />
          </div>
          <div className="border-t border-border" />
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Flight Crew</label>
            <Select value="crew" options={[{ label: 'Current Flight Crew', value: 'crew' }]} disabled className="w-full" />
          </div>
          <section className="pt-2 mt-2 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-foreground">Linked Items {item.linkedEntityTitle ? 1 : 0}</h4>
              {item.linkedEntityTitle && (
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => onSave({ linkedEntityType: null, linkedEntityId: null, linkedEntityTitle: null })}
                >
                  Remove
                </button>
              )}
            </div>
            {item.linkedEntityTitle ? (
              <div className="border border-border rounded-lg bg-muted/30 p-3 text-sm">
                <div className="text-xs text-muted-foreground">{item.linkedEntityType || 'linked item'}</div>
                <div className="font-medium text-foreground">{item.linkedEntityTitle}</div>
              </div>
            ) : (
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() =>
                  onOpenCreate?.('cascading_message', getLinkedCreateOptions({ id: item.id, title: item.title }, 'headline', 'cascading_message'))
                }
              >
                + Linked Flight Directive
              </button>
            )}
          </section>
          <section className="pt-2 mt-2 border-t border-border">
            <h4 className="font-medium text-foreground mb-3">Attachments {attachments.length}</h4>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
              Drag and drop files to attach, or{' '}
              <label className="text-primary hover:underline cursor-pointer">
                browse
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (!files.length) return;
                    const next = [
                      ...attachments,
                      ...files.map((f) => ({ id: `${Date.now()}-${f.name}`, name: f.name, uploadedAt: new Date().toISOString() })),
                    ];
                    setAttachments(next);
                    onSave({ attachments: next });
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            {attachments.length > 0 && (
              <div className="mt-3 space-y-1">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{a.name}</span>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => {
                        const next = attachments.filter((x) => x.id !== a.id);
                        setAttachments(next);
                        onSave({ attachments: next });
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="pt-2 mt-2 border-t border-border">
            <h4 className="font-medium text-foreground mb-3">Comments {comments.length}</h4>
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground shrink-0">{ownerInitials || '?'}</div>
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2.5 border border-border rounded-md bg-background text-foreground text-sm"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const text = newComment.trim();
                  if (!text) return;
                  const next = [...comments, { id: `${Date.now()}`, text, authorInitials: ownerInitials || '?', authorName: ownerLabel, createdAt: new Date().toISOString() }];
                  setComments(next);
                  setNewComment('');
                  onSave({ comments: next });
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right mt-2">0/10000</p>
            {comments.length > 0 && (
              <div className="mt-3 space-y-2">
                {comments.map((c) => (
                  <div key={c.id} className="text-sm border border-border rounded-md p-2">
                    <div className="text-xs text-muted-foreground">{c.authorName || c.authorInitials || 'User'} · {formatRelativeTime(c.createdAt)}</div>
                    <div>{c.text}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <p className="text-xs text-muted-foreground">Created by {ownerLabel} on {formatDateTime(item.createdAt)}</p>
        </div>
        <footer className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border bg-background text-foreground text-sm font-medium hover:bg-muted">Cancel</button>
          <button
            type="button"
            onClick={() => {
              onSave({ title: title.trim() || item.title, description, ownerInitials, comments, attachments });
              onClose();
            }}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Save
          </button>
        </footer>
      </div>
      {menuOpen && menuRect && (
        <HeadlineRowMenu
          anchorRect={menuRect}
          onClose={() => setMenuOpen(false)}
          item={item}
          onArchive={() => {
            onArchive();
            onClose();
          }}
          onDelete={() => {
            onDelete();
            onClose();
          }}
          includeCascade
          sourceType="headline"
          onOpenCreate={onOpenCreate}
        />
      )}
    </>
  );
}

function CascadingDetailPanel({
  item,
  teamName,
  owners,
  onOpenCreate,
  onClose,
  onSave,
  onArchive,
  onDelete,
}: {
  item: CascadingMessageItem;
  teamName: string;
  owners: Array<{ id: string; name?: string | null; email?: string }>;
  onOpenCreate?: (type: CreatePopupType, options?: OpenCreateOptions) => void;
  onClose: () => void;
  onSave: (patch: { title?: string; description?: string; from?: string; ownerInitials?: string; linkedEntityType?: string | null; linkedEntityId?: string | null; linkedEntityTitle?: string | null; comments?: Array<{ id: string; text: string; authorInitials?: string; authorName?: string; createdAt: string }>; attachments?: Array<{ id: string; name: string; uploadedAt: string }>; archived?: boolean }) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? '');
  const [from, setFrom] = useState(item.from || teamName);
  const [ownerInitials, setOwnerInitials] = useState(item.ownerInitials);
  const [comments, setComments] = useState<Array<{ id: string; text: string; authorInitials?: string; authorName?: string; createdAt: string }>>(
    Array.isArray(item.comments) ? item.comments : []
  );
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; uploadedAt: string }>>(
    Array.isArray(item.attachments) ? item.attachments : []
  );
  const [newComment, setNewComment] = useState('');
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTitle(item.title);
    setDescription(item.description ?? '');
    setFrom(item.from || teamName);
    setOwnerInitials(item.ownerInitials);
    setComments(Array.isArray(item.comments) ? item.comments : []);
    setAttachments(Array.isArray(item.attachments) ? item.attachments : []);
  }, [item.id, item.title, item.description, item.from, item.ownerInitials, item.comments, item.attachments, teamName]);

  const ownerCandidates = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase();
    return owners.filter((m) => {
      if (!q) return true;
      const label = `${m.name ?? ''} ${m.email ?? ''}`.toLowerCase();
      return label.includes(q);
    });
  }, [owners, ownerSearch]);

  const ownerLabel =
    owners.find((o) => ownerInitialsFromLabel(o.name, o.email) === ownerInitials)?.name ||
    owners.find((o) => ownerInitialsFromLabel(o.name, o.email) === ownerInitials)?.email ||
    ownerInitials ||
    'No owner';

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 right-0 w-[42%] min-w-[380px] max-w-[620px] bg-card border-l border-border shadow-xl z-50 flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-foreground">Edit Flight Directive</h2>
          <div className="flex items-center gap-2">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => {
                if (menuOpen) setMenuOpen(false);
                else if (menuButtonRef.current) {
                  setMenuRect(menuButtonRef.current.getBoundingClientRect());
                  setMenuOpen(true);
                }
              }}
              className="p-2 rounded-md hover:bg-muted text-muted-foreground"
              aria-label="More options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOwnerPickerOpen((v) => !v)}
                className="w-9 h-9 rounded-full bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-xs font-semibold text-primary hover:bg-primary/20"
                title={`Owner: ${ownerLabel}`}
                aria-label="Change owner"
              >
                {ownerInitials || '?'}
              </button>
              {ownerPickerOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOwnerPickerOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full mt-2 z-20 w-[280px] bg-card border border-border rounded-lg shadow-xl p-2">
                    <input
                      type="text"
                      value={ownerSearch}
                      onChange={(e) => setOwnerSearch(e.target.value)}
                      placeholder="Search crew member..."
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm mb-2"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setOwnerInitials('?');
                        setOwnerPickerOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded hover:bg-muted text-sm text-muted-foreground"
                    >
                      No owner
                    </button>
                    <div className="max-h-60 overflow-auto">
                      {ownerCandidates.map((m) => {
                        const initials = ownerInitialsFromLabel(m.name, m.email);
                        const label = m.name || m.email || initials;
                        const isSelected = ownerInitials === initials;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setOwnerInitials(initials);
                              setOwnerPickerOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded flex items-center gap-2 text-sm ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}
                          >
                            <span className="w-6 h-6 rounded-full bg-muted inline-flex items-center justify-center text-xs">{initials}</span>
                            <span className="truncate">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-muted text-muted-foreground" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
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
            <label className="block text-sm font-medium text-foreground mb-1">Description (optional)</label>
            <RichTextEditor value={description} onChange={setDescription} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">From</label>
            <input
              type="text"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
            />
          </div>
          <div className="border-t border-border" />
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Flight Crew</label>
            <Select value="crew" options={[{ label: teamName || 'Current Flight Crew', value: 'crew' }]} disabled className="w-full" />
          </div>
          <section className="pt-2 mt-2 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-foreground">Linked Items {item.linkedEntityTitle ? 1 : 0}</h4>
              {item.linkedEntityTitle && (
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => onSave({ linkedEntityType: null, linkedEntityId: null, linkedEntityTitle: null })}
                >
                  Remove
                </button>
              )}
            </div>
            {item.linkedEntityTitle ? (
              <div className="border border-border rounded-lg bg-muted/30 p-3 text-sm">
                <div className="text-xs text-muted-foreground">{item.linkedEntityType || 'linked item'}</div>
                <div className="font-medium text-foreground">{item.linkedEntityTitle}</div>
              </div>
            ) : (
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() =>
                  onOpenCreate?.('headline', getLinkedCreateOptions({ id: item.id, title: item.title }, 'cascading_message', 'headline'))
                }
              >
                + Linked Announcement
              </button>
            )}
          </section>
          <section className="pt-2 mt-2 border-t border-border">
            <h4 className="font-medium text-foreground mb-3">Attachments {attachments.length}</h4>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
              Drag and drop files to attach, or{' '}
              <label className="text-primary hover:underline cursor-pointer">
                browse
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (!files.length) return;
                    const next = [
                      ...attachments,
                      ...files.map((f) => ({ id: `${Date.now()}-${f.name}`, name: f.name, uploadedAt: new Date().toISOString() })),
                    ];
                    setAttachments(next);
                    onSave({ attachments: next });
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            {attachments.length > 0 && (
              <div className="mt-3 space-y-1">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{a.name}</span>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => {
                        const next = attachments.filter((x) => x.id !== a.id);
                        setAttachments(next);
                        onSave({ attachments: next });
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="pt-2 mt-2 border-t border-border">
            <h4 className="font-medium text-foreground mb-3">Comments {comments.length}</h4>
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground shrink-0">{ownerInitials || '?'}</div>
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2.5 border border-border rounded-md bg-background text-foreground text-sm"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const text = newComment.trim();
                  if (!text) return;
                  const next = [...comments, { id: `${Date.now()}`, text, authorInitials: ownerInitials || '?', createdAt: new Date().toISOString() }];
                  setComments(next);
                  setNewComment('');
                  onSave({ comments: next });
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right mt-2">0/10000</p>
            {comments.length > 0 && (
              <div className="mt-3 space-y-2">
                {comments.map((c) => (
                  <div key={c.id} className="text-sm border border-border rounded-md p-2">
                    <div className="text-xs text-muted-foreground">{c.authorName || c.authorInitials || 'User'} · {formatRelativeTime(c.createdAt)}</div>
                    <div>{c.text}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <p className="text-xs text-muted-foreground">Created by {ownerLabel} on {formatDateTime(item.createdAt)}</p>
        </div>
        <footer className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border bg-background text-foreground text-sm font-medium hover:bg-muted">Cancel</button>
          <button
            type="button"
            onClick={() => {
              onSave({ title: title.trim() || item.title, description, from: from.trim() || teamName, ownerInitials, comments, attachments });
              onClose();
            }}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Save
          </button>
        </footer>
      </div>
      {menuOpen && menuRect && (
        <HeadlineRowMenu
          anchorRect={menuRect}
          onClose={() => setMenuOpen(false)}
          item={{ id: item.id, title: item.title }}
          onArchive={() => {
            onArchive();
            onClose();
          }}
          onDelete={() => {
            onDelete();
            onClose();
          }}
          includeCascade={false}
          sourceType="cascading_message"
          onOpenCreate={onOpenCreate}
        />
      )}
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
  sourceType,
  onOpenCreate,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  item: { id: string; title: string };
  onArchive: () => void;
  onDelete: () => void;
  includeCascade: boolean;
  sourceType: 'headline' | 'cascading_message';
  onOpenCreate?: (type: CreatePopupType, options?: OpenCreateOptions) => void;
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
            <button
              type="button"
              className={btn}
              onClick={() => {
                onOpenCreate?.('cascading_message', getLinkedCreateOptions(item, sourceType, 'cascading_message'));
                onClose();
              }}
              role="menuitem"
            >
              <Send className={icon} />
              Create linked Flight Directive
            </button>
          )}
          <button type="button" className={btn} onClick={() => { onOpenCreate?.('rock', getLinkedCreateOptions(item, sourceType, 'rock')); onClose(); }} role="menuitem">
            <Mountain className={icon} />
            Create linked Waypoint
          </button>
          <button type="button" className={btn} onClick={() => { onOpenCreate?.('todo', getLinkedCreateOptions(item, sourceType, 'todo')); onClose(); }} role="menuitem">
            <CheckSquare className={icon} />
            Create linked Clearance
          </button>
          <button type="button" className={btn} onClick={() => { onOpenCreate?.('issue', getLinkedCreateOptions(item, sourceType, 'issue')); onClose(); }} role="menuitem">
            <AlertCircle className={icon} />
            Create linked Turbulence
          </button>
          <button type="button" className={btn} onClick={() => { onOpenCreate?.('headline', getLinkedCreateOptions(item, sourceType, 'headline')); onClose(); }} role="menuitem">
            <Megaphone className={icon} />
            Create linked Announcement
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
