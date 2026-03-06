'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Measurable Manager is shown as the scorecard segment view on the meeting page.
 * This route redirects so the meeting never unmounts (timer and sidebar continue).
 */
export default function KpiManagerPage() {
  const params = useParams();
  const meetingId = params.id as string;
  const router = useRouter();

  useEffect(() => {
    if (!meetingId) return;
    router.replace(`/meeting/${meetingId}?segment=scorecard&manager=1`);
  }, [meetingId, router]);

  return null;
}
