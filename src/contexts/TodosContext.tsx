'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { arrayMove } from '@dnd-kit/sortable';

export interface TodoItem {
  id: string;
  title: string;
  dueDate: string | null; // ISO or null
  ownerInitials: string;
  completed: boolean;
  description?: string;
  repeat?: string;
  private?: boolean;
  teamId?: string;
  teamName?: string;
  archived: boolean;
  order: number;
}

interface TodosContextValue {
  todos: TodoItem[];
  addTodo: (item: Omit<TodoItem, 'id' | 'order' | 'archived'>) => string;
  updateTodo: (id: string, patch: Partial<TodoItem>) => void;
  deleteTodo: (id: string) => void;
  reorderTodos: (fromIndex: number, toIndex: number) => void;
  moveToTop: (id: string) => void;
  moveToBottom: (id: string) => void;
  archiveTodo: (id: string) => void;
  setCompleted: (id: string, completed: boolean) => void;
}

const TodosContext = createContext<TodosContextValue | null>(null);

export function TodosProvider({ children }: { children: ReactNode }) {
  const [todos, setTodos] = useState<TodoItem[]>([
    {
      id: 'todo-1',
      title: "Review 1 Measurables from Leadership Team's Scorecard",
      dueDate: '2026-03-01',
      ownerInitials: 'GS',
      completed: false,
      archived: false,
      order: 0,
    },
  ]);

  const addTodo = useCallback(
    (item: Omit<TodoItem, 'id' | 'order' | 'archived'>) => {
      const id = `todo-${Date.now()}`;
      const order = todos.length;
      setTodos((prev) => [
        ...prev,
        { ...item, id, order, archived: false },
      ]);
      return id;
    },
    [todos.length]
  );

  const updateTodo = useCallback((id: string, patch: Partial<TodoItem>) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const reorderTodos = useCallback((fromIndex: number, toIndex: number) => {
    setTodos((prev) => {
      const active = prev.filter((t) => !t.archived);
      const archived = prev.filter((t) => t.archived);
      const reordered = arrayMove(active, fromIndex, toIndex);
      return reordered.map((t, i) => ({ ...t, order: i })).concat(archived);
    });
  }, []);

  const moveToTop = useCallback((id: string) => {
    setTodos((prev) => {
      const active = prev.filter((t) => !t.archived);
      const archived = prev.filter((t) => t.archived);
      const idx = active.findIndex((t) => t.id === id);
      if (idx <= 0) return prev;
      const reordered = arrayMove(active, idx, 0);
      return reordered.map((t, i) => ({ ...t, order: i })).concat(archived);
    });
  }, []);

  const moveToBottom = useCallback((id: string) => {
    setTodos((prev) => {
      const active = prev.filter((t) => !t.archived);
      const archived = prev.filter((t) => t.archived);
      const idx = active.findIndex((t) => t.id === id);
      if (idx < 0 || idx >= active.length - 1) return prev;
      const reordered = arrayMove(active, idx, active.length - 1);
      return reordered.map((t, i) => ({ ...t, order: i })).concat(archived);
    });
  }, []);

  const archiveTodo = useCallback((id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, archived: true } : t))
    );
  }, []);

  const setCompleted = useCallback((id: string, completed: boolean) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed } : t))
    );
  }, []);

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
