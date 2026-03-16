'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  CheckCircle2,
  Circle,
  AlertCircle,
  Megaphone,
  Archive,
  Link2,
  Trash2,
  RotateCw,
  FileDown,
  Download,
  Package,
  Pencil,
  Calendar,
  ChevronUp,
  ChevronDown,
  X,
  User,
  Loader2,
  Check,
} from 'lucide-react';
import dayjs, { type Dayjs } from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { MobileDatePicker } from '@mui/x-date-pickers/MobileDatePicker';
import { useTodos, type TodoItem } from '@/contexts/TodosContext';
import { RichTextEditor } from './RichTextEditor';
import { ContentAreaLoader } from '@/components/ui/loaders';
import { teamsService } from '@/lib/api/teams.service';
import type { TeamMember } from '@/lib/api/teams.service';

const datePickerTextFieldSx = {
  '& .MuiInputLabel-root': { color: 'var(--foreground) !important', '&.Mui-focused': { color: 'var(--primary) !important' } },
  '& .MuiOutlinedInput-root': {
    backgroundColor: 'var(--background)',
    color: 'var(--foreground) !important',
    '& fieldset': { borderColor: 'var(--border)' },
    '&:hover fieldset': { borderColor: 'var(--foreground)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--primary)', borderWidth: '1px' },
  },
  '& .MuiInputBase-input': { color: 'var(--foreground) !important', WebkitTextFillColor: 'var(--foreground)' },
  '& .MuiIconButton-root': { color: 'var(--foreground) !important' },
};

const MENU_WIDTH = 248;
const MENU_GAP = 8;
const PAGE_SIZES = [10, 25, 50, 100];

type CreatePopupType = 'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message';

interface TodosSegmentViewProps {
  teamName?: string;
  /** Current team id (for edit-todo team dropdown initial value) */
  teamId?: string | null;
  /** All teams (for edit-todo team dropdown) */
  teams?: Array<{ id: string; name: string }>;
  /** Organization id (for edit-todo team member fetch) */
  organizationId?: string | null;
  embedded?: boolean;
  meetingId?: string;
  isFacilitator?: boolean;
  /** Scribe or facilitator can change filters and create (recording) */
  canRecord?: boolean;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; linkedEntity?: { type: 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message'; id: string; title: string } }) => void;
  /** Meeting attendees for Owner multi-select (id, user with id, name, email) */
  meetingAttendances?: Array<{ id: string; user: { id: string; name?: string | null; email: string } }>;
}

function formatDueDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function linkedEntityTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Item';
  const map: Record<string, string> = {
    issue: 'Turbulence (Issue)',
    rock: 'Waypoint (Rock)',
    todo: 'Clearance (To-Do)',
    headline: 'Headline',
    cascading_message: 'Cascading message',
  };
  return map[type] ?? type;
}

