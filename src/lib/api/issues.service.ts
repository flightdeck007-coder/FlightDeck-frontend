import { apiClient } from './client';

export interface IssueApiItem {
  id: string;
  title: string;
  description?: string | null;
  priority: number;
  termType: 'short_term' | 'long_term';
  resolvedAt: string | null;
  resolvedById: string | null;
  resolvedByName: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  ownerInitials: string;
}

export const issuesService = {
  findAll: async (
    organizationId: string,
    teamId: string,
    termType?: 'short_term' | 'long_term',
    archived?: boolean,
    meetingId?: string
  ): Promise<IssueApiItem[]> => {
    const params = new URLSearchParams({ organizationId, teamId });
    if (termType) params.set('termType', termType);
    if (typeof archived === 'boolean') {
      params.set('archived', String(archived));
    }
    if (meetingId) params.set('meetingId', meetingId);
    const response = await apiClient.get<IssueApiItem[]>(`/issues?${params}`);
    return response.data;
  },

  create: async (
    organizationId: string,
    teamId: string,
    data: {
      title: string;
      description?: string;
      priority?: number;
      termType?: 'short_term' | 'long_term';
    },
    meetingId?: string
  ): Promise<IssueApiItem> => {
    const params = new URLSearchParams({ organizationId, teamId });
    if (meetingId) params.set('meetingId', meetingId);
    const response = await apiClient.post<IssueApiItem>(
      `/issues?${params}`,
      data
    );
    return response.data;
  },

  update: async (
    organizationId: string,
    issueId: string,
    data: {
      title?: string;
      description?: string | null;
      priority?: number;
      termType?: 'short_term' | 'long_term';
      resolvedAt?: string | null;
      resolvedById?: string | null;
    },
    meetingId?: string
  ): Promise<IssueApiItem> => {
    const params = new URLSearchParams({ organizationId });
    if (meetingId) params.set('meetingId', meetingId);
    const response = await apiClient.put<IssueApiItem>(
      `/issues/${issueId}?${params}`,
      data
    );
    return response.data;
  },

  delete: async (
    organizationId: string,
    issueId: string,
    meetingId?: string
  ): Promise<{ success: boolean }> => {
    const params = new URLSearchParams({ organizationId });
    if (meetingId) params.set('meetingId', meetingId);
    const response = await apiClient.delete(
      `/issues/${issueId}?${params}`
    );
    return response.data;
  },
};
