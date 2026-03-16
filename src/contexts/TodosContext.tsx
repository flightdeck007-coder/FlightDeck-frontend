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
import { arrayMove } from '@dnd-kit/sortable';
import { todosService, type TodoApiItem } from '@/lib/api/todos.service';
import { useMeetingSocket } from './MeetingSocketContext';

export interface TodoItem {
  id: string;
  title: string;
  dueDate: string | null;
  ownerInitials: string;
  assigneeId?: string | null;
  completed: boolean;
  description?: string;
  repeat?: string;
  private?: boolean;
  teamId?: string;
  teamName?: string;
  archived: boolean;
  order: number;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  linkedEntityTitle?: string | null;
}

function apiToItem(t: TodoApiItem): TodoItem {
  return {
    id: t.id,
    title: t.title,
    dueDate: t.dueDate,
    ownerInitials: t.ownerInitials,
    assigneeId: t.assigneeId ?? undefined,
    completed: t.status === 'done',
    description: t.description ?? undefined,
    archived: t.archived,
    order: t.order,
    linkedEntityType: t.linkedEntityType ?? null,
    linkedEntityId: t.linkedEntityId ?? null,
    linkedEntityTitle: t.linkedEntityTitle ?? null,
    teamId: (t as TodoApiItem & { teamId?: string }).teamId,
    teamName: (t as TodoApiItem & { teamName?: string }).teamName,
  };
}

