'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ROUTES } from '@/lib/constants/routes';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(ROUTES.LOGIN);
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-foreground/70">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-foreground mb-6">Dashboard</h1>
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-foreground/70">Welcome to FlightDeck. Select an item from the sidebar to get started.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
