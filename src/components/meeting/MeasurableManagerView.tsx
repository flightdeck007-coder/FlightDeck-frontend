'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  Plus,
  MoreHorizontal,
  Download,
  FileText,
  User,
  Copy,
  CheckSquare,
  AlertTriangle,
  Trash2,
  ArrowRightToLine,
  Target,
  RotateCcw,
  X,
} from 'lucide-react';
import { scorecardMeasurablesService } from '@/lib/api/meetings.service';
import { meetingsService } from '@/lib/api/meetings.service';
import { CreatePopup } from '@/components/meeting/CreatePopup';
import { RichTextEditor } from '@/components/meeting/RichTextEditor';
import { Select, Input } from 'antd';

export type MeasurableRow = {
  id: string;
  title: string;
  goal: string;
  average: string;
  total: string;
  trend: string;
  periodValues: Record<string, string>;
  groupId?: string;
};

function downloadCsv(rows: MeasurableRow[], filename: string) {
  const periodKeys = rows.length ? Object.keys(rows.reduce((acc, r) => ({ ...acc, ...r.periodValues }), {} as Record<string, string>)) : [];
  const headers = ['Title', 'Goal', 'Average', 'Total', 'Trend', ...periodKeys];
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [headers.map(escape).join(','), ...rows.map((r) => [r.title, r.goal, r.average, r.total, r.trend, ...periodKeys.map((k) => r.periodValues[k] ?? '')].map(String).map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPdf(rows: MeasurableRow[], title: string) {
  const periodKeys = rows.length ? Object.keys(rows.reduce((acc, r) => ({ ...acc, ...r.periodValues }), {} as Record<string, string>)) : [];
  const headers = ['Title', 'Goal', 'Average', 'Total', 'Trend', ...periodKeys];
  const th = headers.map((h) => `<th style="border:1px solid #ccc;padding:6px;text-align:left">${h}</th>`).join('');
  const trs = rows.map((r) => `<tr>${[r.title, r.goal, r.average, r.total, r.trend, ...periodKeys.map((k) => r.periodValues[k] ?? '')].map((c) => `<td style="border:1px solid #ccc;padding:6px">${String(c)}</td>`).join('')}</tr>`).join('');
  const html = `<!DOCTYPE html><html><head><title>${title}</title></head><body><h2>${title}</h2><table style="border-collapse:collapse;width:100%"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.print(); w.close(); };
  }
}

interface MeasurableManagerViewProps {
  meetingId: string;
  organizationId: string;
  meeting: {
    team?: { name?: string };
    teamId?: string;
    attendances?: Array<{ id: string; user: { id: string; name?: string | null; email: string } }>;
  } | null;
}

export function MeasurableManagerView({ meetingId, organizationId, meeting }: MeasurableManagerViewProps) {
  const [measurables, setMeasurables] = useState<MeasurableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [personFilter, setPersonFilter] = useState('All');
  const ACHIEVED_KEY = `kpi-manager-achieved-${meetingId}`;
  const [achievedIds, setAchievedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined' || !meetingId) return new Set();
    try {
      const raw = window.localStorage.getItem(ACHIEVED_KEY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(arr);
    } catch { return new Set(); }
  });
  const [viewFilter, setViewFilter] = useState<'Active Measurables' | 'Archived Measurables'>('Active Measurables');
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchKpis, setSearchKpis] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [selectActionOpen, setSelectActionOpen] = useState(false);
  const [createPopupOpen, setCreatePopupOpen] = useState(false);
  const [createPopupInitialType, setCreatePopupInitialType] = useState<'todo' | 'issue' | undefined>(undefined);
  const [createPopupInitialTitle, setCreatePopupInitialTitle] = useState<string | undefined>(undefined);
  const [createPopupInitialDescription, setCreatePopupInitialDescription] = useState<string | undefined>(undefined);
  const [newMeasurableOpen, setNewMeasurableOpen] = useState(false);
  const [newMeasurableTitle, setNewMeasurableTitle] = useState('');
  const [newMeasurableDescription, setNewMeasurableDescription] = useState('');
  const [newMeasurableSaving, setNewMeasurableSaving] = useState(false);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignIds, setReassignIds] = useState<string[]>([]);
  const [reassignToUserId, setReassignToUserId] = useState<string | null>(null);
  const [reassignSaving, setReassignSaving] = useState(false);

  const persistAchieved = useCallback((ids: Set<string>) => {
    setAchievedIds(ids);
    if (typeof window !== 'undefined' && meetingId) window.localStorage.setItem(`kpi-manager-achieved-${meetingId}`, JSON.stringify([...ids]));
  }, [meetingId]);

  const fetchData = useCallback(async () => {
    if (!organizationId || !meetingId) return;
    setLoading(true);
    try {
      const list = await scorecardMeasurablesService.list(organizationId, meetingId);
      setMeasurables(list.map((m) => ({
        id: m.id,
        title: m.title,
        goal: m.goal,
        average: m.average,
        total: m.total,
        trend: m.trend,
        periodValues: m.periodValues ?? {},
        groupId: m.groupId ?? undefined,
      })));
    } catch {
      setMeasurables([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, meetingId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isActive = viewFilter === 'Active Measurables';
  const filtered = measurables.filter((m) => {
    const achieved = achievedIds.has(m.id);
    if (isActive && achieved) return false;
    if (!isActive && !achieved) return false;
    const q = searchKpis.trim().toLowerCase();
    if (q && !m.title.toLowerCase().includes(q)) return false;
    return true;
  });

  const teamName = meeting?.team?.name || 'Leadership Team';
  const selectedList = Array.from(selectedIds);

  const handleAchieve = useCallback(() => {
    setSelectActionOpen(false);
    setRowMenuId(null);
    const next = new Set(achievedIds);
    selectedList.forEach((id) => next.add(id));
    persistAchieved(next);
    setSelectedIds(new Set());
  }, [achievedIds, selectedList, persistAchieved]);

  const handleRestore = useCallback(() => {
    setSelectActionOpen(false);
    setRowMenuId(null);
    const next = new Set(achievedIds);
    selectedList.forEach((id) => next.delete(id));
    persistAchieved(next);
    setSelectedIds(new Set());
  }, [achievedIds, selectedList, persistAchieved]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (filtered.length === 0) return;
    const all = filtered.every((r) => selectedIds.has(r.id));
    setSelectedIds(all ? new Set() : new Set(filtered.map((r) => r.id)));
  };

  const handleExportCsv = () => {
    setMoreMenuOpen(false);
    downloadCsv(filtered, 'active-measurables.csv');
  };
  const handleExportPdf = () => {
    setMoreMenuOpen(false);
    downloadPdf(filtered, 'Active Measurables');
  };

  const openReassignModal = useCallback((ids?: string[]) => {
    setSelectActionOpen(false);
    setRowMenuId(null);
    setRowMenuAnchor(null);
    setReassignIds(ids ?? selectedList);
    setReassignToUserId(null);
    setReassignOpen(true);
  }, [selectedList]);

  const handleReassignConfirm = useCallback(async () => {
    if (!reassignToUserId || reassignIds.length === 0 || !organizationId || !meetingId) return;
    setReassignSaving(true);
    try {
      setReassignOpen(false);
      setReassignToUserId(null);
      setReassignIds([]);
      setSelectedIds(new Set());
    } finally {
      setReassignSaving(false);
    }
  }, [reassignToUserId, reassignIds.length, organizationId, meetingId]);

  const selectedMeasurablesForActions = filtered.filter((m) => selectedIds.has(m.id));
  const openCreateTodo = useCallback(() => {
    setSelectActionOpen(false);
    setRowMenuId(null);
    const n = selectedMeasurablesForActions.length;
    const title = `Review ${n} Measurable${n === 1 ? '' : 's'}`;
    const description = 'Measurables:\n' + selectedMeasurablesForActions.map((m) => '• ' + m.title).join('\n');
    setCreatePopupInitialType('todo');
    setCreatePopupInitialTitle(title);
    setCreatePopupInitialDescription(description);
    setCreatePopupOpen(true);
  }, [selectedMeasurablesForActions]);
  const openCreateIssue = useCallback(() => {
    setSelectActionOpen(false);
    setRowMenuId(null);
    const n = selectedMeasurablesForActions.length;
    const title = `Review ${n} Measurable${n === 1 ? '' : 's'}`;
    const description = 'Measurables:\n' + selectedMeasurablesForActions.map((m) => '• ' + m.title).join('\n');
    setCreatePopupInitialType('issue');
    setCreatePopupInitialTitle(title);
    setCreatePopupInitialDescription(description);
    setCreatePopupOpen(true);
  }, [selectedMeasurablesForActions]);

  const participants = meeting?.attendances?.map((a) => ({ id: a.user.id, label: a.user.name || a.user.email || a.user.id })) ?? [];

  const handleNewMeasurableSave = useCallback(async () => {
    const title = newMeasurableTitle.trim();
    if (!title || !organizationId || !meetingId) return;
    setNewMeasurableSaving(true);
    try {
      const id = `new-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      await scorecardMeasurablesService.upsert(organizationId, meetingId, [
        { id, title, goal: '', average: '', total: '', trend: 'neutral', periodValues: {}, scorecardGroupId: null },
      ]);
      setNewMeasurableTitle('');
      setNewMeasurableDescription('');
      setNewMeasurableOpen(false);
      fetchData();
    } catch (e) {
      console.error('Failed to create measurable', e);
    } finally {
      setNewMeasurableSaving(false);
    }
  }, [newMeasurableTitle, organizationId, meetingId, fetchData]);

  const sectionTitle = isActive ? 'Active Measurables' : 'Archived Measurables';
  const sectionDescription = isActive
    ? 'All Measurables used across the company to measure progress, performance, and success in achieving business goals.'
    : 'Measurables that have been achieved or archived.';

  function ownerColor(id: string) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
    return `hsl(${Math.abs(h) % 360}, 55%, 88%)`;
  }

  return (
    <>
      {/* Filters row */}
      <div className="border-b border-border bg-muted/30 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={personFilter} onChange={setPersonFilter} options={[{ label: 'All', value: 'All' }]} className="w-[120px]" />
          <Select
            value={viewFilter}
            onChange={(v) => v && setViewFilter(v as 'Active Measurables' | 'Archived Measurables')}
            options={[
              { label: 'Active Measurables', value: 'Active Measurables' },
              { label: 'Archived Measurables', value: 'Archived Measurables' },
            ]}
            className="w-[180px]"
          />
          <Select value={typeFilter} onChange={setTypeFilter} options={[{ label: 'All', value: 'All' }]} className="w-[100px]" />
          <Input.Search placeholder="Search KPIs..." value={searchKpis} onChange={(e) => setSearchKpis(e.target.value)} allowClear className="min-w-[180px] max-w-xs" />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setNewMeasurableOpen(true)} className="flex items-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-accent text-sm font-medium text-primary">
            <Plus className="w-4 h-4" /> New Measurable
          </button>
          <div className="relative">
            <button type="button" onClick={() => setMoreMenuOpen((o) => !o)} className="p-2 rounded-md border border-border hover:bg-accent text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {moreMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMoreMenuOpen(false)} aria-hidden />
                <div className="absolute right-0 top-full mt-1 py-2 bg-card border border-border rounded-lg shadow-xl z-20 min-w-[200px]">
                  <button type="button" className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 flex items-center gap-3" onClick={handleExportCsv}>
                    <Download className="w-4 h-4 text-muted-foreground" /> Download as CSV
                  </button>
                  <button type="button" className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 flex items-center gap-3" onClick={handleExportPdf}>
                    <FileText className="w-4 h-4 text-muted-foreground" /> Print PDF
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main: bordered section + table */}
      <main className="flex-1 overflow-auto px-6 py-6">
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="flex items-start justify-between gap-4 p-4 border-b border-border">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">{sectionTitle} {filtered.length}</h2>
              <p className="text-sm text-muted-foreground mt-1">{sectionDescription}</p>
            </div>
            {selectedList.length > 0 && (
              <div className="relative shrink-0">
                <button type="button" onClick={() => setSelectActionOpen((o) => !o)} className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium">
                  Select action <ChevronDown className="w-4 h-4" />
                </button>
                {selectActionOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSelectActionOpen(false)} aria-hidden />
                    <div className="absolute right-0 top-full mt-1 z-20 py-2 bg-card border border-border rounded-lg shadow-xl min-w-[220px]">
                      <div className="space-y-1">
                        <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-sm" onClick={() => openReassignModal()}> <ArrowRightToLine className="w-4 h-4" /> Reassign</button>
                        <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-sm"> <Copy className="w-4 h-4" /> Duplicate</button>
                        {isActive ? <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-sm" onClick={handleAchieve}> <Target className="w-4 h-4" /> Achieve</button> : <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-sm" onClick={handleRestore}> <RotateCcw className="w-4 h-4" /> Restore</button>}
                      </div>
                      <div className="border-t border-border my-2" />
                      <div className="space-y-1">
                        <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-sm" onClick={openCreateTodo}> <CheckSquare className="w-4 h-4" /> Create To-Do</button>
                        <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-sm" onClick={openCreateIssue}> <AlertTriangle className="w-4 h-4" /> Create Issue</button>
                      </div>
                      <div className="border-t border-border my-2" />
                      <div className="space-y-1">
                        <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 text-destructive rounded-sm"> <Trash2 className="w-4 h-4" /> Delete</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 w-10"><input type="checkbox" className="rounded border-border" checked={filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id))} onChange={toggleSelectAll} /></th>
                <th className="text-left p-3 font-medium text-foreground">Title</th>
                <th className="text-left p-3 font-medium text-foreground">Teams</th>
                <th className="text-left p-3 font-medium text-foreground w-16">Owner</th>
                <th className="text-left p-3 font-medium text-foreground">Location</th>
                <th className="text-left p-3 font-medium text-foreground">Last reported</th>
                <th className="w-10 p-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-b border-border"><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr className="border-b border-border"><td colSpan={7} className="p-8 text-center text-muted-foreground">{isActive ? 'No active measurables.' : 'No archived measurables.'}</td></tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border hover:bg-muted/20 last:border-b-0">
                    <td className="p-3"><input type="checkbox" className="rounded border-border" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} /></td>
                    <td className="p-3 font-medium text-foreground">{row.title}</td>
                    <td className="p-3 text-muted-foreground">{teamName}</td>
                    <td className="p-3">
                      <span className="w-8 h-8 rounded-full flex items-center justify-center inline-flex border border-border" style={{ backgroundColor: ownerColor(row.id) }}>
                        <User className="w-4 h-4 text-foreground/70" />
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">—</td>
                    <td className="p-3 text-muted-foreground">—</td>
                    <td className="p-3 relative">
                      <button type="button" onClick={(e) => { if (rowMenuId === row.id) { setRowMenuId(null); setRowMenuAnchor(null); } else { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setRowMenuAnchor({ top: rect.bottom + 4, left: rect.right }); setRowMenuId(row.id); } }} className="p-1 rounded hover:bg-accent text-muted-foreground"><MoreHorizontal className="w-4 h-4" /></button>
                      {rowMenuId === row.id && rowMenuAnchor != null && typeof document !== 'undefined' && createPortal(
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => { setRowMenuId(null); setRowMenuAnchor(null); }} aria-hidden />
                          <div className="fixed z-20 py-2 bg-card border border-border rounded-lg shadow-xl min-w-[180px]" style={{ top: rowMenuAnchor.top, right: typeof window !== 'undefined' ? window.innerWidth - rowMenuAnchor.left : 0 }}>
                            <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" onClick={() => { openReassignModal([row.id]); }}><ArrowRightToLine className="w-4 h-4" /> Reassign</button>
                            <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"><Copy className="w-4 h-4" /> Duplicate</button>
                            {isActive ? <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" onClick={() => { persistAchieved(new Set([...achievedIds, row.id])); setRowMenuId(null); setRowMenuAnchor(null); }}><Target className="w-4 h-4" /> Achieve</button> : <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" onClick={() => { const next = new Set(achievedIds); next.delete(row.id); persistAchieved(next); setRowMenuId(null); setRowMenuAnchor(null); }}><RotateCcw className="w-4 h-4" /> Restore</button>}
                            <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" onClick={() => { setCreatePopupInitialType('todo'); setCreatePopupInitialTitle('Review 1 Measurable'); setCreatePopupInitialDescription('Measurables:\n• ' + row.title); setCreatePopupOpen(true); setRowMenuId(null); setRowMenuAnchor(null); }}><CheckSquare className="w-4 h-4" /> Create To-Do</button>
                            <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" onClick={() => { setCreatePopupInitialType('issue'); setCreatePopupInitialTitle('Review 1 Measurable'); setCreatePopupInitialDescription('Measurables:\n• ' + row.title); setCreatePopupOpen(true); setRowMenuId(null); setRowMenuAnchor(null); }}><AlertTriangle className="w-4 h-4" /> Create Issue</button>
                            <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 text-destructive"><Trash2 className="w-4 h-4" /> Delete</button>
                          </div>
                        </>,
                        document.body
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      <CreatePopup open={createPopupOpen} onClose={() => { setCreatePopupOpen(false); setCreatePopupInitialType(undefined); setCreatePopupInitialTitle(undefined); setCreatePopupInitialDescription(undefined); }} teamName={teamName} teamId={meeting?.teamId} teams={[]} organizationId={organizationId || undefined} initialType={createPopupInitialType} initialTitle={createPopupInitialTitle} initialDescription={createPopupInitialDescription} />

      {newMeasurableOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setNewMeasurableOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border shadow-xl z-50 flex flex-col">
            <header className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-muted/20">
              <h3 className="text-lg font-semibold text-foreground">Create Measurable</h3>
              <button type="button" onClick={() => setNewMeasurableOpen(false)} className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Close"><X className="w-5 h-5" /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <section>
                <label className="block text-sm font-medium text-foreground mb-2">Name</label>
                <input type="text" value={newMeasurableTitle} onChange={(e) => setNewMeasurableTitle(e.target.value)} placeholder="Name" className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </section>
              <section>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">Description (Optional)</label>
                  <span className="text-xs text-muted-foreground">{(newMeasurableDescription.replace(/<[^>]*>/g, '').length)}/10000</span>
                </div>
                <RichTextEditor value={newMeasurableDescription} onChange={setNewMeasurableDescription} placeholder="Add a description" className="rounded-lg" />
              </section>
            </div>
            <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
              <button type="button" onClick={() => setNewMeasurableOpen(false)} className="px-4 py-2 border border-border rounded-md hover:bg-muted text-sm font-medium">Cancel</button>
              <button type="button" onClick={handleNewMeasurableSave} disabled={!newMeasurableTitle.trim() || newMeasurableSaving} className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium">Save</button>
            </footer>
          </div>
        </>
      )}

      {reassignOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setReassignOpen(false)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-card border border-border rounded-lg shadow-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Reassign Measurable {reassignIds.length}</h3>
              <button type="button" onClick={() => setReassignOpen(false)} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-muted-foreground">Are you sure you want to reassign the selected Measurables?</p>
            <ul className="list-disc list-inside text-sm text-foreground">
              {measurables.filter((m) => reassignIds.includes(m.id)).map((m) => (
                <li key={m.id}>{m.title}</li>
              ))}
            </ul>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Reassign to</label>
              <Select value={reassignToUserId ?? undefined} onChange={(v) => setReassignToUserId(v ?? null)} options={[{ label: 'Select…', value: '' }, ...participants.map((p) => ({ label: p.label, value: p.id }))]} className="w-full" placeholder="Select participant" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setReassignOpen(false)} className="px-4 py-2 border border-border rounded-md hover:bg-accent text-sm font-medium">Cancel</button>
              <button type="button" onClick={handleReassignConfirm} disabled={!reassignToUserId || reassignSaving} className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium">Reassign</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
