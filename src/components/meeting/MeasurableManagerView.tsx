'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
  Archive,
  RotateCcw,
  X,
  Search,
  Delete,
  Folder,
} from 'lucide-react';
import { scorecardMeasurablesService, scorecardGroupsService, type ScorecardGroup } from '@/lib/api/meetings.service';
import { meetingsService } from '@/lib/api/meetings.service';
import { CreatePopup } from '@/components/meeting/CreatePopup';
import { RichTextEditor } from '@/components/meeting/RichTextEditor';
import { Select, Input } from 'antd';
import { Info } from 'lucide-react';

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
  const headers = ['Metric Name', 'Target', 'Average', 'Total', 'Trend', ...periodKeys];
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
  const headers = ['Metric Name', 'Target', 'Average', 'Total', 'Trend', ...periodKeys];
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
  const [scorecardGroups, setScorecardGroups] = useState<ScorecardGroup[]>([]);
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
  const [viewFilter, setViewFilter] = useState<'Active Flight Metrics' | 'Archived Flight Metrics'>('Active Flight Metrics');
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
  const [createPopupInitialLinkedEntity, setCreatePopupInitialLinkedEntity] = useState<{ type: 'measurable'; id: string; title: string } | undefined>(undefined);
  const [newMeasurableOpen, setNewMeasurableOpen] = useState(false);
  const [newMeasurableTitle, setNewMeasurableTitle] = useState('');
  const [newMeasurableDescription, setNewMeasurableDescription] = useState('');
  const [newMeasurablePeriodInterval, setNewMeasurablePeriodInterval] = useState<string>('Weekly');
  const [newMeasurableOwnerId, setNewMeasurableOwnerId] = useState<string | null>(null);
  const [newMeasurableShowTotal, setNewMeasurableShowTotal] = useState(true);
  const [newMeasurableShowAverage, setNewMeasurableShowAverage] = useState(true);
  const [newMeasurableShowGoal, setNewMeasurableShowGoal] = useState(true);
  const [newMeasurableGoalUnit, setNewMeasurableGoalUnit] = useState('Number');
  const [newMeasurableGoalOrientation, setNewMeasurableGoalOrientation] = useState('Greater than or equal to goal');
  const [newMeasurableGoalValue, setNewMeasurableGoalValue] = useState(0);
  const [newMeasurableShowRollupAs, setNewMeasurableShowRollupAs] = useState('Total (default)');
  const [newMeasurableFormulaBuilder, setNewMeasurableFormulaBuilder] = useState(false);
  const [newMeasurableFormulaTokens, setNewMeasurableFormulaTokens] = useState<Array<{ type: 'measurable'; id: string; title: string } | { type: 'number'; value: number } | { type: 'operator'; value: string } | { type: 'comparison'; value: string }>>([]);
  const [newMeasurableFormulaAllowOverride, setNewMeasurableFormulaAllowOverride] = useState(false);
  const [formulaMeasurablePickerOpen, setFormulaMeasurablePickerOpen] = useState(false);
  const [formulaMeasurableSearch, setFormulaMeasurableSearch] = useState('');
  const [formulaNumberInputOpen, setFormulaNumberInputOpen] = useState(false);
  const [formulaNumberInputValue, setFormulaNumberInputValue] = useState('');
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

  const fetchGroups = useCallback(async () => {
    if (!organizationId || !meetingId) return;
    try {
      const list = await scorecardGroupsService.list(organizationId, meetingId);
      setScorecardGroups(list);
    } catch {
      setScorecardGroups([]);
    }
  }, [organizationId, meetingId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const isActive = viewFilter === 'Active Flight Metrics';
  const filtered = measurables.filter((m) => {
    const achieved = achievedIds.has(m.id);
    if (isActive && achieved) return false;
    if (!isActive && !achieved) return false;
    const q = searchKpis.trim().toLowerCase();
    if (q && !m.title.toLowerCase().includes(q)) return false;
    return true;
  });

  const teamName = meeting?.team?.name ?? 'No team found';
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
    downloadPdf(filtered, 'Active Flight Metrics');
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
    const title = `Review ${n} Flight Metric${n === 1 ? '' : 's'}`;
    const description = 'Measurables:\n' + selectedMeasurablesForActions.map((m) => '• ' + m.title).join('\n');
    const first = selectedMeasurablesForActions[0];
    setCreatePopupInitialType('todo');
    setCreatePopupInitialTitle(title);
    setCreatePopupInitialDescription(description);
    setCreatePopupInitialLinkedEntity(first ? { type: 'measurable', id: first.id, title: first.title } : undefined);
    setCreatePopupOpen(true);
  }, [selectedMeasurablesForActions]);
  const openCreateIssue = useCallback(() => {
    setSelectActionOpen(false);
    setRowMenuId(null);
    const n = selectedMeasurablesForActions.length;
    const title = `Review ${n} Flight Metric${n === 1 ? '' : 's'}`;
    const description = 'Measurables:\n' + selectedMeasurablesForActions.map((m) => '• ' + m.title).join('\n');
    const first = selectedMeasurablesForActions[0];
    setCreatePopupInitialType('issue');
    setCreatePopupInitialTitle(title);
    setCreatePopupInitialDescription(description);
    setCreatePopupInitialLinkedEntity(first ? { type: 'measurable', id: first.id, title: first.title } : undefined);
    setCreatePopupOpen(true);
  }, [selectedMeasurablesForActions]);

  const handleDelete = useCallback(async (ids: string[]) => {
    if (!organizationId || !meetingId || ids.length === 0) return;
    try {
      await Promise.all(ids.map((id) => scorecardMeasurablesService.delete(organizationId, meetingId, id)));
      setMeasurables((prev) => prev.filter((m) => !ids.includes(m.id)));
      setSelectedIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next; });
      setSelectActionOpen(false);
      setRowMenuId(null);
      setRowMenuAnchor(null);
    } catch (e) {
      console.error('Failed to delete measurables', e);
    }
  }, [organizationId, meetingId]);

  const handleDuplicate = useCallback(async (ids: string[]) => {
    if (!organizationId || !meetingId || ids.length === 0) return;
    const toDuplicate = measurables.filter((m) => ids.includes(m.id));
    if (toDuplicate.length === 0) return;
    const newRows = toDuplicate.map((m) => ({ ...m, id: `dup-${Date.now()}-${m.id}-${Math.random().toString(36).slice(2, 9)}` }));
    const next = [...measurables, ...newRows];
    try {
      await scorecardMeasurablesService.upsert(
        organizationId,
        meetingId,
        next.map((m, i) => ({
          id: m.id,
          scorecardGroupId: (m.groupId === undefined || m.groupId === 'main') ? null : m.groupId,
          title: m.title,
          goal: m.goal,
          average: m.average,
          total: m.total,
          trend: m.trend,
          periodValues: m.periodValues,
          order: i,
        }))
      );
      setMeasurables(next);
      setSelectActionOpen(false);
      setRowMenuId(null);
      setRowMenuAnchor(null);
      setSelectedIds(new Set());
      fetchData();
    } catch (e) {
      console.error('Failed to duplicate measurables', e);
    }
  }, [organizationId, meetingId, measurables, fetchData]);

  const participants = meeting?.attendances?.map((a) => ({ id: a.user.id, label: a.user.name || a.user.email || a.user.id })) ?? [];

  const handleNewMeasurableSave = useCallback(async () => {
    const title = newMeasurableTitle.trim();
    if (!title || !organizationId || !meetingId) return;
    const goalOp = newMeasurableGoalOrientation.includes('Greater') ? '>=' : newMeasurableGoalOrientation.includes('Less') ? '<=' : '=';
    const goalStr = `${goalOp} ${newMeasurableGoalValue}`;
    setNewMeasurableSaving(true);
    try {
      const id = `new-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      await scorecardMeasurablesService.upsert(organizationId, meetingId, [
        {
          id,
          title,
          goal: goalStr,
          average: newMeasurableShowAverage ? '0' : '',
          total: newMeasurableShowTotal ? '0' : '',
          trend: 'neutral',
          periodValues: {},
          scorecardGroupId: null,
        },
      ]);
      setNewMeasurableTitle('');
      setNewMeasurableDescription('');
      setNewMeasurablePeriodInterval('Weekly');
      setNewMeasurableOwnerId(null);
      setNewMeasurableShowTotal(true);
      setNewMeasurableShowAverage(true);
      setNewMeasurableShowGoal(true);
      setNewMeasurableGoalUnit('Number');
      setNewMeasurableGoalOrientation('Greater than or equal to goal');
      setNewMeasurableGoalValue(0);
      setNewMeasurableShowRollupAs('Total (default)');
      setNewMeasurableFormulaBuilder(false);
      setNewMeasurableFormulaTokens([]);
      setNewMeasurableFormulaAllowOverride(false);
      setNewMeasurableOpen(false);
      fetchData();
    } catch (e) {
      console.error('Failed to create measurable', e);
    } finally {
      setNewMeasurableSaving(false);
    }
  }, [newMeasurableTitle, newMeasurableGoalOrientation, newMeasurableGoalValue, newMeasurableShowAverage, newMeasurableShowTotal, organizationId, meetingId, fetchData]);

  const groupIdToTimeframe = useMemo(() => {
    const m = new Map<string, string>();
    scorecardGroups.forEach((g) =>
      m.set(g.id, g.timeframe ? g.timeframe.charAt(0).toUpperCase() + g.timeframe.slice(1) : '')
    );
    return m;
  }, [scorecardGroups]);

  const sectionTitle = isActive ? 'Active Flight Metrics' : 'Archived Flight Metrics';
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
      {/* Filters row: (3 filters + search) | (New Flight Metric + menu) — two responsive sections */}
      <div className="border-b border-border bg-muted/30 px-6 py-3 flex flex-wrap items-center justify-between gap-4 min-w-0 overflow-x-hidden">
        <div className="flex flex-wrap items-center gap-3 min-w-0 shrink">
          <Select value={personFilter} onChange={setPersonFilter} options={[{ label: 'All', value: 'All' }]} className="w-[120px] shrink-0" />
          <Select
            value={viewFilter}
            onChange={(v) => v && setViewFilter(v as 'Active Flight Metrics' | 'Archived Flight Metrics')}
            options={[
              { label: 'Active Flight Metrics', value: 'Active Flight Metrics' },
              { label: 'Archived Flight Metrics', value: 'Archived Flight Metrics' },
            ]}
            className="w-[180px] shrink-0"
          />
          <Select value={typeFilter} onChange={setTypeFilter} options={[{ label: 'All', value: 'All' }]} className="w-[100px] shrink-0" />
          <Input.Search placeholder="Search Flight Metrics..." value={searchKpis} onChange={(e) => setSearchKpis(e.target.value)} allowClear className="max-w-[200px] min-w-0 w-full text-sm shrink" />
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button type="button" onClick={() => setNewMeasurableOpen(true)} className="flex items-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-accent text-sm font-medium text-primary whitespace-nowrap">
            <Plus className="w-4 h-4" /> New Flight Metric
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
                    <div className="absolute right-0 top-full mt-1 z-20 py-2 bg-card border border-border rounded-lg shadow-xl min-w-[240px]">
                      <div className="px-2 py-1 space-y-0.5">
                        <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-md" onClick={() => openReassignModal()}><ArrowRightToLine className="w-4 h-4 shrink-0 text-muted-foreground" /> Reassign</button>
                        <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-md" onClick={() => handleDuplicate(selectedList)}><Copy className="w-4 h-4 shrink-0 text-muted-foreground" /> Duplicate</button>
                        {isActive ? <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-md" onClick={handleAchieve}><Archive className="w-4 h-4 shrink-0 text-muted-foreground" /> Archive</button> : <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-md" onClick={handleRestore}><RotateCcw className="w-4 h-4 shrink-0 text-muted-foreground" /> Restore</button>}
                      </div>
                      <div className="border-t border-border my-2" role="separator" />
                      <div className="px-2 py-1 space-y-0.5">
                        <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-md" onClick={openCreateTodo}><CheckSquare className="w-4 h-4 shrink-0 text-muted-foreground" /> Create Clearance</button>
                        <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-md" onClick={openCreateIssue}><AlertTriangle className="w-4 h-4 shrink-0 text-muted-foreground" /> Create Turbulence</button>
                      </div>
                      <div className="border-t border-border my-2" role="separator" />
                      <div className="px-2 py-1">
                        <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 text-destructive rounded-md" onClick={() => handleDelete(selectedList)}><Trash2 className="w-4 h-4 shrink-0" /> Delete</button>
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
                <th className="text-left p-3 font-medium text-foreground">Metric Name</th>
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
                <tr className="border-b border-border"><td colSpan={7} className="p-8 text-center text-muted-foreground">{isActive ? 'No active flight metrics.' : 'No archived flight metrics.'}</td></tr>
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
                    <td className="p-3 text-muted-foreground">{row.groupId ? (groupIdToTimeframe.get(row.groupId) ?? '—') : '—'}</td>
                    <td className="p-3 text-muted-foreground">—</td>
                    <td className="p-3 relative">
                      <button type="button" onClick={(e) => { if (rowMenuId === row.id) { setRowMenuId(null); setRowMenuAnchor(null); } else { const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setRowMenuAnchor({ top: rect.bottom + 4, left: rect.right }); setRowMenuId(row.id); } }} className="p-1 rounded hover:bg-accent text-muted-foreground"><MoreHorizontal className="w-4 h-4" /></button>
                      {rowMenuId === row.id && rowMenuAnchor != null && typeof document !== 'undefined' && createPortal(
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => { setRowMenuId(null); setRowMenuAnchor(null); }} aria-hidden />
                          <div className="fixed z-20 py-2 bg-card border border-border rounded-lg shadow-xl min-w-[220px]" style={{ top: rowMenuAnchor.top, right: typeof window !== 'undefined' ? window.innerWidth - rowMenuAnchor.left : 0 }}>
                            <div className="px-2 py-1 space-y-0.5">
                              <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-md" onClick={() => { openReassignModal([row.id]); }}><ArrowRightToLine className="w-4 h-4 shrink-0 text-muted-foreground" /> Reassign</button>
                              <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-md" onClick={() => { handleDuplicate([row.id]); setRowMenuId(null); setRowMenuAnchor(null); }}><Copy className="w-4 h-4 shrink-0 text-muted-foreground" /> Duplicate</button>
                              {isActive ? <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-md" onClick={() => { persistAchieved(new Set([...achievedIds, row.id])); setRowMenuId(null); setRowMenuAnchor(null); }}><Archive className="w-4 h-4 shrink-0 text-muted-foreground" /> Archive</button> : <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-md" onClick={() => { const next = new Set(achievedIds); next.delete(row.id); persistAchieved(next); setRowMenuId(null); setRowMenuAnchor(null); }}><RotateCcw className="w-4 h-4 shrink-0 text-muted-foreground" /> Restore</button>}
                            </div>
                            <div className="border-t border-border my-2" role="separator" />
                            <div className="px-2 py-1 space-y-0.5">
                              <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-md" onClick={() => { setCreatePopupInitialType('todo'); setCreatePopupInitialTitle(`Clearance: ${row.title}`); setCreatePopupInitialDescription('Flight Metrics:\n• ' + row.title); setCreatePopupInitialLinkedEntity({ type: 'measurable', id: row.id, title: row.title }); setCreatePopupOpen(true); setRowMenuId(null); setRowMenuAnchor(null); }}><CheckSquare className="w-4 h-4 shrink-0 text-muted-foreground" /> Create Clearance</button>
                              <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-md" onClick={() => { setCreatePopupInitialType('issue'); setCreatePopupInitialTitle(`Turbulence: ${row.title}`); setCreatePopupInitialDescription('Flight Metrics:\n• ' + row.title); setCreatePopupInitialLinkedEntity({ type: 'measurable', id: row.id, title: row.title }); setCreatePopupOpen(true); setRowMenuId(null); setRowMenuAnchor(null); }}><AlertTriangle className="w-4 h-4 shrink-0 text-muted-foreground" /> Create Turbulence</button>
                            </div>
                            <div className="border-t border-border my-2" role="separator" />
                            <div className="px-2 py-1">
                              <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 text-destructive rounded-md" onClick={() => { handleDelete([row.id]); setRowMenuId(null); setRowMenuAnchor(null); }}><Trash2 className="w-4 h-4 shrink-0" /> Delete</button>
                            </div>
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

      <CreatePopup open={createPopupOpen} onClose={() => { setCreatePopupOpen(false); setCreatePopupInitialType(undefined); setCreatePopupInitialTitle(undefined); setCreatePopupInitialDescription(undefined); setCreatePopupInitialLinkedEntity(undefined); }} teamName={teamName} teamId={meeting?.teamId} teams={[]} organizationId={organizationId || undefined} initialType={createPopupInitialType} initialTitle={createPopupInitialTitle} initialDescription={createPopupInitialDescription} initialLinkedEntity={createPopupInitialLinkedEntity} />

      {newMeasurableOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setNewMeasurableOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-card border-l border-border shadow-xl z-50 flex flex-col">
            <header className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-muted/20">
              <h3 className="text-lg font-semibold text-foreground">Create Flight Metric</h3>
              <div className="flex items-center gap-1">
                <button type="button" className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="More"><MoreHorizontal className="w-5 h-5" /></button>
                <button type="button" className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Add"><Plus className="w-5 h-5" /></button>
                <button type="button" onClick={() => { setNewMeasurableOpen(false); setNewMeasurableFormulaTokens([]); setNewMeasurableFormulaAllowOverride(false); setFormulaMeasurablePickerOpen(false); setFormulaNumberInputOpen(false); }} className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Close"><X className="w-5 h-5" /></button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-5">
              <section className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">Metric Name</label>
                <input type="text" value={newMeasurableTitle} onChange={(e) => setNewMeasurableTitle(e.target.value)} placeholder="Metric name" className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
              </section>

              <hr className="border-border my-6" />

              <section className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">Description (Optional)</label>
                  <span className="text-xs text-muted-foreground">{newMeasurableDescription.replace(/<[^>]*>/g, '').length}/10000</span>
                </div>
                <RichTextEditor value={newMeasurableDescription} onChange={setNewMeasurableDescription} placeholder="Add a description" className="rounded-lg" />
              </section>

              <hr className="border-border my-6" />

              <section className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">Reporting Interval</label>
                <Select
                  value={newMeasurablePeriodInterval}
                  onChange={(v) => v && setNewMeasurablePeriodInterval(v)}
                  className="w-full"
                  options={[
                    { label: 'Weekly', value: 'Weekly' },
                    { label: 'Monthly', value: 'Monthly' },
                    { label: 'Quarterly', value: 'Quarterly' },
                    { label: 'Annual', value: 'Annual' },
                  ]}
                />
              </section>

              <hr className="border-border my-6" />

              <section className="mb-6">
                <h4 className="text-sm font-semibold text-foreground mb-3">Owner</h4>
                <Select
                  value={newMeasurableOwnerId ?? undefined}
                  onChange={(v) => setNewMeasurableOwnerId(v || null)}
                  className="w-full"
                  placeholder="Select crew member"
                  allowClear
                  options={[{ label: 'Select…', value: '' }, ...participants.map((p) => ({ label: p.label, value: p.id }))]}
                />
              </section>

              <hr className="border-border my-6" />

              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-sm font-semibold text-foreground">Columns</h4>
                  <button type="button" className="p-0.5 rounded-full hover:bg-muted text-muted-foreground" aria-label="Info"><Info className="w-4 h-4" /></button>
                </div>
                <div className="space-y-4">
                  {[
                    { key: 'showTotal' as const, label: 'Show Total', desc: 'This column shows the sum total of all the data points in this row.' },
                    { key: 'showAverage' as const, label: 'Show Average', desc: 'This column shows the average of all the data points in this row.' },
                    { key: 'showGoal' as const, label: 'Show Target', desc: 'This column shows the intended target of this flight metric. You can choose to hide it for flight metrics you wish to just monitor.' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                      <button type="button" role="switch" aria-checked={key === 'showTotal' ? newMeasurableShowTotal : key === 'showAverage' ? newMeasurableShowAverage : newMeasurableShowGoal} onClick={() => { if (key === 'showTotal') setNewMeasurableShowTotal((o) => !o); if (key === 'showAverage') setNewMeasurableShowAverage((o) => !o); if (key === 'showGoal') setNewMeasurableShowGoal((o) => !o); }} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none mt-0.5 ${(key === 'showTotal' ? newMeasurableShowTotal : key === 'showAverage' ? newMeasurableShowAverage : newMeasurableShowGoal) ? 'bg-primary' : 'bg-muted'}`}>
                        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition translate-x-0.5 ${(key === 'showTotal' ? newMeasurableShowTotal : key === 'showAverage' ? newMeasurableShowAverage : newMeasurableShowGoal) ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <hr className="border-border my-6" />

              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-sm font-semibold text-foreground">Target</h4>
                  <button type="button" className="p-0.5 rounded-full hover:bg-muted text-muted-foreground" aria-label="Info"><Info className="w-4 h-4" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Unit</label>
                    <Select value={newMeasurableGoalUnit} onChange={(v) => v && setNewMeasurableGoalUnit(v)} className="w-full" options={[{ label: 'Number', value: 'Number' }, { label: 'Percentage', value: 'Percentage' }, { label: 'Currency', value: 'Currency' }]} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Orientation rule</label>
                    <Select value={newMeasurableGoalOrientation} onChange={(v) => v && setNewMeasurableGoalOrientation(v)} className="w-full" options={[{ label: 'Greater than or equal to goal', value: 'Greater than or equal to goal' }, { label: 'Less than or equal to goal', value: 'Less than or equal to goal' }, { label: 'Equal to goal', value: 'Equal to goal' }]} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Value</label>
                    <div className="flex">
                      <input type="number" value={newMeasurableGoalValue} onChange={(e) => setNewMeasurableGoalValue(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-l-lg rounded-r-none bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      <div className="flex flex-col border border-l-0 border-border rounded-r-lg overflow-hidden">
                        <button type="button" onClick={() => setNewMeasurableGoalValue((v) => v + 1)} className="px-2 py-0.5 border-b border-border hover:bg-muted text-foreground">▲</button>
                        <button type="button" onClick={() => setNewMeasurableGoalValue((v) => Math.max(0, v - 1))} className="px-2 py-0.5 hover:bg-muted text-foreground">▼</button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Show rollup data as</label>
                    <Select value={newMeasurableShowRollupAs} onChange={(v) => v && setNewMeasurableShowRollupAs(v)} className="w-full" options={[{ label: 'Total (default)', value: 'Total (default)' }, { label: 'Average', value: 'Average' }, { label: 'Min', value: 'Min' }, { label: 'Max', value: 'Max' }]} />
                  </div>
                </div>
              </section>

              <hr className="border-border my-6" />

              <section className="rounded-lg bg-muted/40 border border-border p-4">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Enable Formula Builder</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Build a custom formula with other Measurables.</p>
                  </div>
                  <button type="button" role="switch" aria-checked={newMeasurableFormulaBuilder} onClick={() => setNewMeasurableFormulaBuilder((o) => !o)} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${newMeasurableFormulaBuilder ? 'bg-primary' : 'bg-muted'}`}>
                    <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition translate-x-0.5 ${newMeasurableFormulaBuilder ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {newMeasurableFormulaBuilder && (
                  <div className="mt-4 pt-4 border-t border-border space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setFormulaMeasurablePickerOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium text-foreground">
                        <Folder className="w-4 h-4 text-muted-foreground" /> Flight metric group
                      </button>
                      <button type="button" onClick={() => { setFormulaNumberInputValue(''); setFormulaNumberInputOpen(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium text-foreground">
                        Number
                      </button>
                      {['+', '-', '×', '÷', '(', ')'].map((op) => (
                        <button key={op} type="button" onClick={() => setNewMeasurableFormulaTokens((t) => [...t, { type: 'operator', value: op }])} className="w-10 h-10 rounded-lg border border-border bg-muted/50 hover:bg-muted text-foreground text-lg font-medium shrink-0">
                          {op}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <button type="button" onClick={() => setNewMeasurableFormulaTokens((t) => t.slice(0, -1))} disabled={newMeasurableFormulaTokens.length === 0} className="w-10 h-10 rounded-lg border border-border bg-muted/50 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-foreground shrink-0" title="Remove last"><Delete className="w-4 h-4 mx-auto" /></button>
                      <button type="button" onClick={() => setNewMeasurableFormulaTokens([])} disabled={newMeasurableFormulaTokens.length === 0} className="w-10 h-10 rounded-lg border border-border bg-muted/50 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-foreground shrink-0">C</button>
                      <span className="text-xs text-muted-foreground ml-2">Comparison (only after a flight metric):</span>
                      {(['>=', '<=', '==', '>', '<'] as const).map((cmp) => {
                        const last = newMeasurableFormulaTokens[newMeasurableFormulaTokens.length - 1];
                        const canAdd = last?.type === 'measurable';
                        return (
                          <button key={cmp} type="button" disabled={!canAdd} onClick={() => setNewMeasurableFormulaTokens((t) => [...t, { type: 'comparison', value: cmp }])} className="px-2.5 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-sm font-mono text-foreground shrink-0">
                            {cmp}
                          </button>
                        );
                      })}
                    </div>
                    <div className="min-h-[100px] rounded-lg border border-border bg-muted/20 p-3">
                      {newMeasurableFormulaTokens.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Build a formula by adding a flight metric, number, or operator...</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 items-center">
                          {newMeasurableFormulaTokens.map((token, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${token.type === 'measurable' || token.type === 'number' ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-muted/60 text-foreground border border-border'}`}
                            >
                              {token.type === 'measurable' && <><Folder className="w-3.5 h-3.5" />{token.title}</>}
                              {token.type === 'number' && token.value}
                              {(token.type === 'operator' || token.type === 'comparison') && token.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Build a formula by adding a flight metric, number, or operator. Edit inline as needed.
                    </p>
                    <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Allow manual override</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Allow manually entered scores to override any calculated scores.</p>
                      </div>
                      <button type="button" role="switch" aria-checked={newMeasurableFormulaAllowOverride} onClick={() => setNewMeasurableFormulaAllowOverride((o) => !o)} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${newMeasurableFormulaAllowOverride ? 'bg-primary' : 'bg-muted'}`}>
                        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition translate-x-0.5 ${newMeasurableFormulaAllowOverride ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
            <footer className="flex items-center gap-2 px-5 py-4 border-t border-border shrink-0 bg-muted/10">
              <button type="button" onClick={() => { setNewMeasurableOpen(false); setNewMeasurableFormulaTokens([]); setNewMeasurableFormulaAllowOverride(false); setFormulaMeasurablePickerOpen(false); setFormulaNumberInputOpen(false); }} className="px-4 py-2.5 border border-border rounded-lg hover:bg-muted text-sm font-medium text-foreground">Cancel</button>
              <button type="button" onClick={handleNewMeasurableSave} disabled={!newMeasurableTitle.trim() || newMeasurableSaving} className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium">Save</button>
            </footer>
          </div>
        </>
      )}

      {/* Formula: Pick Flight Metric Group modal */}
      {formulaMeasurablePickerOpen && newMeasurableOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[60]" onClick={() => setFormulaMeasurablePickerOpen(false)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-full max-w-2xl max-h-[80vh] bg-card border border-border rounded-lg shadow-xl flex flex-col">
            <div className="p-4 border-b border-border shrink-0">
              <h3 className="text-lg font-semibold text-foreground">Flight Metric Groups</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Select a group to use in the formula. The formula will apply to that group.</p>
              <div className="mt-3">
                <Input.Search placeholder="Search groups..." value={formulaMeasurableSearch} onChange={(e) => setFormulaMeasurableSearch(e.target.value)} allowClear className="max-w-xs" />
              </div>
            </div>
            <div className="flex-1 overflow-auto min-h-0">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left p-3 w-10" />
                    <th className="text-left p-3 font-medium text-foreground">Location</th>
                    <th className="text-left p-3 font-medium text-foreground">Name</th>
                    <th className="text-left p-3 font-medium text-foreground">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {scorecardGroups
                    .filter((g) => !formulaMeasurableSearch.trim() || g.name.toLowerCase().includes(formulaMeasurableSearch.trim().toLowerCase()))
                    .map((g) => (
                      <tr key={g.id} className="border-b border-border hover:bg-muted/30">
                        <td className="p-3">
                          <button type="button" onClick={() => { setNewMeasurableFormulaTokens((t) => [...t, { type: 'measurable', id: g.id, title: g.name }]); setFormulaMeasurablePickerOpen(false); setFormulaMeasurableSearch(''); }} className="text-primary text-sm font-medium hover:underline">
                            Add
                          </button>
                        </td>
                        <td className="p-3 text-muted-foreground">{g.timeframe ? g.timeframe.charAt(0).toUpperCase() + g.timeframe.slice(1) : '—'}</td>
                        <td className="p-3 font-medium text-foreground">{g.name}</td>
                        <td className="p-3 text-muted-foreground">{g.description || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-border shrink-0 flex justify-end">
              <button type="button" onClick={() => { setFormulaMeasurablePickerOpen(false); setFormulaMeasurableSearch(''); }} className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm font-medium">Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* Formula: Enter number modal */}
      {formulaNumberInputOpen && newMeasurableOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[60]" onClick={() => setFormulaNumberInputOpen(false)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-full max-w-sm bg-card border border-border rounded-lg shadow-xl p-5 flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-foreground">Add number</h3>
            <input type="number" value={formulaNumberInputValue} onChange={(e) => setFormulaNumberInputValue(e.target.value)} placeholder="Enter a number" className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" autoFocus />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setFormulaNumberInputOpen(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm font-medium">Cancel</button>
              <button type="button" onClick={() => { const n = Number(formulaNumberInputValue); if (!Number.isNaN(n)) { setNewMeasurableFormulaTokens((t) => [...t, { type: 'number', value: n }]); setFormulaNumberInputValue(''); setFormulaNumberInputOpen(false); } }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium">Add</button>
            </div>
          </div>
        </>
      )}

      {reassignOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setReassignOpen(false)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-card border border-border rounded-lg shadow-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Reassign Flight Metric {reassignIds.length}</h3>
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
