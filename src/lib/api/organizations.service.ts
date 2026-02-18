import { apiClient } from './client';

export interface OrganizationMember {
  id: string;
  role: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface TeamSummary {
  id: string;
  name: string;
}

export interface Organization {
  id: string;
  name: string;
  inviteCode: string;
  members: OrganizationMember[];
  teams: TeamSummary[];
}

export interface CreateOrganizationDto {
  name: string;
}

export interface UpdateOrganizationDto {
  name?: string;
}

export const organizationsService = {
  async list(): Promise<Organization[]> {
    const res = await apiClient.get<Organization[]>('/organizations');
    return res.data;
  },

  async create(dto: CreateOrganizationDto): Promise<Organization> {
    const res = await apiClient.post<Organization>('/organizations', dto);
    return res.data;
  },

  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    const res = await apiClient.patch<Organization>(`/organizations/${id}`, dto);
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/organizations/${id}`);
  },

  async addMember(
    organizationId: string,
    dto: { email: string; role?: 'ADMIN' | 'MANAGER' | 'MEMBER' },
  ) {
    const res = await apiClient.post(`/organizations/${organizationId}/members`, dto);
    return res.data;
  },

  async getMembers(organizationId: string): Promise<OrganizationMember[]> {
    const res = await apiClient.get<OrganizationMember[]>(`/organizations/${organizationId}/members`);
    return res.data;
  },

  async updateMemberRole(
    organizationId: string,
    userId: string,
    role: 'ADMIN' | 'MANAGER' | 'MEMBER',
  ): Promise<OrganizationMember> {
    const res = await apiClient.patch<OrganizationMember>(
      `/organizations/${organizationId}/members/${userId}/role`,
      { role },
    );
    return res.data;
  },
};

