import { apiClient } from './client';

export interface SectionTemplateItem {
  title: string;
  durationMinutes: number;
  order: number;
  visible: boolean;
  isDefaultLocked: boolean;
  subtitle?: string;
  details?: string;
}

export interface MeetingSeries {
  id: string;
  organizationId: string;
  teamId: string;
  name: string;
  type?: string;
  cadence: string;
  sectionTemplate?: SectionTemplateItem[] | null;
  team?: { id: string; name: string };
}

export const meetingSeriesService = {
  list: async (organizationId: string, teamId: string): Promise<MeetingSeries[]> => {
    const res = await apiClient.get<MeetingSeries[]>(
      `/meeting-series?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`
    );
    return res.data;
  },

  get: async (organizationId: string, seriesId: string): Promise<MeetingSeries> => {
    const res = await apiClient.get<MeetingSeries>(
      `/meeting-series/${seriesId}?organizationId=${encodeURIComponent(organizationId)}`
    );
    return res.data;
  },

  create: async (
    organizationId: string,
    dto: { teamId: string; name: string; cadence?: string; type?: string }
  ): Promise<MeetingSeries> => {
    const res = await apiClient.post<MeetingSeries>(
      `/meeting-series?organizationId=${encodeURIComponent(organizationId)}`,
      dto
    );
    return res.data;
  },

  update: async (
    organizationId: string,
    seriesId: string,
    dto: { name?: string; cadence?: string; type?: string; sectionTemplate?: SectionTemplateItem[] }
  ): Promise<MeetingSeries> => {
    const res = await apiClient.patch<MeetingSeries>(
      `/meeting-series/${seriesId}?organizationId=${encodeURIComponent(organizationId)}`,
      dto
    );
    return res.data;
  },
};
