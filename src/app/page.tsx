'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/constants/routes';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push(ROUTES.DASHBOARD);
      } else {
        router.push(ROUTES.LOGIN);
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <p className="text-foreground/70">Loading...</p>
    </div>
  );
}
