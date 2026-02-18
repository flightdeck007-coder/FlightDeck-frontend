import { apiClient } from './client';

export interface RegisterDto {
  email: string;
  password: string;
  name?: string;
  organizationInviteCode?: string;
  organizationName?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
  organization?: {
    id: string;
    name: string;
    inviteCode: string;
  } | null;
  organizationRole?: 'ADMIN' | 'MANAGER' | 'MEMBER' | null;
}

export const authService = {
  register: async (data: RegisterDto): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginDto): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Clear cookie
      document.cookie = 'token=; path=/; max-age=0';
    }
  },

  getCurrentUser: () => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    }
    return null;
  },

  getToken: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  },

  validateInviteCode: async (code: string) => {
    // Public endpoint, no auth token needed
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const response = await fetch(`${apiUrl}/organizations/public/invite/${code}`);
    if (!response.ok) {
      throw new Error('Invalid invite code');
    }
    return response.json();
  },
};
