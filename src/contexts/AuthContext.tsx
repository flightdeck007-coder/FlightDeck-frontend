'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, AuthResponse } from '@/lib/api/auth.service';
import { ROUTES } from '@/lib/constants/routes';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name?: string,
    organizationInviteCode?: string,
    organizationName?: string,
  ) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function persistTokenCookie(token: string) {
  // Ensure value is cookie-safe and sent to middleware on same-site navigations.
  document.cookie = `token=${encodeURIComponent(token)}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing auth on mount
    const storedToken = authService.getToken();
    const storedUser = authService.getCurrentUser();
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response: AuthResponse = await authService.login({ email, password });
    setToken(response.access_token);
    setUser(response.user);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      // Also set cookie for middleware
      persistTokenCookie(response.access_token);
      
      // Auto-set organization if provided
      if (response.organization) {
        localStorage.setItem('organizationId', response.organization.id);
        localStorage.setItem('organizationName', response.organization.name);
        if (response.organizationRole) {
          localStorage.setItem('organizationRole', response.organizationRole);
        }
      }
    }
  };

  const register = async (
    email: string,
    password: string,
    name?: string,
    organizationInviteCode?: string,
    organizationName?: string,
  ) => {
    const response: AuthResponse = await authService.register({
      email,
      password,
      name,
      organizationInviteCode,
      organizationName,
    });
    setToken(response.access_token);
    setUser(response.user);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      // Also set cookie for middleware
      persistTokenCookie(response.access_token);
      
      // Auto-set organization if provided (from signup)
      if (response.organization) {
        localStorage.setItem('organizationId', response.organization.id);
        localStorage.setItem('organizationName', response.organization.name);
        if (response.organizationRole) {
          localStorage.setItem('organizationRole', response.organizationRole);
        }
      }
    }
  };

  const logout = () => {
    authService.logout();
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      window.location.href = ROUTES.LOGIN;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        isLoading,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
