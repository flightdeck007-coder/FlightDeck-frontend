'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/constants/routes';
import { meetingSeriesService, type MeetingSeries } from '@/lib/api/meeting-series.service';
import { teamsService, type Team } from '@/lib/api/teams.service';
import { Calendar, Plus } from 'lucide-react';
import { SimpleTable } from '@/components/ui/SimpleTable';

export default function MeetingsAgendasPage() {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState<string>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [agendas, setAgendas] = useState<MeetingSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newAgendaName, setNewAgendaName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    const storedOrgId = typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null;
    const storedTeamId = typeof window !== 'undefined' ? localStorage.getItem('currentTeamId') : null;
    if (!storedOrgId) {
      setLoading(false);
      return;
    }
    setOrganizationId(storedOrgId);
    teamsService.list(storedOrgId).then((list) => {
      setTeams(list);
      const teamId = storedTeamId && list.some((t) => t.id === storedTeamId) ? storedTeamId : list[0]?.id ?? '';
      setSelectedTeamId(teamId);
      if (teamId) {
        meetingSeriesService.list(storedOrgId, teamId).then(setAgendas).catch(() => setAgendas([]));
      } else {
        setAgendas([]);
      }
    }).catch(() => setAgendas([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!organizationId || !selectedTeamId) return;
    setLoading(true);
    meetingSeriesService.list(organizationId, selectedTeamId).then(setAgendas).catch(() => setAgendas([])).finally(() => setLoading(false));
  }, [organizationId, selectedTeamId]);

  const handleCreateAgenda = async () => {
    if (!organizationId || !selectedTeamId || !newAgendaName.trim()) return;
    setCreateLoading(true);
    try {
      const created = await meetingSeriesService.create(organizationId, {
        teamId: selectedTeamId,
        name: newAgendaName.trim(),
        type: 'EOS',
      });
      setCreateModalOpen(false);
      setNewAgendaName('');
      setAgendas((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      router.push(ROUTES.MEETING_AGENDA_EDIT(created.id));
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-semibold text-foreground">
          Agendas <span className="text-muted-foreground font-normal">{agendas.length}</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage meeting agendas for your team.
        </p>

        <div className="mt-6 bg-card rounded-xl overflow-hidden">
          <SimpleTable
            columns={[
              { key: 'title', label: 'Title' },
              { key: 'type', label: 'Type', align: 'right', className: 'w-24' },
            ]}
            headerRowClassName="border-b border-border/50"
          >
            {loading ? (
              <tr>
                <td colSpan={2} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  Loading…
                </td>
              </tr>
            ) : agendas.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  No agendas yet. Create one below.
                </td>
              </tr>
            ) : (
              agendas.map((series) => (
                <tr
                  key={series.id}
                  onClick={() => router.push(ROUTES.MEETING_AGENDA_EDIT(series.id))}
                  className="border-b border-border/30 last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-5 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-foreground">{series.name}</span>
                  </td>
                  <td className="px-4 py-5 text-muted-foreground text-sm text-right">
                    {series.type ?? 'EOS'}
                  </td>
                </tr>
              ))
            )}
          </SimpleTable>

          <div className="border-t border-border/30 px-4 py-4">
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="text-primary hover:text-primary/80 font-medium text-sm flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Create Agenda
            </button>
          </div>
        </div>
      </div>

      {createModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => { setCreateModalOpen(false); setNewAgendaName(''); }} aria-hidden />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">Create Agenda</h3>
              <p className="text-sm text-muted-foreground mb-4">Add a new meeting agenda for this team.</p>
              <input
                type="text"
                value={newAgendaName}
                onChange={(e) => setNewAgendaName(e.target.value)}
                placeholder="e.g. Level 10 Meeting™"
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateAgenda()}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setCreateModalOpen(false); setNewAgendaName(''); }}
                  className="px-4 py-2 border border-border rounded-md hover:bg-accent text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateAgenda()}
                  disabled={createLoading || !newAgendaName.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
                >
                  {createLoading ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
