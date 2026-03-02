'use client';

import { useState } from 'react';
import { X, User } from 'lucide-react';
import dayjs, { type Dayjs } from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { MobileDatePicker } from '@mui/x-date-pickers/MobileDatePicker';
import { MobileTimePicker } from '@mui/x-date-pickers/MobileTimePicker';
import type { TeamMember } from '@/lib/api/teams.service';
import { meetingsService, type CreateMeetingDto } from '@/lib/api/meetings.service';

const pickerTextFieldSx = {
  '& .MuiInputLabel-root': {
    color: 'var(--foreground) !important',
    '&.Mui-focused': { color: 'var(--primary) !important' },
  },
  '& .MuiOutlinedInput-root': {
    backgroundColor: 'var(--background)',
    color: 'var(--foreground) !important',
    '& fieldset': { borderColor: 'var(--border)' },
    '&:hover fieldset': { borderColor: 'var(--foreground)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--primary)', borderWidth: '1px' },
  },
  '& .MuiInputBase-input': {
    color: 'var(--foreground) !important',
    WebkitTextFillColor: 'var(--foreground)',
    '&::placeholder': { color: 'var(--foreground)', opacity: 0.7 },
  },
  '& .MuiInputAdornment-root .MuiSvgIcon-root': {
    color: 'var(--foreground) !important',
  },
  '& .MuiIconButton-root': {
    color: 'var(--foreground) !important',
  },
};

interface ScheduleMeetingModalProps {
  organizationId: string;
  teamId: string;
  teamName: string;
  members: TeamMember[];
  currentUserId: string;
  onClose: () => void;
  onScheduled: () => void;
  onCreatingChange?: (creating: boolean) => void;
}

export function ScheduleMeetingModal({
  organizationId,
  teamId,
  teamName,
  members,
  currentUserId,
  onClose,
  onScheduled,
  onCreatingChange,
}: ScheduleMeetingModalProps) {
  const [agenda, setAgenda] = useState('Weekly L10');
  const [dateValue, setDateValue] = useState<Dayjs | null>(() => dayjs().add(1, 'day'));
  const [timeValue, setTimeValue] = useState<Dayjs | null>(() => dayjs().hour(14).minute(0).second(0).millisecond(0));
  const [facilitatorId, setFacilitatorId] = useState(currentUserId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const d = dateValue ?? dayjs();
    const t = timeValue ?? dayjs();
    const scheduledAt = d.hour(t.hour()).minute(t.minute()).second(0).millisecond(0).toDate();
    if (scheduledAt.getTime() < Date.now()) {
      setError('Schedule time must be in the future.');
      return;
    }
    try {
      setSaving(true);
      onCreatingChange?.(true);
      const payload: CreateMeetingDto = {
        teamId,
        meetingSeriesName: agenda.trim() || 'Weekly L10',
        scheduledAt: scheduledAt.toISOString(),
      };
      if (facilitatorId?.trim()) {
        payload.facilitatorId = facilitatorId.trim();
      }
      await meetingsService.create(organizationId, payload);
      onScheduled();
      onClose();
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      setError(message || 'Failed to schedule meeting');
    } finally {
      setSaving(false);
      onCreatingChange?.(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md max-h-[90vh] overflow-hidden rounded-xl border border-border bg-card shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-meeting-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 id="schedule-meeting-title" className="text-lg font-semibold text-foreground">
            Schedule a meeting
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-foreground hover:bg-foreground/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto">
            <p className="text-sm text-foreground/70">Choose when to run this meeting. You can set the facilitator for who runs it.</p>
            {error && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Agenda</label>
              <input
                type="text"
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                placeholder="e.g. Weekly L10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Date</label>
              <MobileDatePicker
                value={dateValue}
                onChange={(v) => setDateValue(v)}
                minDate={dayjs()}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: pickerTextFieldSx,
                    inputProps: {
                      style: { color: 'var(--foreground)' },
                    },
                  },
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Time</label>
              <MobileTimePicker
                value={timeValue}
                onChange={(v) => setTimeValue(v)}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: pickerTextFieldSx,
                    inputProps: {
                      style: { color: 'var(--foreground)' },
                    },
                  },
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Facilitator
                </span>
              </label>
              <select
                value={facilitatorId}
                onChange={(e) => setFacilitatorId(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              >
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name || m.user.email} {m.userId === currentUserId ? '(you)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-foreground/80 mt-1">The facilitator has full control when the meeting starts.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-accent/30 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-border text-foreground hover:bg-foreground/10 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </LocalizationProvider>
  );
}
