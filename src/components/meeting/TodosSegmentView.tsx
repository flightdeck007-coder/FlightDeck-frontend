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
import {
  Search,
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
import { useTodos, type TodoItem } from '@/contexts/TodosContext';
import { RichTextEditor } from './RichTextEditor';
import { ContentAreaLoader } from '@/components/ui/loaders';

const MENU_WIDTH = 248;
const MENU_GAP = 8;
const PAGE_SIZES = [10, 25, 50, 100];

type CreatePopupType = 'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message';

interface TodosSegmentViewProps {
  teamName?: string;
  embedded?: boolean;
  meetingId?: string;
  isFacilitator?: boolean;
  onOpenCreate?: (type: CreatePopupType) => void;
}

function formatDueDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TodosSegmentView({
  teamName = 'Leadership Team',
  embedded = false,
  meetingId,
  isFacilitator = true,
  onOpenCreate,
}: TodosSegmentViewProps) {
  const [teamFilter, setTeamFilter] = useState(teamName);
  const [ownerFilter, setOwnerFilter] = useState('All +1');
  const [archiveOn, setArchiveOn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [page, setPage] = useState(0);
  const [editTodoId, setEditTodoId] = useState<string | null>(null);

  const { socket } = useMeetingSocket();

  useEffect(() => {
    if (!socket || !meetingId) return;
    const onTodosFilter = (payload: {
      teamFilter?: string;
      ownerFilter?: string;
      archiveOn?: boolean;
      searchQuery?: string;
    }) => {
      if (payload.teamFilter !== undefined) setTeamFilter(payload.teamFilter);
      if (payload.ownerFilter !== undefined) setOwnerFilter(payload.ownerFilter);
      if (payload.archiveOn !== undefined) setArchiveOn(payload.archiveOn);
      if (payload.searchQuery !== undefined) setSearchQuery(payload.searchQuery);
    };
    socket.on('todos_filter', onTodosFilter);
    return () => {
      socket.off('todos_filter', onTodosFilter);
      return;
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
    const list = archiveOn ? archivedTodos : activeTodos;
    const seen = new Set<string>();
    const deduped = list.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
    if (!searchQuery.trim()) return deduped;
    const q = searchQuery.toLowerCase();
    return deduped.filter((t) => t.title.toLowerCase().includes(q));
  }, [archiveOn, activeTodos, archivedTodos, searchQuery]);

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
        <div className="relative">
          <span className="text-muted-foreground text-sm mr-1">Team:</span>
          <select
            value={teamFilter}
            onChange={(e) => {
              const v = e.target.value;
              setTeamFilter(v);
              if (meetingId && socket) socket.emit('todos_filter', { meetingId, teamFilter: v });
            }}
            disabled={!isFacilitator}
            className={`pl-3 pr-8 py-2 border border-border rounded-lg bg-background text-foreground text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-muted/50 hover:border-foreground/20 transition-colors'}`}
          >
            <option>Leadership Team</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        <div className="relative">
          <span className="text-muted-foreground text-sm mr-1">Owner:</span>
          <select
            value={ownerFilter}
            onChange={(e) => {
              const v = e.target.value;
              setOwnerFilter(v);
              if (meetingId && socket) socket.emit('todos_filter', { meetingId, ownerFilter: v });
            }}
            disabled={!isFacilitator}
            className={`pl-3 pr-8 py-2 border border-border rounded-lg bg-background text-foreground text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-muted/50 hover:border-foreground/20 transition-colors'}`}
          >
            <option>All +1</option>
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
                if (meetingId && socket) socket.emit('todos_filter', { meetingId, archiveOn: next });
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
          aria-label="Download PDF"
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
          aria-label="More"
        >
          <Package className="w-4 h-4" />
        </button>
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search TO-DO LIST | Level 10 Meetin..."
            value={searchQuery}
            onChange={(e) => {
              const v = e.target.value;
              setSearchQuery(v);
              if (meetingId && socket) socket.emit('todos_filter', { meetingId, searchQuery: v });
            }}
            disabled={!isFacilitator}
            className={`w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'hover:border-foreground/20'}`}
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
            Team To-Dos {filteredTodos.length}
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
              <span className="relative inline-flex items-center">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setPage(0);
                  }}
                  className="pl-2 pr-7 py-1 border border-border rounded-lg bg-background text-foreground appearance-none cursor-pointer hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
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
}: {
  item: TodoItem;
  onEdit: () => void;
  onToggleComplete: (completed: boolean) => void;
  onUpdateDueDate: (dueDate: string | null) => void;
  onArchive: () => void;
  onDelete: () => void;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
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
          <div className="flex items-center gap-2">
            <span>{item.title}</span>
            {hoverTitle && (
              <Pencil className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
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
            <TodoRowMenu
              anchorRect={anchorRect}
              onClose={() => {
                setMenuOpen(false);
                setAnchorRect(null);
              }}
              onMoveToTop={onMoveToTop}
              onMoveToBottom={onMoveToBottom}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          )}
        </td>
      </tr>
    </>
  );
}

