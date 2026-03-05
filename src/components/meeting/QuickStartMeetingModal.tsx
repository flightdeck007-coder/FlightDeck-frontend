'use client';

import { useState } from 'react';
import { X, Calendar, Play } from 'lucide-react';
import { Select } from 'antd';
import type { MeetingSeries } from '@/lib/api/meeting-series.service';

interface QuickStartMeetingModalProps {
  agendas: MeetingSeries[];
  organizationId: string;
  teamId: string;
  onClose: () => void;
  onStart: (meetingSeriesId: string, meetingSeriesName: string) => Promise<void>;
  isStarting?: boolean;
}

export function QuickStartMeetingModal({
  agendas,
  organizationId,
  teamId,
  onClose,
  onStart,
  isStarting = false,
}: QuickStartMeetingModalProps) {
  const [selectedAgendaId, setSelectedAgendaId] = useState<string>(agendas[0]?.id ?? '');
  const [error, setError] = useState('');

  const selectedAgenda = agendas.find((a) => a.id === selectedAgendaId);

  const handleStart = async () => {
    if (!selectedAgendaId || !selectedAgenda) {
      setError('Please select an agenda.');
      return;
    }
    setError('');
    try {
      await onStart(selectedAgendaId, selectedAgenda.name);
      onClose();
    } catch {
      setError('Failed to start meeting.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-xl border border-border bg-card shadow-xl p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-start-meeting-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="quick-start-meeting-title" className="text-lg font-semibold text-foreground">
            Start a quick meeting
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
        <p className="text-sm text-muted-foreground mb-4">
          Choose an agenda to start the meeting now.
        </p>
        {agendas.length === 0 ? (
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
            No agendas for this team. Create one in Agendas first.
          </p>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-1">Agenda</label>
              <Select
                placeholder="Select agenda"
                value={selectedAgendaId || undefined}
                onChange={(v) => setSelectedAgendaId(v ?? '')}
                options={agendas.map((a) => ({ label: a.name, value: a.id }))}
                className="w-full"
                allowClear={false}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
            )}
          </>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-foreground hover:bg-foreground/10 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={isStarting || agendas.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            {isStarting ? 'Starting…' : 'Start meeting'}
          </button>
        </div>
      </div>
    </>
  );
}
