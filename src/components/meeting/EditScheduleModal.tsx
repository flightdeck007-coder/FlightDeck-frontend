'use client';

import { useState, useEffect } from 'react';
import { X, User, Save } from 'lucide-react';
import { Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { MobileDatePicker } from '@mui/x-date-pickers/MobileDatePicker';
import { MobileTimePicker } from '@mui/x-date-pickers/MobileTimePicker';
import type { TeamMember } from '@/lib/api/teams.service';
import { meetingsService, type Meeting } from '@/lib/api/meetings.service';

const pickerTextFieldSx = {
  '& .MuiInputLabel-root': { color: 'var(--foreground) !important', '&.Mui-focused': { color: 'var(--primary) !important' } },
  '& .MuiOutlinedInput-root': {
    backgroundColor: 'var(--background)',
    color: 'var(--foreground) !important',
    '& fieldset': { borderColor: 'var(--border)' },
    '&:hover fieldset': { borderColor: 'var(--foreground)' },
    '&.Mui-focused fieldset': { borderColor: 'var(--primary)', borderWidth: '1px' },
  },
  '& .MuiInputBase-input': { color: 'var(--foreground) !important', WebkitTextFillColor: 'var(--foreground)' },
  '& .MuiInputAdornment-root .MuiSvgIcon-root': { color: 'var(--foreground) !important' },
  '& .MuiIconButton-root': { color: 'var(--foreground) !important' },
};

interface EditScheduleModalProps {
  open: boolean;
  meeting: Meeting | null;
  organizationId: string;
  members: TeamMember[];
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function EditScheduleModal({
  open,
  meeting,
  organizationId,
  members,
  currentUserId,
  onClose,
  onSaved,
}: EditScheduleModalProps) {
  const [dateValue, setDateValue] = useState<Dayjs | null>(null);
  const [timeValue, setTimeValue] = useState<Dayjs | null>(null);
  const [facilitatorId, setFacilitatorId] = useState<string>('');
  const [scribeId, setScribeId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!meeting || !open) return;
    const d = new Date(meeting.scheduledAt);
    setDateValue(dayjs(d));
    setTimeValue(dayjs(d));
    setFacilitatorId(meeting.facilitatorId ?? currentUserId);
    setScribeId(meeting.scribeId ?? '');
  }, [meeting, open, currentUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting) return;
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
      await meetingsService.update(organizationId, meeting.id, {
        scheduledAt: scheduledAt.toISOString(),
        facilitatorId: facilitatorId || null,
        scribeId: scribeId || null,
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || 'Failed to update meeting');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !meeting) return null;

  const title = `Update Scheduled ${meeting.series.name}`;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border border-border bg-card shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-schedule-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 id="edit-schedule-title" className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-md text-foreground hover:bg-muted transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto">
            <p className="text-sm text-muted-foreground">This meeting is not repeating.</p>
            {error && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">{error}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Date</label>
                <MobileDatePicker
                  value={dateValue}
                  onChange={setDateValue}
                  minDate={dayjs()}
                  slotProps={{
                    textField: { size: 'small', fullWidth: true, sx: pickerTextFieldSx, inputProps: { style: { color: 'var(--foreground)' } } },
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Time</label>
                <MobileTimePicker
                  value={timeValue}
                  onChange={setTimeValue}
                  slotProps={{
                    textField: { size: 'small', fullWidth: true, sx: pickerTextFieldSx, inputProps: { style: { color: 'var(--foreground)' } } },
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  <span className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Facilitator
                  </span>
                </label>
                <Select
                  value={facilitatorId || undefined}
                  onChange={setFacilitatorId}
                  options={members.map((m) => ({
                    label: `${m.user.name || m.user.email}${m.userId === currentUserId ? ' (you)' : ''}`,
                    value: m.userId,
                  }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Scribe</label>
                <Select
                  placeholder="Select scribe"
                  value={scribeId || undefined}
                  onChange={setScribeId}
                  options={members.map((m) => ({
                    label: `${m.user.name || m.user.email}${m.userId === currentUserId ? ' (you)' : ''}`,
                    value: m.userId,
                  }))}
                  className="w-full"
                  allowClear
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-border text-foreground hover:bg-foreground/10 text-sm font-medium">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </LocalizationProvider>
  );
}
