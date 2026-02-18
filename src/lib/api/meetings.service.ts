import { apiClient } from './client';

export interface CreateMeetingDto {
  teamId: string;
  meetingSeriesId?: string;
  meetingSeriesName?: string;
  scheduledAt: string;
  sectionTitles?: string[];
}

export interface Meeting {
  id: string;
  teamId: string;
  meetingSeriesId: string;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  team: {
    id: string;
    name: string;
  };
  series: {
    id: string;
    name: string;
  };
  sections: Array<{
    id: string;
    title: string;
    order: number;
    durationMinutes?: number;
    notes?: Array<{
      id: string;
      content: string;
      author: {
        id: string;
        email: string;
        name?: string;
      };
    }>;
  }>;
  attendances: Array<{
    id: string;
    present: boolean;
    user: {
      id: string;
      email: string;
      name?: string;
    };
  }>;
}

export const meetingsService = {
  create: async (organizationId: string, data: CreateMeetingDto): Promise<Meeting> => {
    const response = await apiClient.post<Meeting>(`/meetings?organizationId=${organizationId}`, data);
    return response.data;
  },

  findAll: async (organizationId: string, teamId?: string): Promise<Meeting[]> => {
    const url = teamId
      ? `/meetings?organizationId=${organizationId}&teamId=${teamId}`
      : `/meetings?organizationId=${organizationId}`;
    const response = await apiClient.get<Meeting[]>(url);
    return response.data;
  },

  findOne: async (organizationId: string, meetingId: string): Promise<Meeting> => {
    const response = await apiClient.get<Meeting>(`/meetings/${meetingId}?organizationId=${organizationId}`);
    return response.data;
  },

  update: async (
    organizationId: string,
    meetingId: string,
    data: { startedAt?: string; endedAt?: string },
  ): Promise<Meeting> => {
    const response = await apiClient.put<Meeting>(
      `/meetings/${meetingId}?organizationId=${organizationId}`,
      data,
    );
    return response.data;
  },

  addAttendance: async (organizationId: string, meetingId: string): Promise<any> => {
    const response = await apiClient.post(`/meetings/${meetingId}/attend?organizationId=${organizationId}`);
    return response.data;
  },
};
