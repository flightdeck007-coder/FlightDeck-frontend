import { apiClient } from './client';

export interface TeamMemberUser {
  id: string;
  email: string;
  name?: string;
}

export interface TeamMember {
  teamId: string;
  userId: string;
  user: TeamMemberUser;
}

export interface Team {
  id: string;
  name: string;
  organizationId: string;
  members?: TeamMember[];
}

export interface CreateTeamDto {
  organizationId: string;
  name: string;
}

export interface UpdateTeamDto {
  name?: string;
}

export const teamsService = {
  async list(organizationId: string): Promise<Team[]> {
    const res = await apiClient.get<Team[]>(`/teams?organizationId=${organizationId}`);
    return res.data;
  },

  async getOne(organizationId: string, teamId: string): Promise<Team> {
    const res = await apiClient.get<Team>(`/teams/${teamId}?organizationId=${organizationId}`);
    return res.data;
  },

  async create(dto: CreateTeamDto): Promise<Team> {
    const res = await apiClient.post<Team>('/teams', dto);
    return res.data;
  },

  async update(id: string, dto: UpdateTeamDto): Promise<Team> {
    const res = await apiClient.patch<Team>(`/teams/${id}`, dto);
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/teams/${id}`);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/teams/${id}`);
  },

  async addMember(teamId: string, dto: { email: string }) {
    const res = await apiClient.post(`/teams/${teamId}/members`, dto);
    return res.data;
  },

  async removeMember(teamId: string, userId: string): Promise<void> {
    await apiClient.delete(`/teams/${teamId}/members/${userId}`);
  },
};

