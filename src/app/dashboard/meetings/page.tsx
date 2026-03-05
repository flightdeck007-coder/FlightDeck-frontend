'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/constants/routes';

/** Meetings hub: redirect to upcoming by default. */
export default function MeetingsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(ROUTES.MEETINGS_UPCOMING);
  }, [router]);
  return null;
}