interface TodosContextValue {
  todos: TodoItem[];
  addTodo: (item: Omit<TodoItem, 'id' | 'order' | 'archived'>) => Promise<string>;
  updateTodo: (id: string, patch: Partial<TodoItem>) => void;
  deleteTodo: (id: string) => void;
  reorderTodos: (fromIndex: number, toIndex: number) => void;
  moveToTop: (id: string) => void;
  moveToBottom: (id: string) => void;
  archiveTodo: (id: string) => void;
  setCompleted: (id: string, completed: boolean) => void;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const TodosContext = createContext<TodosContextValue | null>(null);

export function TodosProvider({
  children,
  meetingId,
  organizationId,
  teamId,
}: {
  children: ReactNode;
  meetingId?: string;
  organizationId?: string;
  teamId?: string;
}) {
  const { socket } = useMeetingSocket();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTodos = useCallback(async () => {
    if (!organizationId || !teamId || typeof window === 'undefined') {
      setTodos([]);
      return;
    }
    setIsLoading(true);
    try {
      const [active, archived] = await Promise.all([
        todosService.findAll(organizationId, teamId, false, meetingId),
        todosService.findAll(organizationId, teamId, true, meetingId),
      ]);
      const activeItems = active.map(apiToItem);
      const activeIds = new Set(activeItems.map((t) => t.id));
      const archivedOnly = archived.map(apiToItem).filter((t) => !activeIds.has(t.id));
      const combined = [...activeItems, ...archivedOnly];
      combined.sort((a, b) => (a.archived ? 1 : 0) - (b.archived ? 1 : 0) || a.order - b.order);
      setTodos(combined);
    } catch {
      setTodos([]);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, teamId, meetingId]);

  // When meetingId changes (new meeting), clear and refetch so we don't show previous meeting's stale list
  useEffect(() => {
    setTodos([]);
  }, [meetingId]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // Real-time: todo_created, todo_updated, todo_deleted, todo_reordered + todo_list_changed (refetch) from other members
  useEffect(() => {
    if (!socket || !teamId) return;
    const onTodoCreated = (raw: TodoApiItem) => {
      const item = apiToItem(raw);
      setTodos((prev) =>
        prev.some((t) => t.id === item.id) ? prev : [...prev, item].sort((a, b) => a.order - b.order)
      );
    };
    const onTodoUpdated = (raw: TodoApiItem) => {
      const item = apiToItem(raw);
      setTodos((prev) =>
        prev.map((t) => (t.id === item.id ? item : t))
      );
    };
    const onTodoDeleted = (payload: { todoId: string }) => {
      const id = payload?.todoId;
      if (id) setTodos((prev) => prev.filter((t) => t.id !== id));
    };
    const onTodoReordered = (list: TodoApiItem[]) => {
      setTodos((prev) => {
        const fromList = list.map(apiToItem);
        const listIds = new Set(fromList.map((t) => t.id));
        const archivedOnly = prev.filter((t) => t.archived && !listIds.has(t.id));
        return [...fromList, ...archivedOnly];
      });
    };
    const onTodoListChanged = () => {
      fetchTodos();
    };
    socket.on('todo_created', onTodoCreated);
    socket.on('todo_updated', onTodoUpdated);
    socket.on('todo_deleted', onTodoDeleted);
    socket.on('todo_reordered', onTodoReordered);
    socket.on('todo_list_changed', onTodoListChanged);
    return () => {
      socket.off('todo_created', onTodoCreated);
      socket.off('todo_updated', onTodoUpdated);
      socket.off('todo_deleted', onTodoDeleted);
      socket.off('todo_reordered', onTodoReordered);
      socket.off('todo_list_changed', onTodoListChanged);
    };
  }, [socket, teamId, fetchTodos]);

  const addTodo = useCallback(
    async (item: Omit<TodoItem, 'id' | 'order' | 'archived'>): Promise<string> => {
      if (!organizationId || !teamId) {
        const id = `todo-${Date.now()}`;
        setTodos((prev) => [
          ...prev,
          { ...item, id, order: prev.length, archived: false },
        ]);
        return id;
      }
      try {
        const createTeamId = item.teamId ?? teamId;
        if (!createTeamId) throw new Error("Team is required");
        const created = await todosService.create(
          organizationId,
          createTeamId,
          {
            title: item.title,
            description: item.description,
            dueDate: item.dueDate ?? undefined,
            assigneeId: item.assigneeId ?? undefined,
            linkedEntityType: item.linkedEntityType ?? undefined,
            linkedEntityId: item.linkedEntityId ?? undefined,
            linkedEntityTitle: item.linkedEntityTitle ?? undefined,
          },
          meetingId
        );
        setTodos((prev) => [...prev, apiToItem(created)].sort((a, b) => a.order - b.order));
        return created.id;
      } catch {
        const id = `todo-${Date.now()}`;
        setTodos((prev) => [
          ...prev,
          { ...item, id, order: prev.length, archived: false },
        ]);
        return id;
      }
    },
    [organizationId, teamId, meetingId]
  );

  const updateTodo = useCallback(
    async (id: string, patch: Partial<TodoItem>) => {
      if (!organizationId) {
        setTodos((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
        );
        return;
      }
      try {
        const updated = await todosService.update(
          organizationId,
          id,
          {
            title: patch.title,
            description: patch.description,
            dueDate: patch.dueDate,
            status: patch.completed === true ? 'done' : patch.completed === false ? 'open' : undefined,
            completedAt: patch.completed === true ? new Date().toISOString() : patch.completed === false ? undefined : undefined,
            archived: patch.archived,
            order: patch.order,
            linkedEntityType: patch.linkedEntityType,
            linkedEntityId: patch.linkedEntityId,
            linkedEntityTitle: patch.linkedEntityTitle,
            ...(patch.teamId != null && { teamId: patch.teamId }),
            ...(patch.assigneeId !== undefined && { assigneeId: patch.assigneeId ?? undefined }),
          },
          meetingId
        );
        setTodos((prev) =>
          prev.map((t) => (t.id === id ? apiToItem(updated) : t))
        );
      } catch {
        setTodos((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
        );
      }
    },
    [organizationId, meetingId]
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      if (!organizationId) {
        setTodos((prev) => prev.filter((t) => t.id !== id));
        return;
      }
      try {
        await todosService.delete(organizationId, id, meetingId);
        setTodos((prev) => prev.filter((t) => t.id !== id));
      } catch {
        setTodos((prev) => prev.filter((t) => t.id !== id));
      }
    },
    [organizationId, meetingId]
  );

  const reorderTodos = useCallback(
    async (fromIndex: number, toIndex: number) => {
      const active = todos.filter((t) => !t.archived).sort((a, b) => a.order - b.order);
      const reordered = arrayMove(active, fromIndex, toIndex);
      const newOrder = reordered.map((t, i) => ({ ...t, order: i }));
      setTodos((prev) => {
        const archived = prev.filter((t) => t.archived);
        return [...newOrder, ...archived];
      });
      if (organizationId && teamId) {
        try {
          const todoIds = newOrder.map((t) => t.id);
          const result = await todosService.reorder(organizationId, teamId, todoIds, meetingId);
          setTodos((prev) => {
            const archived = prev.filter((t) => t.archived);
            return [...result.map(apiToItem), ...archived];
          });
        } catch {
          // revert on error could be done here
        }
      }
    },
    [todos, organizationId, teamId, meetingId]
  );

  const moveToTop = useCallback(
    (id: string) => {
      const active = todos.filter((t) => !t.archived).sort((a, b) => a.order - b.order);
      const idx = active.findIndex((t) => t.id === id);
      if (idx <= 0) return;
      reorderTodos(idx, 0);
    },
    [todos, reorderTodos]
  );

  const moveToBottom = useCallback(
    (id: string) => {
      const active = todos.filter((t) => !t.archived).sort((a, b) => a.order - b.order);
      const idx = active.findIndex((t) => t.id === id);
      if (idx < 0 || idx >= active.length - 1) return;
      reorderTodos(idx, active.length - 1);
    },
    [todos, reorderTodos]
  );

  const archiveTodo = useCallback(
    (id: string) => {
      updateTodo(id, { archived: true });
    },
    [updateTodo]
  );

  const setCompleted = useCallback(
    (id: string, completed: boolean) => {
      if (organizationId) {
        todosService
          .update(organizationId, id, {
            status: completed ? 'done' : 'open',
            completedAt: completed ? new Date().toISOString() : undefined,
          })
          .then((updated) => {
            setTodos((prev) =>
              prev.map((t) => (t.id === id ? apiToItem(updated) : t))
            );
          })
          .catch(() => {
            setTodos((prev) =>
              prev.map((t) => (t.id === id ? { ...t, completed } : t))
            );
          });
      } else {
        setTodos((prev) =>
          prev.map((t) => (t.id === id ? { ...t, completed } : t))
        );
      }
    },
    [organizationId]
  );

  const value = useMemo(
    () => ({
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
      refetch: fetchTodos,
    }),
    [
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
      fetchTodos,
    ]
  );

  return (
    <TodosContext.Provider value={value}>{children}</TodosContext.Provider>
  );
}

export function useTodos() {
  const ctx = useContext(TodosContext);
  if (!ctx) throw new Error('useTodos must be used within TodosProvider');
  return ctx;
}

export function useTodosOptional() {
  return useContext(TodosContext);
}
