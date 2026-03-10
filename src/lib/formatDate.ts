/**
 * Shared date/time formatters. Use these everywhere we display dates or times
 * so we never show raw ISO or internal values (e.g. "tc") to users.
 */

export function formatDate(d: Date | string | number): string {
  const date = typeof d === 'object' && d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(d: Date | string | number): string {
  const date = typeof d === 'object' && d instanceof Date ? d : new Date(d);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateTime(d: Date | string | number): string {
  return `${formatDate(d)}, ${formatTime(d)}`;
}

/** Duration from start/end ISO strings (e.g. "1 hr 30 min"). */
export function formatDuration(startIso: string | undefined, endIso: string | undefined): string {
  if (!startIso || !endIso) return '—';
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const sec = Math.round((end - start) / 1000);
  if (sec < 60) return `${sec} sec`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ${sec % 60 ? `${sec % 60} sec` : ''}`.trim();
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

/** Minutes to human string (e.g. "1 hour 30 minutes"). */
export function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} minutes`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m ? `${h} hour${h !== 1 ? 's' : ''} ${m} minutes` : `${h} hour${h !== 1 ? 's' : ''}`;
}

/** Total duration from recap sectionDurations (array of "MM:SS"). Returns e.g. "1 hr 30 min". */
export function formatDurationFromSectionDurations(
  sectionDurations: Array<{ sectionTitle: string; durationMMSS: string }> | undefined
): string {
  if (!sectionDurations?.length) return '—';
  let totalSeconds = 0;
  for (const s of sectionDurations) {
    const parts = (s.durationMMSS || '').trim().split(':');
    if (parts.length >= 2) {
      const m = parseInt(parts[0], 10) || 0;
      const sec = parseInt(parts[1], 10) || 0;
      totalSeconds += m * 60 + sec;
    }
  }
  if (totalSeconds < 60) return `${totalSeconds} sec`;
  if (totalSeconds < 3600) return `${Math.floor(totalSeconds / 60)} min`;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** Section duration "MM:SS" - display as-is (already formatted) or ensure no raw value. */
export function formatSegmentDuration(mmss: string): string {
  if (!mmss || typeof mmss !== 'string') return '0:00';
  const parts = mmss.trim().split(':');
  if (parts.length >= 2) {
    const m = parseInt(parts[0], 10) || 0;
    const s = parseInt(parts[1], 10) || 0;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return mmss;
}

/**
 * Relative time for display (e.g. "Just now", "5 min ago", "2 hours ago").
 * Use this so we never show raw UTC/ISO to users.
 */
export function formatRelativeTime(d: Date | string | number): string {
  const date = typeof d === 'object' && d instanceof Date ? d : new Date(d);
  const now = Date.now();
  const ms = date.getTime();
  if (Number.isNaN(ms)) return '—';
  const diffMs = now - ms;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec} sec ago`;
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(date);
}

/**
 * Format a value for display as date/time when it might be ISO or already human-readable.
 * Use for fields like "created" so we never show raw UTC/ISO.
 */
export function formatDateOrPass(value: string | undefined | null): string {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return formatDateTime(d);
}
