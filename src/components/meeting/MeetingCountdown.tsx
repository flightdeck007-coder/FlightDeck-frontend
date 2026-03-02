'use client';

import { useState, useEffect } from 'react';

interface MeetingCountdownProps {
  scheduledAt: string;
  className?: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function MeetingCountdown({ scheduledAt, className = '' }: MeetingCountdownProps) {
  const [remaining, setRemaining] = useState<number>(() =>
    Math.max(0, new Date(scheduledAt).getTime() - Date.now())
  );

  useEffect(() => {
    const target = new Date(scheduledAt).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  const canJoin = remaining <= 0;
  const text = canJoin ? 'Join' : `Starts in ${formatRemaining(remaining)}`;

  return (
    <span className={`text-xs font-medium ${className}`}>
      {text}
    </span>
  );
}
