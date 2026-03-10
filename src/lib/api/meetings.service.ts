import { apiClient } from './client';

export interface CreateMeetingDto {
  teamId: string;
  meetingSeriesId?: string;
  meetingSeriesName?: string;
  scheduledAt: string;
  facilitatorId?: string;
  scribeId?: string;
  sectionTitles?: string[];
}

/** Recap data saved when meeting ends; loaded for past meeting panel */
export interface MeetingRecapData {
  todosCreated?: Array<{ id: string; title: string; assigneeInitials?: string; completed?: boolean }>;
  issuesSolved?: Array<{ id: string; title: string; resolvedByName?: string | null }>;
  shortTermStats?: {
    totalTracked: number;
    solvedLastMeeting: number;
    solvedToday: number;
    solveRatePercent: number;
  };
  sectionDurations?: Array<{ sectionTitle: string; durationMMSS: string }>;
  ratings?: Array<{ attendanceId?: string; userName: string; rating: number | null; absent?: boolean }>;
  attachments?: Array<{ id: string; name: string; url?: string }>;
}

export interface Meeting {
  id: string;
  teamId: string;
  meetingSeriesId: string;
  facilitatorId?: string | null;
  scribeId?: string | null;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  suspendedAt?: string | null;
  cancelledAt?: string | null;
  team: {
    id: string;
    name: string;
    organizationId?: string;
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
    data: {
      startedAt?: string;
      endedAt?: string;
      scheduledAt?: string;
      facilitatorId?: string | null;
      scribeId?: string | null;
    },
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

  leaveMeeting: async (organizationId: string, meetingId: string): Promise<{ success: boolean }> => {
    const response = await apiClient.post(`/meetings/${meetingId}/leave?organizationId=${organizationId}`);
    return response.data;
  },

  suspend: async (organizationId: string, meetingId: string): Promise<Meeting> => {
    const response = await apiClient.post<Meeting>(
      `/meetings/${meetingId}/suspend?organizationId=${organizationId}`,
    );
    return response.data;
  },

  cancel: async (organizationId: string, meetingId: string): Promise<Meeting> => {
    const response = await apiClient.post<Meeting>(
      `/meetings/${meetingId}/cancel?organizationId=${organizationId}`,
    );
    return response.data;
  },

  remove: async (organizationId: string, meetingId: string): Promise<{ deleted: boolean }> => {
    const response = await apiClient.delete<{ deleted: boolean }>(
      `/meetings/${meetingId}?organizationId=${organizationId}`,
    );
    return response.data;
  },

  resume: async (organizationId: string, meetingId: string): Promise<Meeting> => {
    const response = await apiClient.post<Meeting>(
      `/meetings/${meetingId}/resume?organizationId=${organizationId}`,
    );
    return response.data;
  },

  saveNote: async (
    organizationId: string,
    meetingId: string,
    sectionId: string,
    content: string,
  ): Promise<{ id: string; content: string; author: { id: string; email: string; name?: string } }> => {
    const response = await apiClient.post(
      `/meetings/${meetingId}/sections/${sectionId}/notes?organizationId=${organizationId}`,
      { content },
    );
    return response.data;
  },

  getAttachments: async (
    organizationId: string,
    meetingId: string,
  ): Promise<Array<{ id: string; fileName: string; filePath: string; mimeType?: string; user?: { id: string; name?: string; email: string } }>> => {
    const response = await apiClient.get(
      `/meetings/${meetingId}/attachments?organizationId=${organizationId}`,
    );
    return response.data;
  },

  uploadAttachment: async (
    organizationId: string,
    meetingId: string,
    file: File,
  ): Promise<{ id: string; fileName: string; filePath: string; mimeType?: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(
      `/meetings/${meetingId}/attachments?organizationId=${organizationId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  },

  getRecap: async (
    organizationId: string,
    meetingId: string,
  ): Promise<MeetingRecapData | null> => {
    const response = await apiClient.get<MeetingRecapData | null>(
      `/meetings/${meetingId}/recap?organizationId=${organizationId}`,
    );
    return response.data;
  },

  saveRecap: async (
    organizationId: string,
    meetingId: string,
    data: MeetingRecapData,
  ): Promise<{ success: boolean }> => {
    const response = await apiClient.post(
      `/meetings/${meetingId}/recap?organizationId=${organizationId}`,
      data,
    );
    return response.data;
  },

  getRocks: async (organizationId: string, meetingId: string) => {
    const response = await apiClient.get(
      `/meetings/${meetingId}/rocks?organizationId=${organizationId}`,
    );
    return response.data as Array<{
      id: string;
      title: string;
      ownerName: string;
      ownerInitials: string;
      dueBy: string;
      status: string;
      column: string;
      achieved: boolean;
      isCompanyRock?: boolean;
      milestoneLabel?: string | null;
    }>;
  },
  createRock: async (
    organizationId: string,
    meetingId: string,
    data: {
      title: string;
      ownerName?: string;
      ownerInitials?: string;
      dueBy?: string;
      status?: string;
      column?: string;
      achieved?: boolean;
      isCompanyRock?: boolean;
      milestoneLabel?: string;
    },
  ) => {
    const response = await apiClient.post(
      `/meetings/${meetingId}/rocks?organizationId=${organizationId}`,
      data,
    );
    return response.data;
  },
  updateRock: async (
    organizationId: string,
    meetingId: string,
    rockId: string,
    data: Partial<{
      title: string;
      ownerName: string;
      ownerInitials: string;
      dueBy: string;
      status: string;
      column: string;
      achieved: boolean;
      isCompanyRock: boolean;
      milestoneLabel: string | null;
    }>,
  ) => {
    const response = await apiClient.put(
      `/meetings/${meetingId}/rocks/${rockId}?organizationId=${organizationId}`,
      data,
    );
    return response.data;
  },
  deleteRock: async (organizationId: string, meetingId: string, rockId: string) => {
    await apiClient.delete(
      `/meetings/${meetingId}/rocks/${rockId}?organizationId=${organizationId}`,
    );
  },

  getHeadlines: async (organizationId: string, meetingId: string) => {
    const response = await apiClient.get(
      `/meetings/${meetingId}/headlines?organizationId=${organizationId}`,
    );
    return response.data as Array<{
      id: string;
      title: string;
      createdAt: string;
      createdAgo: string;
      ownerInitials: string;
      archived: boolean;
    }>;
  },
  createHeadline: async (
    organizationId: string,
    meetingId: string,
    data: { title: string; ownerInitials?: string },
  ) => {
    const response = await apiClient.post(
      `/meetings/${meetingId}/headlines?organizationId=${organizationId}`,
      data,
    );
    return response.data;
  },
  updateHeadline: async (
    organizationId: string,
    meetingId: string,
    headlineId: string,
    data: { archived?: boolean; order?: number },
  ) => {
    const response = await apiClient.put(
      `/meetings/${meetingId}/headlines/${headlineId}?organizationId=${organizationId}`,
      data,
    );
    return response.data;
  },
  reorderHeadlines: async (
    organizationId: string,
    meetingId: string,
    ids: string[],
  ) => {
    const response = await apiClient.post(
      `/meetings/${meetingId}/headlines/reorder?organizationId=${organizationId}`,
      { ids },
    );
    return response.data;
  },
  deleteHeadline: async (
    organizationId: string,
    meetingId: string,
    headlineId: string,
  ) => {
    await apiClient.delete(
      `/meetings/${meetingId}/headlines/${headlineId}?organizationId=${organizationId}`,
    );
  },

  getCascadingMessages: async (organizationId: string, meetingId: string) => {
    const response = await apiClient.get(
      `/meetings/${meetingId}/cascading-messages?organizationId=${organizationId}`,
    );
    return response.data as Array<{
      id: string;
      title: string;
      from: string;
      createdAt: string;
      createdAgo: string;
      ownerInitials: string;
      archived: boolean;
    }>;
  },
  createCascadingMessage: async (
    organizationId: string,
    meetingId: string,
    data: { title: string; from: string; ownerInitials?: string },
  ) => {
    const response = await apiClient.post(
      `/meetings/${meetingId}/cascading-messages?organizationId=${organizationId}`,
      data,
    );
    return response.data;
  },
  updateCascadingMessage: async (
    organizationId: string,
    meetingId: string,
    messageId: string,
    data: { archived?: boolean; order?: number },
  ) => {
    const response = await apiClient.put(
      `/meetings/${meetingId}/cascading-messages/${messageId}?organizationId=${organizationId}`,
      data,
    );
    return response.data;
  },
  reorderCascadingMessages: async (
    organizationId: string,
    meetingId: string,
    ids: string[],
  ) => {
    const response = await apiClient.post(
      `/meetings/${meetingId}/cascading-messages/reorder?organizationId=${organizationId}`,
      { ids },
    );
    return response.data;
  },
  deleteCascadingMessage: async (
    organizationId: string,
    meetingId: string,
    messageId: string,
  ) => {
    await apiClient.delete(
      `/meetings/${meetingId}/cascading-messages/${messageId}?organizationId=${organizationId}`,
    );
  },

  downloadAttachment: async (
    organizationId: string,
    meetingId: string,
    attachmentId: string,
    fileName: string,
  ): Promise<void> => {
    const response = await apiClient.get(
      `/meetings/${meetingId}/attachments/${attachmentId}/download?organizationId=${organizationId}`,
      { responseType: 'blob' },
    );
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export interface ScorecardGroup {
  id: string;
  meetingId: string;
  timeframe: string;
  name: string;
  description: string | null;
  order: number;
}

export const scorecardGroupsService = {
  list: async (
    organizationId: string,
    meetingId: string,
    timeframe?: string,
  ): Promise<ScorecardGroup[]> => {
    const params = new URLSearchParams({ organizationId });
    if (timeframe) params.set('timeframe', timeframe);
    const response = await apiClient.get<ScorecardGroup[]>(
      `/meetings/${meetingId}/scorecard-groups?${params}`,
    );
    return response.data;
  },
  create: async (
    organizationId: string,
    meetingId: string,
    data: { timeframe: string; name: string; description?: string },
  ): Promise<ScorecardGroup> => {
    const response = await apiClient.post<ScorecardGroup>(
      `/meetings/${meetingId}/scorecard-groups?organizationId=${organizationId}`,
      data,
    );
    return response.data;
  },
  update: async (
    organizationId: string,
    meetingId: string,
    groupId: string,
    data: { name?: string; description?: string },
  ): Promise<ScorecardGroup> => {
    const response = await apiClient.put<ScorecardGroup>(
      `/meetings/${meetingId}/scorecard-groups/${groupId}?organizationId=${organizationId}`,
      data,
    );
    return response.data;
  },
  delete: async (
    organizationId: string,
    meetingId: string,
    groupId: string,
  ): Promise<void> => {
    await apiClient.delete(
      `/meetings/${meetingId}/scorecard-groups/${groupId}?organizationId=${organizationId}`,
    );
  },
};

export type ScorecardMainGroupSettings = {
  hidden?: boolean;
  name?: string;
  description?: string;
} | null;

export const scorecardMainGroupService = {
  get: async (
    organizationId: string,
    meetingId: string,
  ): Promise<ScorecardMainGroupSettings> => {
    const response = await apiClient.get<ScorecardMainGroupSettings>(
      `/meetings/${meetingId}/scorecard-main-group?organizationId=${organizationId}`,
    );
    return response.data;
  },
  update: async (
    organizationId: string,
    meetingId: string,
    data: { hidden?: boolean; name?: string; description?: string },
  ): Promise<ScorecardMainGroupSettings> => {
    const response = await apiClient.patch<ScorecardMainGroupSettings>(
      `/meetings/${meetingId}/scorecard-main-group?organizationId=${organizationId}`,
      data,
    );
    return response.data;
  },
};

export interface ScorecardMeasurableDto {
  id: string;
  groupId: string | null;
  title: string;
  goal: string;
  average: string;
  total: string;
  trend: 'up' | 'down' | 'neutral';
  periodValues: Record<string, string>;
}

export const scorecardMeasurablesService = {
  list: async (
    organizationId: string,
    meetingId: string,
  ): Promise<ScorecardMeasurableDto[]> => {
    const response = await apiClient.get<ScorecardMeasurableDto[]>(
      `/meetings/${meetingId}/scorecard-measurables?organizationId=${organizationId}`,
    );
    return response.data;
  },
  updateGroup: async (
    organizationId: string,
    meetingId: string,
    measurableId: string,
    scorecardGroupId: string | null,
  ): Promise<unknown> => {
    const response = await apiClient.patch(
      `/meetings/${meetingId}/scorecard-measurables/${measurableId}/group?organizationId=${organizationId}`,
      { scorecardGroupId },
    );
    return response.data;
  },
  upsert: async (
    organizationId: string,
    meetingId: string,
    measurables: Array<{
      id: string;
      scorecardGroupId?: string | null;
      title: string;
      goal?: string;
      average?: string;
      total?: string;
      trend?: string;
      periodValues?: Record<string, string>;
      order?: number;
    }>,
  ): Promise<ScorecardMeasurableDto[]> => {
    const response = await apiClient.put<ScorecardMeasurableDto[]>(
      `/meetings/${meetingId}/scorecard-measurables?organizationId=${organizationId}`,
      { measurables },
    );
    return response.data;
  },
  delete: async (
    organizationId: string,
    meetingId: string,
    measurableId: string,
  ): Promise<void> => {
    await apiClient.delete(
      `/meetings/${meetingId}/scorecard-measurables/${measurableId}?organizationId=${organizationId}`,
    );
  },
};