function getInitials(name?: string | null, email?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

export function TodosSegmentView({
  teamName = 'Leadership Team',
  teamId: currentTeamId,
  teams = [],
  organizationId,
  embedded = false,
  meetingId,
  isFacilitator = true,
  canRecord,
  onOpenCreate,
  meetingAttendances = [],
}: TodosSegmentViewProps) {
  const canUseFilters = canRecord ?? isFacilitator;
  const [teamFilter, setTeamFilter] = useState(teamName);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<Set<string>>(new Set(['all']));
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);
  const [archiveOn, setArchiveOn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [page, setPage] = useState(0);
  const [editTodoId, setEditTodoId] = useState<string | null>(null);
  const ownerDropdownRef = useRef<HTMLDivElement>(null);

  const { socket } = useMeetingSocket();

  useEffect(() => {
    setTeamFilter(teamName);
  }, [teamName]);

  useEffect(() => {
    if (!socket || !meetingId) return;
    const onTodosFilter = (payload: {
      teamFilter?: string;
      archiveOn?: boolean;
      searchQuery?: string;
    }) => {
      if (payload.teamFilter !== undefined) setTeamFilter(payload.teamFilter);
      if (payload.archiveOn !== undefined) setArchiveOn(payload.archiveOn);
      if (payload.searchQuery !== undefined) setSearchQuery(payload.searchQuery);
    };
    socket.on('todos_filter', onTodosFilter);
    return () => {
      socket.off('todos_filter', onTodosFilter);
    };
  }, [socket, meetingId]);

  const {
    todos,
    addTodo,
    updateTodo,
    deleteTodo,
    reorderTodos,
    moveToTop,
    moveToBottom,
    archiveTodo,
    setCompleted,
    isLoading,
    refetch,
  } = useTodos();

  const [isAddingTodo, setIsAddingTodo] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [isSavingTodo, setIsSavingTodo] = useState(false);

  const activeTodos = useMemo(
    () => todos.filter((t) => !t.archived).sort((a, b) => a.order - b.order),
    [todos]
  );
  const archivedTodos = useMemo(
    () => todos.filter((t) => t.archived),
    [todos]
  );

  const filteredTodos = useMemo(() => {
    let list = archiveOn ? archivedTodos : activeTodos;
    const seen = new Set<string>();
    list = list.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
    const showAllOwners = selectedOwnerIds.has('all') || selectedOwnerIds.size === 0;
    if (!showAllOwners) {
      list = list.filter((t) => t.assigneeId && selectedOwnerIds.has(t.assigneeId));
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((t) => t.title.toLowerCase().includes(q));
  }, [archiveOn, activeTodos, archivedTodos, searchQuery, selectedOwnerIds]);

  const downloadTodosCsv = useCallback(() => {
    const headers = ['Title', 'Due By', 'Owner', 'Status'];
    const rows = filteredTodos.map((t) => [
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.dueDate ?? '—',
      t.ownerInitials ?? '—',
      t.completed ? 'Done' : 'Open',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todos-${archiveOn ? 'archived' : 'active'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredTodos, archiveOn]);

  const handleAchieveAllCompleted = useCallback(() => {
    const toArchive = filteredTodos.filter((t) => t.completed);
    toArchive.forEach((t) => archiveTodo(t.id));
  }, [filteredTodos, archiveTodo]);

  const todoIds = useMemo(() => filteredTodos.map((t) => t.id), [filteredTodos]);
  const totalItems = filteredTodos.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredTodos.slice(start, start + itemsPerPage);
  }, [filteredTodos, currentPage, itemsPerPage]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const from = todoIds.indexOf(activeId);
    const to = todoIds.indexOf(overId);
    if (from !== -1 && to !== -1) reorderTodos(from, to);
  };

  const handleAddTodo = () => {
    if (onOpenCreate) {
      onOpenCreate('todo');
      return;
    }
    setIsAddingTodo(true);
    setNewTodoTitle('');
  };

  const handleSaveNewTodo = async () => {
    const title = newTodoTitle.trim() || 'New to-do';
    setIsSavingTodo(true);
    try {
      await addTodo({
        title,
        dueDate: new Date().toISOString().slice(0, 10),
        ownerInitials: 'GS',
        completed: false,
      });
      setIsAddingTodo(false);
      setNewTodoTitle('');
    } finally {
      setIsSavingTodo(false);
    }
  };

  const handleCancelNewTodo = () => {
    setIsAddingTodo(false);
    setNewTodoTitle('');
  };

  const wrap = embedded ? 'pt-0 pb-4' : 'pt-0 pb-6';
  const contentPad = embedded ? 'px-4' : 'px-6';
  return (
    <div className={`flex flex-col min-h-0 h-full ${wrap}`}>
      {/* Filter bar — full width, no padding on this div */}
      <div className="flex flex-wrap items-center gap-3 py-3 -mx-6 px-4 border-t border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-sm">Team:</span>
          <Select
            value={teamFilter}
            onChange={(v) => {
              setTeamFilter(v ?? teamName);
              if (meetingId && socket) socket.emit('todos_filter', { meetingId, teamFilter: v ?? teamName });
            }}
            disabled={!canUseFilters}
            options={[{ label: teamName, value: teamName }]}
            className="w-[160px]"
          />
        </div>
        <div className="flex items-center gap-1 relative" ref={ownerDropdownRef}>
          <span className="text-muted-foreground text-sm">Owner:</span>
          <button
            type="button"
            disabled={!canUseFilters}
            onClick={() => setOwnerDropdownOpen((o) => !o)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-md bg-background hover:bg-muted/50 text-sm text-foreground min-w-[120px] justify-between cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span className="truncate">
              {selectedOwnerIds.has('all') || selectedOwnerIds.size === 0
                ? 'All'
                : selectedOwnerIds.size === 1
                  ? meetingAttendances.find((a) => a.user.id === [...selectedOwnerIds][0])?.user?.name ?? 'Selected'
                  : `${selectedOwnerIds.size} selected`}
            </span>
            {ownerDropdownOpen ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
          </button>
          {ownerDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOwnerDropdownOpen(false)} aria-hidden />
              <div className="absolute left-0 top-full mt-1 z-20 py-2 bg-card border border-border rounded-lg shadow-xl min-w-[200px] max-h-[280px] overflow-y-auto">
                <label className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedOwnerIds.has('all') || selectedOwnerIds.size === 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedOwnerIds(new Set(['all']));
                      else setSelectedOwnerIds(new Set());
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-sm font-medium text-foreground">All</span>
                </label>
                {meetingAttendances.map((att) => {
                  const uid = att.user.id;
                  const name = att.user.name || att.user.email || 'User';
                  const initials = getInitials(att.user.name, att.user.email);
                  const checked = selectedOwnerIds.has(uid);
                  return (
                    <label key={att.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedOwnerIds((prev) => {
                            const next = new Set(prev);
                            if (next.has('all')) next.delete('all');
                            if (checked) next.delete(uid);
                            else next.add(uid);
                            if (next.size === 0) next.add('all');
                            return next;
                          });
                        }}
                        className="rounded border-border"
                      />
                      <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs text-foreground shrink-0">{initials}</span>
                      <span className="text-sm text-foreground truncate">{name}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <label className={`flex items-center gap-2 group ${!canUseFilters ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
          <span className="text-sm text-foreground group-hover:text-foreground/90">Archive</span>
          <button
            type="button"
            role="switch"
            aria-checked={archiveOn}
            disabled={!canUseFilters}
            onClick={() => {
              setArchiveOn((o) => {
                const next = !o;
                if (meetingId && socket) socket.emit('todos_filter', { meetingId, archiveOn: next });
                return next;
              });
            }}
            className={`relative w-11 h-6 rounded-full transition-colors border-2 flex items-center ${!canUseFilters ? 'cursor-not-allowed' : ''} ${
              archiveOn
                ? 'bg-muted border-border justify-end'
                : 'bg-muted border-border justify-start hover:bg-muted/80'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow border border-border shrink-0 m-0.5" />
          </button>
        </label>
        <span className="flex-1" />
        <button
          type="button"
          disabled={!canUseFilters}
          onClick={() => refetch()}
          title="Refresh the to-do list"
          className="p-2 rounded-lg border border-border transition-colors cursor-pointer hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={!canUseFilters}
          onClick={downloadTodosCsv}
          title="Download to-dos as CSV"
          className="p-2 rounded-lg border border-border transition-colors cursor-pointer hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={!canUseFilters}
          onClick={() => window.print()}
          title="Print / Download PDF"
          className="p-2 rounded-lg border border-border transition-colors cursor-pointer hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <FileDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={!canUseFilters || filteredTodos.filter((t) => t.completed).length === 0}
          onClick={handleAchieveAllCompleted}
          title="Archive all completed to-dos in this list"
          className="p-2 rounded-lg border border-border transition-colors cursor-pointer hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <Package className="w-4 h-4" />
        </button>
        <div className="min-w-[200px]">
          <Input.Search
            placeholder="Search to-dos..."
            value={searchQuery}
            onChange={(e) => {
              const v = e.target.value;
              setSearchQuery(v);
              if (meetingId && socket) socket.emit('todos_filter', { meetingId, searchQuery: v });
            }}
            disabled={!canUseFilters}
            allowClear
            className="w-full"
          />
        </div>
      </div>

      {/* Content: padding after filter bar — or full-area loader when fetching */}
      {isLoading ? (
        <ContentAreaLoader label="Loading to-dos…" />
      ) : (
      <div className={`flex-1 overflow-auto min-h-0 mt-6 ${contentPad}`}>
      <div className="bg-card border border-border rounded-lg flex flex-col flex-1 min-h-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">
            Team Clearances (To-Dos) {filteredTodos.length}
          </h3>
          <button
            type="button"
            className="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
            aria-label="Expand"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto flex-1 relative">
          <DndContext onDragEnd={handleDragEnd} collisionDetection={pointerWithin}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-10 px-4 py-2" />
                  <th className="w-8 px-4 py-2" />
                  <th className="text-left font-medium text-foreground px-4 py-2">
                    Title
                  </th>
                  <th className="text-left font-medium text-foreground px-4 py-2 w-24">
                    Due By
                  </th>
                  <th className="text-left font-medium text-foreground px-4 py-2 w-20">
                    Owner
                  </th>
                  <th className="text-right font-medium text-foreground px-4 py-2 w-14" />
                </tr>
              </thead>
              <tbody>
                {isAddingTodo && (
                  <tr className="border-b border-border bg-primary/5">
                    <td className="px-4 py-2 w-10" />
                    <td className="px-4 py-2 w-8">
                      <Circle className="w-5 h-5 text-muted-foreground" />
                    </td>
                    <td className="px-4 py-2" colSpan={2}>
                      <input
                        type="text"
                        placeholder="Type to-do title..."
                        value={newTodoTitle}
                        onChange={(e) => setNewTodoTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveNewTodo();
                          if (e.key === 'Escape') handleCancelNewTodo();
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
                          onClick={handleCancelNewTodo}
                          disabled={isSavingTodo}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-50"
                          aria-label="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNewTodo}
                          disabled={isSavingTodo}
                          className="p-1.5 rounded hover:bg-primary/20 text-primary disabled:opacity-50 flex items-center gap-1"
                          aria-label="Save"
                        >
                          {isSavingTodo ? (
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
                  items={todoIds}
                  strategy={verticalListSortingStrategy}
                >
                  {pageItems.map((item) => (
                    <TodoRow
                      key={item.id}
                      item={item}
                      onEdit={() => setEditTodoId(item.id)}
                      onToggleComplete={(completed) =>
                        setCompleted(item.id, completed)
                      }
                      onUpdateDueDate={(dueDate) =>
                        updateTodo(item.id, { dueDate })
                      }
                      onArchive={() => archiveTodo(item.id)}
                      onDelete={() => deleteTodo(item.id)}
                      onMoveToTop={() => moveToTop(item.id)}
                      onMoveToBottom={() => moveToBottom(item.id)}
                      onOpenCreate={onOpenCreate}
                    />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>
        </div>
        <div className="p-3 border-t border-border flex items-center justify-between flex-wrap gap-2">
          {!isAddingTodo && (
            <button
              type="button"
              onClick={handleAddTodo}
              className="text-primary hover:underline text-sm font-medium hover:text-primary/90 transition-colors cursor-pointer"
            >
              + Add To-Do
            </button>
          )}
          {isAddingTodo && (
            <span className="text-sm text-muted-foreground">Type title above and click ✓ to save</span>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              Items per page:
              <Select
                value={itemsPerPage}
                onChange={(v) => {
                  setItemsPerPage(v);
                  setPage(0);
                }}
                options={PAGE_SIZES.map((n) => ({ label: String(n), value: n }))}
                className="w-[70px]"
              />
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
                aria-label="Previous page"
              >
                &lt;
              </button>
              <button
                type="button"
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
                disabled={currentPage >= totalPages - 1}
                className="p-1.5 rounded hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Next page"
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
      )}

      {/* Edit To-Do right panel */}
      {editTodoId && (
        <EditTodoPanel
          todo={todos.find((t) => t.id === editTodoId)!}
          onClose={() => setEditTodoId(null)}
          onUpdate={(patch) => updateTodo(editTodoId, patch)}
          teams={teams}
          currentTeamId={currentTeamId}
          organizationId={organizationId}
        />
      )}
    </div>
  );
}

function TodoRow({
  item,
  onEdit,
  onToggleComplete,
  onUpdateDueDate,
  onArchive,
  onDelete,
  onMoveToTop,
  onMoveToBottom,
  onOpenCreate,
}: {
  item: TodoItem;
  onEdit: () => void;
  onToggleComplete: (completed: boolean) => void;
  onUpdateDueDate: (dueDate: string | null) => void;
  onArchive: () => void;
  onDelete: () => void;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; linkedEntity?: { type: 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message'; id: string; title: string } }) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [hoverTitle, setHoverTitle] = useState(false);
  const [hoverDate, setHoverDate] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

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
          <button
            type="button"
            onClick={() => onToggleComplete(!item.completed)}
            className="rounded-full w-6 h-6 flex items-center justify-center hover:bg-muted/80 text-muted-foreground hover:text-foreground"
            aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
          >
            {item.completed ? (
              <CheckCircle2 className="w-5 h-5 text-primary" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>
        </td>
        <td
          className="px-4 py-2 font-medium text-foreground align-middle cursor-pointer group"
          onMouseEnter={() => setHoverTitle(true)}
          onMouseLeave={() => setHoverTitle(false)}
          onClick={onEdit}
        >
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span>{item.title}</span>
              {hoverTitle && (
                <Pencil className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
            </div>
            {item.linkedEntityTitle && (
              <span className="text-xs text-muted-foreground">Linked to: {item.linkedEntityTitle}</span>
            )}
          </div>
        </td>
        <td
          className="px-4 py-2 text-muted-foreground align-middle relative"
          onMouseEnter={() => setHoverDate(true)}
          onMouseLeave={() => setHoverDate(false)}
        >
          <div className="flex items-center gap-1">
            <span>{formatDueDate(item.dueDate)}</span>
            {hoverDate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDatePickerOpen((o) => !o);
                }}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                aria-label="Change date"
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {datePickerOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 p-2 bg-card border border-border rounded-lg shadow-lg">
              <input
                type="date"
                defaultValue={item.dueDate || ''}
                onChange={(e) => {
                  onUpdateDueDate(e.target.value || null);
                  setDatePickerOpen(false);
                }}
                onBlur={() => setDatePickerOpen(false)}
                className="px-2 py-1 border border-border rounded bg-background text-foreground text-sm"
              />
            </div>
          )}
        </td>
        <td className="px-4 py-2 align-middle">
          {item.assigneeId ? (
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground" title="Assigned">
              {item.ownerInitials}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
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
            <TodoRowMenu
              anchorRect={anchorRect}
              item={item}
              onClose={() => {
                setMenuOpen(false);
                setAnchorRect(null);
              }}
              onMoveToTop={onMoveToTop}
              onMoveToBottom={onMoveToBottom}
              onArchive={onArchive}
              onDelete={onDelete}
              onOpenCreate={onOpenCreate}
            />
          )}
        </td>
      </tr>
    </>
  );
}

function TodoRowMenu({
  anchorRect,
  item,
  onClose,
  onMoveToTop,
  onMoveToBottom,
  onArchive,
  onDelete,
  onOpenCreate,
}: {
  anchorRect: DOMRect;
  item: TodoItem;
  onClose: () => void;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; linkedEntity?: { type: 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message'; id: string; title: string } }) => void;
}) {
  const linkedTodo = useMemo(() => ({ type: 'todo' as const, id: item.id, title: item.title }), [item.id, item.title]);
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
          <button
            type="button"
            className={btn}
            onClick={() => {
              onMoveToTop();
              onClose();
            }}
            role="menuitem"
          >
            <ChevronUp className={icon} />
            Top of List
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => {
              onMoveToBottom();
              onClose();
            }}
            role="menuitem"
          >
            <ChevronDown className={icon} />
            Bottom of List
          </button>
        </div>
        <div className="border-t border-border my-1" />
        <div className="px-2 py-1">
          <button type="button" className={btn} onClick={() => { onOpenCreate?.('rock', { linkedEntity: linkedTodo }); onClose(); }} role="menuitem">
            <Mountain className={icon} />
            Link Waypoint (Rock)
          </button>
          <button type="button" className={btn} onClick={() => { onOpenCreate?.('todo', { title: `To-Do: ${item.title}`, linkedEntity: linkedTodo }); onClose(); }} role="menuitem">
            <CheckSquare className={icon} />
            Link To-Do
          </button>
          <button type="button" className={btn} onClick={() => { onOpenCreate?.('issue', { title: `Issue: ${item.title}`, linkedEntity: linkedTodo }); onClose(); }} role="menuitem">
            <AlertCircle className={icon} />
            Link Issue
          </button>
          <button type="button" className={btn} onClick={() => { onOpenCreate?.('headline', { title: item.title, linkedEntity: linkedTodo }); onClose(); }} role="menuitem">
            <Megaphone className={icon} />
            Link Headline
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

export function EditTodoPanel({
  todo,
  onClose,
  onUpdate,
  teams = [],
  currentTeamId,
  organizationId,
}: {
  todo: TodoItem;
  onClose: () => void;
  onUpdate: (patch: Partial<TodoItem>) => void;
  /** List of teams for the Team dropdown; when empty, a single "Leadership Team" option is shown */
  teams?: Array<{ id: string; name: string }>;
  /** Current team id (e.g. selected team or meeting team); used as initial value when todo has no teamId */
  currentTeamId?: string | null;
  /** Organization id for fetching team members when team changes */
  organizationId?: string | null;
}) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description || '');
  const [dueDateValue, setDueDateValue] = useState<Dayjs | null>(
    todo.dueDate ? dayjs(todo.dueDate) : null
  );
  const [repeat, setRepeat] = useState(todo.repeat || "Don't repeat");
  const [privateTodo, setPrivateTodo] = useState(todo.private ?? false);
  const teamOptions = teams.length > 0
    ? teams.map((t) => ({ label: t.name, value: t.id }))
    : [{ label: 'Leadership Team', value: 'Leadership Team' }];
  const initialTeamId = todo.teamId ?? currentTeamId ?? teams[0]?.id ?? teamOptions[0]?.value ?? '';
  const [teamId, setTeamId] = useState(initialTeamId);
  const [assigneeId, setAssigneeId] = useState<string>(todo.assigneeId ?? '');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    setTeamId(todo.teamId ?? currentTeamId ?? teams[0]?.id ?? (teams.length === 0 ? 'Leadership Team' : ''));
    setAssigneeId(todo.assigneeId ?? '');
  }, [todo.id, todo.teamId, todo.assigneeId, currentTeamId, teams]);

  useEffect(() => {
    const isTeamIdFromList = teams.some((t) => t.id === teamId);
    if (!organizationId || !teamId || !isTeamIdFromList) {
      setTeamMembers([]);
      return;
    }
    teamsService.getOne(organizationId, teamId).then((team) => setTeamMembers(team.members ?? [])).catch(() => setTeamMembers([]));
  }, [organizationId, teamId, teams]);

  const handleSave = (andClose = false) => {
    const isoDate = dueDateValue
      ? dueDateValue.toISOString().slice(0, 10)
      : null;
    const teamName = teams.find((t) => t.id === teamId)?.name ?? (teams.length === 0 && teamId ? String(teamId) : undefined);
    const isTeamIdFromList = teams.some((t) => t.id === teamId);
    onUpdate({
      title,
      description: description || undefined,
      dueDate: isoDate,
      repeat,
      private: privateTodo,
      ...(isTeamIdFromList && teamId && { teamId }),
      ...(teamName && { teamName }),
      assigneeId: assigneeId || undefined,
    });
    if (andClose) onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={handleCancel} aria-hidden />
    <div className="fixed inset-y-0 right-0 w-[42%] min-w-[380px] max-w-[620px] bg-card border-l border-border shadow-xl z-50 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onUpdate({ completed: !todo.completed })}
            className="rounded-full w-6 h-6 flex items-center justify-center hover:bg-muted/80 text-muted-foreground hover:text-foreground"
            aria-label={todo.completed ? 'Mark incomplete' : 'Mark complete'}
          >
            {todo.completed ? (
              <CheckCircle2 className="w-5 h-5 text-primary" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>
          <h2 className="font-semibold text-foreground">Edit To-Do</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-2 rounded-md hover:bg-muted text-muted-foreground"
            aria-label="More options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground">
            {todo.ownerInitials}
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {todo.linkedEntityTitle && (
          <div className="border border-border rounded-lg bg-muted/30 p-4 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Linked to
            </p>
            <div className="flex items-start gap-3">
              <Link2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-0.5">
                  {linkedEntityTypeLabel(todo.linkedEntityType)}
                </p>
                <p className="text-sm font-semibold text-foreground break-words">
                  {todo.linkedEntityTitle}
                </p>
              </div>
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Description (optional)
          </label>
          <RichTextEditor
            value={description}
            onChange={(v) => setDescription(v)}
            className="min-h-[120px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Due Date
          </label>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <MobileDatePicker
              value={dueDateValue}
              onChange={(v) => setDueDateValue(v)}
              slotProps={{
                textField: {
                  size: 'small',
                  fullWidth: true,
                  sx: datePickerTextFieldSx,
                  placeholder: 'Pick date',
                  inputProps: { style: { color: 'var(--foreground)' } },
                },
              }}
            />
          </LocalizationProvider>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Repeat
          </label>
          <Select
            value={repeat}
            onChange={setRepeat}
            options={[{ label: "Don't repeat", value: "Don't repeat" }]}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Private To-Do:
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={privateTodo}
              onClick={() => setPrivateTodo((p) => !p)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                privateTodo ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  privateTodo ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
            <span className="text-sm text-muted-foreground">
              This To-Do is visible to the entire team.
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Team <span className="text-red-500">*</span>
            </label>
            <Select
              value={teamId || teamOptions[0]?.value}
              onChange={(v) => {
                if (v != null) {
                  setTeamId(v);
                  setAssigneeId('');
                }
              }}
              options={teamOptions}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              To-Do must be assigned to a team.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Team member (optional)
            </label>
            <Select
              value={assigneeId || undefined}
              onChange={(v) => setAssigneeId(v ?? '')}
              allowClear
              placeholder="Unassigned"
              options={[
                { label: 'Unassigned', value: '' },
                ...teamMembers.map((m) => ({ label: m.user?.name || m.user?.email || m.userId, value: m.user?.id ?? m.userId })),
              ]}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Optionally assign to a member of the selected team.
            </p>
          </div>
        </div>
        <section className="pt-6 mt-6 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-foreground">Linked Items 0</h4>
            <button
              type="button"
              className="text-sm text-primary hover:underline"
            >
              Edit
            </button>
          </div>
          <button
            type="button"
            className="text-sm text-primary hover:underline"
          >
            + Linked Item
          </button>
        </section>
        <section className="pt-6 mt-6 border-t border-border">
          <h4 className="font-medium text-foreground mb-3">Attachments 0</h4>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
            Drag and drop files to attach, or{' '}
            <button type="button" className="text-primary hover:underline">
              browse
            </button>
          </div>
        </section>
        <section className="pt-6 mt-6 border-t border-border">
          <h4 className="font-medium text-foreground mb-3">Comments 0</h4>
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground shrink-0">
              {todo.ownerInitials}
            </div>
            <input
              type="text"
              placeholder="Add a comment..."
              className="flex-1 px-3 py-2.5 border border-border rounded-md bg-background text-foreground text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground text-right mt-2">
            0/10000
          </p>
        </section>
      </div>
      <footer className="px-6 py-4 border-t border-border shrink-0 space-y-3">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-md border border-border bg-background text-foreground text-sm font-medium hover:bg-muted cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 cursor-pointer"
          >
            Save
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Created by {todo.ownerInitials} on{' '}
          {todo.dueDate
            ? new Date(todo.dueDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : '—'}{' '}
          · <span className="inline-flex items-center gap-1">✔ Following <User className="w-3 h-3" /></span>
        </p>
      </footer>
    </div>
    </>
  );
}