function TodoRowMenu({
  anchorRect,
  onClose,
  onMoveToTop,
  onMoveToBottom,
  onArchive,
  onDelete,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
  onArchive: () => void;
  onDelete: () => void;
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
}: {
  todo: TodoItem;
  onClose: () => void;
  onUpdate: (patch: Partial<TodoItem>) => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description || '');
  const [dueDate, setDueDate] = useState(
    todo.dueDate
      ? new Date(todo.dueDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
        })
      : ''
  );
  const [repeat, setRepeat] = useState(todo.repeat || "Don't repeat");
  const [privateTodo, setPrivateTodo] = useState(todo.private ?? false);
  const [team, setTeam] = useState(todo.teamName || 'Leadership Team');

  const handleSave = (andClose = false) => {
    const isoDate = dueDate
      ? (() => {
          const d = new Date(dueDate);
          return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
        })()
      : null;
    onUpdate({
      title,
      description: description || undefined,
      dueDate: isoDate,
      repeat,
      private: privateTodo,
      teamName: team,
    });
    if (andClose) onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={() => handleSave(true)} aria-hidden />
    <div className="fixed inset-y-0 right-0 w-[30%] min-w-[320px] max-w-[480px] bg-card border-l border-border shadow-xl z-50 flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-border shrink-0">
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
            onClick={() => handleSave(true)}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => handleSave()}
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
          <div className="flex gap-2">
            <input
              type="text"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              placeholder="MM/DD/YYYY"
              className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
            />
            <button
              type="button"
              className="p-2 border border-border rounded-md hover:bg-muted"
              aria-label="Pick date"
            >
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Repeat
          </label>
          <select
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
          >
            <option>Don&apos;t repeat</option>
          </select>
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
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Team
          </label>
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
          >
            <option>Leadership Team</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Changing the team will affect which users the To-Do can be assigned
            to.
          </p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
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
        </div>
        <div>
          <h4 className="font-medium text-foreground mb-2">Attachments 0</h4>
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
            Drag and drop files to attach, or{' '}
            <button type="button" className="text-primary hover:underline">
              browse
            </button>
          </div>
        </div>
        <div>
          <h4 className="font-medium text-foreground mb-2">Comments 0</h4>
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground shrink-0">
              {todo.ownerInitials}
            </div>
            <input
              type="text"
              placeholder="Add a comment..."
              className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground text-right mt-1">
            0/10000
          </p>
        </div>
      </div>
      <footer className="p-4 border-t border-border text-xs text-muted-foreground shrink-0">
        Created by {todo.ownerInitials} on{' '}
        {todo.dueDate
          ? new Date(todo.dueDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : '—'}{' '}
        · <span className="flex items-center gap-1 inline-flex mt-1">✔ Following <User className="w-3 h-3" /></span>
      </footer>
    </div>
    </>
  );
}
