import { apiClient } from './client';

export interface TodoApiItem {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string | null;
  status: string;
  completedAt: string | null;
  order: number;
  archived: boolean;
  private?: boolean;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  linkedEntityTitle?: string | null;
  createdAt: string;
  updatedAt: string;
  assigneeId: string;
  ownerInitials: string;
}

export const todosService = {
  findAll: async (
    organizationId: string,
    teamId: string,
    archived?: boolean,
    meetingId?: string
  ): Promise<TodoApiItem[]> => {
    const params = new URLSearchParams({ organizationId, teamId });
    if (typeof archived === 'boolean') {
      params.set('archived', String(archived));
    }
    if (meetingId) params.set('meetingId', meetingId);
    const response = await apiClient.get<TodoApiItem[]>(`/todos?${params}`);
    return response.data;
  },

  create: async (
    organizationId: string,
    teamId: string,
    data: {
      title: string;
      description?: string;
      dueDate?: string;
      assigneeId?: string;
      order?: number;
      linkedEntityType?: string;
      linkedEntityId?: string;
      linkedEntityTitle?: string;
      private?: boolean;
    },
    meetingId?: string
  ): Promise<TodoApiItem> => {
    const params = new URLSearchParams({ organizationId, teamId });
    if (meetingId) params.set('meetingId', meetingId);
    const response = await apiClient.post<TodoApiItem>(
      `/todos?${params}`,
      data
    );
    return response.data;
  },

  update: async (
    organizationId: string,
    todoId: string,
    data: {
      title?: string;
      description?: string;
      dueDate?: string | null;
      status?: 'open' | 'done';
      completedAt?: string | null;
      assigneeId?: string;
      order?: number;
      archived?: boolean;
      private?: boolean;
      linkedEntityType?: string | null;
      linkedEntityId?: string | null;
      linkedEntityTitle?: string | null;
      teamId?: string;
    },
    meetingId?: string
  ): Promise<TodoApiItem> => {
    const params = new URLSearchParams({ organizationId });
    if (meetingId) params.set('meetingId', meetingId);
    const response = await apiClient.put<TodoApiItem>(
      `/todos/${todoId}?${params}`,
      data
    );
    return response.data;
  },

  delete: async (
    organizationId: string,
    todoId: string,
    meetingId?: string
  ): Promise<{ success: boolean }> => {
    const params = new URLSearchParams({ organizationId });
    if (meetingId) params.set('meetingId', meetingId);
    const response = await apiClient.delete(
      `/todos/${todoId}?${params}`
    );
    return response.data;
  },

  reorder: async (
    organizationId: string,
    teamId: string,
    todoIds: string[],
    meetingId?: string
  ): Promise<TodoApiItem[]> => {
    const params = new URLSearchParams({ organizationId, teamId });
    if (meetingId) params.set('meetingId', meetingId);
    const response = await apiClient.post<TodoApiItem[]>(
      `/todos/reorder?${params}`,
      { todoIds }
    );
    return response.data;
  },
};
