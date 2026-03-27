'use client';

import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { Select, Input } from 'antd';
import {
  ChevronDown,
  RotateCcw,
  RotateCw,
  Plus,
  MoreHorizontal,
  Minus,
  Maximize2,
  ChevronUp,
  Settings,
  Download,
  FileText,
  X,
  BarChart2,
  ArrowLeft,
  ArrowRight,
  Info,
  Loader2,
  Trash2,
  Pencil,
  ArrowRightToLine,
  Copy,
  CheckSquare,
  AlertTriangle,
  MinusCircle,
} from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import {
  scorecardGroupsService,
  scorecardMainGroupService,
  scorecardMeasurablesService,
  type ScorecardGroup as ApiScorecardGroup,
} from '@/lib/api/meetings.service';
import { useMeetingSocket } from '@/contexts/MeetingSocketContext';
import { teamsService, type TeamMember } from '@/lib/api/teams.service';
import { toast } from 'sonner';

export type TimeframeTab = 'weekly' | 'monthly' | 'quarterly' | 'annual';
type ViewBy = 'week' | 'month' | 'quarter' | 'year';
type DateRangeKey = 'last13weeks' | 'last13months' | 'custom' | 'qtd' | 'ytd' | 'current_quarter' | 'current_year';

const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: 'custom', label: 'Custom' },
  { value: 'last13weeks', label: 'Last 13 Weeks' },
  { value: 'last13months', label: 'Last 13 Months' },
  { value: 'qtd', label: 'QTD' },
  { value: 'ytd', label: 'YTD' },
  { value: 'current_quarter', label: 'Current Quarter' },
  { value: 'current_year', label: 'Current Year' },
];

function getWeekRangeLabels(count: number): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - 7 * i);
    const sun = new Date(d);
    sun.setDate(d.getDate() - d.getDay());
    const sat = new Date(sun);
    sat.setDate(sun.getDate() + 6);
    const m1 = sun.toLocaleDateString('en-US', { month: 'short' });
    const d1 = sun.getDate();
    const m2 = sat.toLocaleDateString('en-US', { month: 'short' });
    const d2 = sat.getDate();
    labels.push(`${m1} ${d1} - ${m2} ${d2}`);
  }
  return labels.reverse();
}

function getMonthLabels(count: number): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleDateString('en-US', { month: 'short' }));
  }
  return labels.reverse();
}

export interface MeasurableRow {
  id: string;
  title: string;
  goal: string;
  average: string;
  total: string;
  trend: 'up' | 'down' | 'neutral';
  periodValues: Record<string, string>;
  /** When set, measurable appears in that group's card; when undefined/null, appears in main card */
  groupId?: string | null;
  /** When false, Goal/Average/Total cell is hidden (no content). When true or undefined, show value or "—" if empty. */
  showGoal?: boolean;
  showAverage?: boolean;
  showTotal?: boolean;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerInitials?: string;
}

const MOCK_MEASURABLES: MeasurableRow[] = [
  { id: '1', title: 'measurable', goal: '>= 0', average: '0', total: '0', trend: 'down', periodValues: {}, ownerId: '', ownerName: '', ownerEmail: '', ownerInitials: '' },
];

function getInitials(name?: string | null, email?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

function extractOwnerMeta(periodValues: Record<string, string> | undefined) {
  const pv = periodValues ?? {};
  return {
    ownerId: pv.__ownerId ?? '',
    ownerName: pv.__ownerName ?? '',
    ownerEmail: pv.__ownerEmail ?? '',
    ownerInitials: pv.__ownerInitials ?? '',
  };
}

function stripOwnerMeta(periodValues: Record<string, string> | undefined) {
  const pv = periodValues ?? {};
  return Object.fromEntries(
    Object.entries(pv).filter(([k]) => !k.startsWith('__owner'))
  ) as Record<string, string>;
}

function withOwnerMeta(periodValues: Record<string, string>, owner: {
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerInitials?: string;
}) {
  const next: Record<string, string> = {
    ...periodValues,
  };
  if (owner.ownerId) next.__ownerId = owner.ownerId;
  if (owner.ownerName) next.__ownerName = owner.ownerName;
  if (owner.ownerEmail) next.__ownerEmail = owner.ownerEmail;
  if (owner.ownerInitials) next.__ownerInitials = owner.ownerInitials;
  return next;
}

function ScorecardTableCard({
  title,
  data,
  periodColumns,
  displayDirection,
  newMeasurableOpen,
  onNewMeasurableToggle,
  onCreateNew,
  onAddExisting,
  className = '',
  groupId,
  group,
  onEditGroup,
  onDeleteGroup,
  isExpanded,
  onExpand,
  isCollapsed,
  onCollapse,
  otherGroups,
  onMoveToGroup,
  onDuplicate,
  onCreateTodo,
  onCreateIssue,
  onRemoveFromGroup,
  onDelete,
  columnVisibility,
  onPeriodValueChange,
  onEditMeasurable,
}: {
  title: string;
  data: MeasurableRow[];
  periodColumns: string[];
  displayDirection: 'ltr' | 'rtl';
  newMeasurableOpen: boolean;
  onNewMeasurableToggle: () => void;
  onCreateNew: (groupId: string) => void;
  onAddExisting: () => void;
  className?: string;
  groupId?: string;
  group?: { id: string; name: string; description?: string };
  onEditGroup?: (g: { id: string; name: string; description?: string }) => void;
  onDeleteGroup?: (groupId: string) => void;
  isExpanded?: boolean;
  onExpand?: () => void;
  isCollapsed?: boolean;
  onCollapse?: () => void;
  otherGroups?: { id: string; name: string }[];
  onMoveToGroup?: (measurableIds: string[], targetGroupId: string) => void;
  onDuplicate?: (measurableIds: string[]) => void;
  onCreateTodo?: (measurables: MeasurableRow[]) => void;
  onCreateIssue?: (measurables: MeasurableRow[]) => void;
  onRemoveFromGroup?: (measurableIds: string[]) => void;
  onDelete?: (measurableIds: string[]) => void;
  columnVisibility?: { showStatusIndicators: boolean; showOwnerColumn: boolean; showGoalColumn: boolean; showAverageColumn: boolean; showTotalColumn: boolean };
  /** When set, period cells are editable number inputs; value changes update total/average for that row */
  onPeriodValueChange?: (measurableId: string, periodKey: string, value: string) => void;
  /** When set, double-click on measurable title opens edit panel with this row prefilled */
  onEditMeasurable?: (row: MeasurableRow) => void;
}) {
  const showAddExistingMeasurableOption = false;
  const effectiveGroupId = groupId ?? 'main';
  const visibility = columnVisibility ?? {
    showStatusIndicators: true,
    showOwnerColumn: false,
    showGoalColumn: true,
    showAverageColumn: true,
    showTotalColumn: true,
  };
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectActionOpen, setSelectActionOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTargetGroupId, setMoveTargetGroupId] = useState<string | null>(null);
  const selectActionBtnRef = useRef<HTMLButtonElement>(null);
  const [selectActionPosition, setSelectActionPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!selectActionOpen || !selectActionBtnRef.current) {
      setSelectActionPosition(null);
      return;
    }
    const rect = selectActionBtnRef.current.getBoundingClientRect();
    setSelectActionPosition({ top: rect.bottom + 4, left: rect.right - 240 });
  }, [selectActionOpen]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (data.length === 0) return;
    const allSelected = data.every((r) => selectedIds.has(r.id));
    setSelectedIds(allSelected ? new Set() : new Set(data.map((r) => r.id)));
  };
  const selectedList = Array.from(selectedIds);
  const selectedMeasurables = data.filter((m) => selectedIds.has(m.id));
  const firstSelectedMeasurable = selectedMeasurables[0];

  const columns = useMemo<ColumnDef<MeasurableRow, unknown>[]>(() => {
    const cols: ColumnDef<MeasurableRow, unknown>[] = [
      { id: 'select', header: () => <input type="checkbox" className="rounded border-border" checked={data.length > 0 && data.every((r) => selectedIds.has(r.id))} onChange={toggleSelectAll} />, cell: ({ row }) => <input type="checkbox" className="rounded border-border" checked={selectedIds.has(row.original.id)} onChange={() => toggleSelect(row.original.id)} />, size: 40 },
    ];
    if (visibility.showStatusIndicators) {
      cols.push({ id: 'trend', header: () => <span className="font-medium text-foreground">View Trend</span>, cell: ({ row }) => (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600">
          {row.original.trend === 'down' ? <Minus className="w-3 h-3" /> : '−'}
        </span>
      ), size: 100 });
    }
    cols.push(
      { id: 'title', header: () => <span className="font-medium text-foreground">Metric Name</span>, cell: ({ row }) => (
        <div
          className={`flex items-center gap-2 min-w-0 ${onEditMeasurable ? 'cursor-pointer select-none rounded px-1 -mx-1 hover:bg-muted/60' : ''}`}
          onDoubleClick={onEditMeasurable ? () => onEditMeasurable(row.original) : undefined}
          title={onEditMeasurable ? 'Double-click to edit' : undefined}
        >
          <span
            className={`flex-1 min-w-0 ${isExpanded ? 'whitespace-normal break-words' : 'truncate'}`}
            title={!isExpanded ? row.original.title : undefined}
          >
            {row.original.title}
          </span>
        </div>
      ), size: 180 }
    );
    if (visibility.showOwnerColumn) {
      cols.push({
        id: 'owner',
        header: () => <span className="font-medium text-foreground">Owner</span>,
        cell: ({ row }) => {
          const r = row.original;
          const initials = r.ownerInitials || getInitials(r.ownerName, r.ownerEmail);
          const label = r.ownerName || r.ownerEmail || 'No owner';
          const tooltip = r.ownerName || r.ownerEmail ? `${r.ownerName ?? 'No name'}\n${r.ownerEmail ?? ''}`.trim() : 'No owner';
          return (
            <div className="flex items-center">
              <button
                type="button"
                className="w-7 h-7 rounded-full bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-[11px] font-semibold text-primary cursor-default"
                title={tooltip}
                aria-label={`Owner: ${label}`}
              >
                {initials || '?'}
              </button>
            </div>
          );
        },
        size: 82,
      });
    }
    if (visibility.showGoalColumn) cols.push({ id: 'goal', header: () => <span className="font-medium text-foreground">Target</span>, cell: ({ row }) => { const r = row.original; if (r.showGoal === false) return ''; const v = r.goal; return (v != null && v !== '' ? v : '—'); }, size: 100 });
    if (visibility.showAverageColumn) cols.push({ id: 'average', header: () => <span className="font-medium text-foreground">Average</span>, cell: ({ row }) => { const r = row.original; if (r.showAverage === false) return ''; const v = r.average; return (v != null && v !== '' ? v : '—'); }, size: 90 });
    if (visibility.showTotalColumn) cols.push({ id: 'total', header: () => <span className="font-medium text-foreground">Total</span>, cell: ({ row }) => { const r = row.original; if (r.showTotal === false) return ''; const v = r.total; return (v != null && v !== '' ? v : '—'); }, size: 80 });
    const periodCols = (displayDirection === 'rtl' ? [...periodColumns].reverse() : periodColumns).map((label, i) => ({
      id: `period-${i}`,
      header: () => <span className="font-medium text-foreground text-xs whitespace-nowrap">{label}</span>,
      cell: ({ row }: { row: { original: MeasurableRow } }) =>
        onPeriodValueChange ? (
          <input
            type="text"
            inputMode="decimal"
            value={row.original.periodValues[label] ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '' || /^-?\d*\.?\d*$/.test(v)) onPeriodValueChange(row.original.id, label, v);
            }}
            className="w-full min-w-0 px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="—"
          />
        ) : (
          (row.original.periodValues[label] ?? '—')
        ),
      size: 100,
    }));
    cols.push(...periodCols);
    return cols;
  }, [periodColumns, selectedIds, data, displayDirection, visibility, onPeriodValueChange, onEditMeasurable, isExpanded]);
  const FIXED_COLUMN_IDS = useMemo(() => {
    const ids = ['select'];
    if (visibility.showStatusIndicators) ids.push('trend');
    ids.push('title');
    if (visibility.showOwnerColumn) ids.push('owner');
    if (visibility.showGoalColumn) ids.push('goal');
    if (visibility.showAverageColumn) ids.push('average');
    if (visibility.showTotalColumn) ids.push('total');
    return ids;
  }, [visibility]);
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    defaultColumn: { minSize: 40, maxSize: 500 },
  });
  const fixedHeaders = table.getHeaderGroups()[0]?.headers.filter((h) => FIXED_COLUMN_IDS.includes(h.column.id)) ?? [];
  const periodHeaders = table.getHeaderGroups()[0]?.headers.filter((h) => !FIXED_COLUMN_IDS.includes(h.column.id)) ?? [];
  const fixedWidth = fixedHeaders.reduce((sum, h) => sum + (h.column.getSize()), 0);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const newMeasurableBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!newMeasurableOpen || !newMeasurableBtnRef.current) {
      setDropdownPosition(null);
      return;
    }
    const rect = newMeasurableBtnRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 4,
      left: rect.right - 200,
    });
  }, [newMeasurableOpen]);

  const showGroupMenu = Boolean(groupId && group);
  return (
    <>
    <div className={`border border-border rounded-lg overflow-visible bg-card flex flex-col ${isCollapsed ? 'min-h-0 shrink-0' : 'min-h-[72px]'} ${className}`}>
      <div className={`flex items-center justify-between gap-2 p-4 shrink-0 ${isCollapsed ? 'bg-muted/20' : 'border-b border-border bg-muted/20'}`}>
        <h2 className="text-lg font-semibold text-foreground truncate">{title}{isCollapsed && <span className="text-muted-foreground font-normal ml-2">({data.length} metrics)</span>}</h2>
        <div className="flex items-center gap-1 shrink-0">
          {selectedList.length > 0 && (
            <div className="relative">
              <button
                ref={selectActionBtnRef}
                type="button"
                onClick={() => setSelectActionOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium cursor-pointer"
              >
                Select action <ChevronDown className="w-4 h-4" />
              </button>
              {selectActionOpen && selectActionPosition != null && typeof document !== 'undefined' &&
                createPortal(
                  <>
                    <div
                      className="fixed z-[100] py-2 bg-card border border-border rounded-md shadow-lg min-w-[240px]"
                      style={{ top: selectActionPosition.top, left: selectActionPosition.left }}
                    >
                      {/* Move to another group (first) + Duplicate */}
                      <div className="px-2 py-1 space-y-0.5">
                        {otherGroups && otherGroups.length > 0 && onMoveToGroup && (
                          <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer rounded-md" onClick={() => { setSelectActionOpen(false); setMoveModalOpen(true); }}>
                            <ArrowRightToLine className="w-4 h-4 shrink-0 text-muted-foreground" /> Move to another group
                          </button>
                        )}
                        {onDuplicate && (
                          <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer rounded-md" onClick={() => { setSelectActionOpen(false); onDuplicate(selectedList); setSelectedIds(new Set()); }}>
                            <Copy className="w-4 h-4 shrink-0 text-muted-foreground" /> Duplicate
                          </button>
                        )}
                      </div>
                      <div className="border-t border-border my-2" role="separator" />
                      {/* Create Clearance / Create Turbulence (prefills link to flight metric) */}
                      <div className="px-2 py-1 space-y-0.5">
                        {onCreateTodo && selectedMeasurables.length > 0 && (
                          <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer rounded-md" onClick={() => { setSelectActionOpen(false); onCreateTodo(selectedMeasurables); setSelectedIds(new Set()); }}>
                            <CheckSquare className="w-4 h-4 shrink-0 text-muted-foreground" /> Create Clearance
                          </button>
                        )}
                        {onCreateIssue && selectedMeasurables.length > 0 && (
                          <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer rounded-md" onClick={() => { setSelectActionOpen(false); onCreateIssue(selectedMeasurables); setSelectedIds(new Set()); }}>
                            <AlertTriangle className="w-4 h-4 shrink-0 text-muted-foreground" /> Create Turbulence
                          </button>
                        )}
                      </div>
                      <div className="border-t border-border my-2" role="separator" />
                      {/* Remove from group: only when in a custom group (not Main) */}
                      <div className="px-2 py-1 space-y-0.5">
                        {onRemoveFromGroup && effectiveGroupId !== 'main' && (
                          <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer rounded-md text-foreground" onClick={() => { setSelectActionOpen(false); onRemoveFromGroup(selectedList); setSelectedIds(new Set()); }}>
                            <MinusCircle className="w-4 h-4 shrink-0 text-muted-foreground" /> Remove from group
                          </button>
                        )}
                        {onDelete && (
                          <button type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer rounded-md text-destructive" onClick={() => { setSelectActionOpen(false); onDelete(selectedList); setSelectedIds(new Set()); }}>
                            <Trash2 className="w-4 h-4 shrink-0" /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="fixed inset-0 z-[99]" onClick={() => setSelectActionOpen(false)} aria-hidden />
                  </>,
                  document.body
                )}
            </div>
          )}
          <div className="relative">
            <button
              ref={newMeasurableBtnRef}
              type="button"
              onClick={onNewMeasurableToggle}
              className="flex items-center gap-2 px-3 py-1.5 border border-border text-primary rounded-md hover:bg-accent bg-background text-sm font-medium cursor-pointer transition-colors"
            >
              New Flight Metric <ChevronDown className="w-4 h-4" />
            </button>
            {newMeasurableOpen && dropdownPosition != null && typeof document !== 'undefined' &&
              createPortal(
                <>
                  <div
                    className="fixed z-[100] py-1 bg-card border border-border rounded-md shadow-lg min-w-[200px]"
                    style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                  >
                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer" onClick={() => { onNewMeasurableToggle(); onCreateNew(effectiveGroupId); }}><Plus className="w-4 h-4" /> New Flight Metric</button>
                    {showAddExistingMeasurableOption && (
                      <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer" onClick={() => { onNewMeasurableToggle(); onAddExisting(); }}><Plus className="w-4 h-4" /> Add existing Flight Metric</button>
                    )}
                  </div>
                  <div className="fixed inset-0 z-[99]" onClick={onNewMeasurableToggle} aria-hidden />
                </>,
                document.body
              )}
          </div>
          {showGroupMenu && (
            <div className="relative">
              <button type="button" onClick={() => setGroupMenuOpen((o) => !o)} className="p-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title={groupId ? 'Group options' : 'Options'}>
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {groupMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setGroupMenuOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full mt-1 py-1 bg-card border border-border rounded-md shadow-lg z-20 min-w-[180px]">
                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer" onClick={() => { setGroupMenuOpen(false); onEditGroup?.(group!); }}>
                      <Pencil className="w-4 h-4 shrink-0" /> Edit group details
                    </button>
                    {onDeleteGroup && (
                      <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive" onClick={() => { setGroupMenuOpen(false); onDeleteGroup(group!.id); }}>
                        <Trash2 className="w-4 h-4 shrink-0" /> Delete group
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {onExpand && (
            <button type="button" onClick={onExpand} className={`p-2 rounded transition-colors cursor-pointer ${isExpanded ? 'bg-primary/20 text-primary' : 'hover:bg-accent text-muted-foreground hover:text-foreground'}`} title={isExpanded ? 'Collapse view' : 'Expand to full area'}>
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
          {onCollapse && (
            <button type="button" onClick={onCollapse} className="p-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title={isCollapsed ? 'Expand grid' : 'Collapse to one line'}>
              <ChevronUp className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>
      {!isCollapsed && (
      <div className="flex flex-1 min-h-0 overflow-hidden" dir={displayDirection}>
        {/* Left section: fixed columns (through Total), no scroll */}
        <div className="shrink-0 overflow-hidden bg-card" style={{ width: fixedWidth }}>
          <table className="w-full border-collapse text-sm table-fixed">
            <thead>
              <tr>
                {fixedHeaders.map((h) => (
                  <th key={h.id} className="text-left font-medium text-foreground border-b border-border px-3 py-2 whitespace-nowrap bg-muted/30 relative group" style={{ width: h.column.getSize(), minWidth: h.column.getSize() }}>
                    {typeof h.column.columnDef.header === 'function' ? flexRender(h.column.columnDef.header, h.getContext()) : h.column.columnDef.header}
                    <div
                      onMouseDown={h.getResizeHandler()}
                      onTouchStart={h.getResizeHandler()}
                      className="absolute right-0 top-0 h-full w-0.5 cursor-col-resize touch-none select-none bg-border border-r border-border hover:bg-primary/30 hover:border-primary/50 active:bg-primary active:border-primary"
                      style={{ userSelect: 'none' }}
                      aria-hidden
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr><td colSpan={fixedHeaders.length} className="px-3 py-8 text-center text-muted-foreground border-b border-border">No data to show</td></tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-border hover:bg-muted/20">
                    {row.getVisibleCells().filter((cell) => FIXED_COLUMN_IDS.includes(cell.column.id)).map((cell) => (
                      <td key={cell.id} className="px-3 py-2 text-foreground whitespace-nowrap" style={{ width: cell.column.getSize(), minWidth: cell.column.getSize() }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Right section: date columns, scrollable, blue divider */}
        <div className="flex-1 min-w-0 flex flex-col border-l-2 border-primary">
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
            <table className="border-collapse text-sm w-max min-w-full">
              <thead>
                <tr>
                  {periodHeaders.map((h) => (
                    <th key={h.id} className="text-left font-medium text-foreground border-b border-border px-3 py-2 whitespace-nowrap bg-muted/30 text-xs relative group" style={{ width: h.column.getSize(), minWidth: h.column.getSize() }}>
                      {typeof h.column.columnDef.header === 'function' ? flexRender(h.column.columnDef.header, h.getContext()) : h.column.columnDef.header}
                      <div
                        onMouseDown={h.getResizeHandler()}
                        onTouchStart={h.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-0.5 cursor-col-resize touch-none select-none bg-border border-r border-border hover:bg-primary/30 hover:border-primary/50 active:bg-primary active:border-primary"
                        style={{ userSelect: 'none' }}
                        aria-hidden
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? null : (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-border hover:bg-muted/20">
                      {row.getVisibleCells().filter((cell) => !FIXED_COLUMN_IDS.includes(cell.column.id)).map((cell) => (
                        <td key={cell.id} className="px-3 py-2 text-foreground whitespace-nowrap" style={{ width: cell.column.getSize(), minWidth: cell.column.getSize() }}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}
    </div>
      {/* Move to group modal */}
      {moveModalOpen && otherGroups && otherGroups.length > 0 && onMoveToGroup && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => { setMoveModalOpen(false); setMoveTargetGroupId(null); }} aria-hidden />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                {selectedList.length === 1 ? 'Move Metric 1' : `Move ${selectedList.length} metrics`}
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">New Instrument Group</label>
                <Select
                  placeholder="Select group..."
                  value={moveTargetGroupId}
                  onChange={(v) => setMoveTargetGroupId(v)}
                  options={otherGroups.map((g) => ({ label: g.name, value: g.id }))}
                  className="w-full"
                  allowClear
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setMoveModalOpen(false); setMoveTargetGroupId(null); }} className="px-4 py-2 border border-border rounded-md hover:bg-muted text-sm font-medium">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!moveTargetGroupId}
                  onClick={() => {
                    if (moveTargetGroupId) {
                      onMoveToGroup(selectedList, moveTargetGroupId);
                      setMoveModalOpen(false);
                      setMoveTargetGroupId(null);
                      setSelectedIds(new Set());
                    }
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Move
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

type CreatePopupType = 'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message';

interface InstrumentsSegmentViewProps {
  teamName?: string;
  teamId?: string | null;
  embedded?: boolean;
  meetingId?: string;
  organizationId?: string;
  currentUserId?: string | null;
  isFacilitator?: boolean;
  /** Scribe or facilitator: can change scorecard filters and create groups/measurables */
  canRecord?: boolean;
  /** When true, meeting is scheduled in the future (not started); scorecard shows grey bg and disabled controls */
  isMeetingInFuture?: boolean;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; linkedEntity?: { type: 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message' | 'measurable'; id: string; title: string } }) => void;
  onOpenCreateIssue?: () => void;
  /** Meeting attendees for Person/Owner dropdowns (scorecard measurables) */
  meetingAttendances?: Array<{ id: string; user: { id: string; name?: string | null; email: string } }>;
}

export function InstrumentsSegmentView({
  teamName = 'No team found',
  teamId,
  embedded = false,
  meetingId,
  organizationId,
  currentUserId,
  isFacilitator = true,
  canRecord,
  isMeetingInFuture = false,
  onOpenCreate,
  onOpenCreateIssue,
  meetingAttendances = [],
}: InstrumentsSegmentViewProps) {
  const canUseFilters = (canRecord ?? isFacilitator) && !isMeetingInFuture;
  const [timeframe, setTimeframe] = useState<TimeframeTab>('weekly');
  const [viewBy, setViewBy] = useState<ViewBy>('week');
  const [dateRange, setDateRange] = useState<DateRangeKey>('last13weeks');
  const [searchKpis, setSearchKpis] = useState('');
  const [newMeasurableOpenGroupId, setNewMeasurableOpenGroupId] = useState<string | null>(null);
  const [displayDirection, setDisplayDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createGroupName, setCreateGroupName] = useState('');
  const [createGroupDescription, setCreateGroupDescription] = useState('');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [moreMenuPosition, setMoreMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [addExistingModalOpen, setAddExistingModalOpen] = useState(false);
  const [createMeasurableOpen, setCreateMeasurableOpen] = useState(false);
  const [createMeasurableForGroupId, setCreateMeasurableForGroupId] = useState<string | null>(null);
  const [editingMeasurable, setEditingMeasurable] = useState<MeasurableRow | null>(null);
  const [deleteConfirmGroupId, setDeleteConfirmGroupId] = useState<string | null>(null);
  const [deleteGroupLoading, setDeleteGroupLoading] = useState(false);
  const moreMenuBtnRef = useRef<HTMLButtonElement>(null);

  const handleDeleteGroup = async (groupId: string) => {
    if (groupId === 'main') {
      if (!organizationId || !meetingId) {
        setDeleteConfirmGroupId(null);
        return;
      }
      setDeleteGroupLoading(true);
      try {
        await scorecardMainGroupService.update(organizationId, meetingId, { hidden: true });
        setMainGroupHidden(true);
        setEditGroupId(null);
        setEditGroupInitial(null);
        setCreateGroupOpen(false);
        setCreateGroupName('');
        setCreateGroupDescription('');
        setDeleteConfirmGroupId(null);
      } finally {
        setDeleteGroupLoading(false);
      }
      return;
    }
    if (!organizationId || !meetingId) return;
    setDeleteGroupLoading(true);
    try {
      await scorecardGroupsService.delete(organizationId, meetingId, groupId);
      setGroupsByTimeframe((prev) => {
        const next = { ...prev };
        (['weekly', 'monthly', 'quarterly', 'annual'] as const).forEach((tab) => {
          if (next[tab]) next[tab] = next[tab].filter((g) => g.id !== groupId);
        });
        return next;
      });
      if (editGroupId === groupId) {
        setEditGroupId(null);
        setEditGroupInitial(null);
        setCreateGroupOpen(false);
        setCreateGroupName('');
        setCreateGroupDescription('');
      }
      setDeleteConfirmGroupId(null);
    } finally {
      setDeleteGroupLoading(false);
    }
  };

  const SCORECARD_SETTINGS_KEY = 'scorecard-settings';
  const defaultScorecardSettings = {
    useCompanyDefault: true,
    showStatusIndicators: false,
    showOwnerColumn: false,
    showGoalColumn: true,
    showAverageColumn: true,
    showTotalColumn: true,
    showCurrentPeriod: false,
  };
  const [scorecardSettings, setScorecardSettings] = useState<Record<TimeframeTab, typeof defaultScorecardSettings>>(() => {
    if (typeof window === 'undefined') return { weekly: defaultScorecardSettings, monthly: defaultScorecardSettings, quarterly: defaultScorecardSettings, annual: defaultScorecardSettings };
    try {
      const raw = window.localStorage.getItem(SCORECARD_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<TimeframeTab, typeof defaultScorecardSettings>;
        return { weekly: { ...defaultScorecardSettings, ...parsed.weekly }, monthly: { ...defaultScorecardSettings, ...parsed.monthly }, quarterly: { ...defaultScorecardSettings, ...parsed.quarterly }, annual: { ...defaultScorecardSettings, ...parsed.annual } };
      }
    } catch {}
    return { weekly: defaultScorecardSettings, monthly: defaultScorecardSettings, quarterly: defaultScorecardSettings, annual: defaultScorecardSettings };
  });
  const saveScorecardSettings = (tab: TimeframeTab, s: typeof defaultScorecardSettings) => {
    setScorecardSettings((prev) => {
      const next = { ...prev, [tab]: s };
      if (typeof window !== 'undefined') window.localStorage.setItem(SCORECARD_SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const [groupsByTimeframe, setGroupsByTimeframe] = useState<Record<TimeframeTab, Array<{ id: string; name: string; description?: string }>>>({
    weekly: [],
    monthly: [],
    quarterly: [],
    annual: [],
  });
  const [measurables, setMeasurables] = useState<MeasurableRow[]>(MOCK_MEASURABLES);
  const [addExistingSearch, setAddExistingSearch] = useState('');
  const [addExistingPersonFilter, setAddExistingPersonFilter] = useState<string>('All');
  const personOptions = useMemo(() => {
    const list = Array.isArray(meetingAttendances) ? meetingAttendances : [];
    return [
      { label: 'All', value: 'All' },
      { label: 'No owner', value: 'Unassigned' },
      ...list.map((a) => ({ label: a.user?.name || a.user?.email || a.user?.id || 'Unknown', value: a.user?.id ?? a.id })),
    ];
  }, [meetingAttendances]);
  const [savedMeasurables, setSavedMeasurables] = useState<MeasurableRow[]>([]);
  const [createMeasurableTitle, setCreateMeasurableTitle] = useState('');
  const [createMeasurableDescription, setCreateMeasurableDescription] = useState('');
  const [createMeasurableShowTotal, setCreateMeasurableShowTotal] = useState(true);
  const [createMeasurableShowAverage, setCreateMeasurableShowAverage] = useState(true);
  const [createMeasurableShowGoal, setCreateMeasurableShowGoal] = useState(true);
  const [createMeasurableCloseConfirmOpen, setCreateMeasurableCloseConfirmOpen] = useState(false);
  const [createMeasurableUnit, setCreateMeasurableUnit] = useState('Number');
  const [createMeasurableOrientation, setCreateMeasurableOrientation] = useState('Greater than or equal to goal');
  const [createMeasurableGoalValue, setCreateMeasurableGoalValue] = useState(0);
  const [createMeasurableRollup, setCreateMeasurableRollup] = useState('Total (default)');
  const [createMeasurableFormulaBuilder, setCreateMeasurableFormulaBuilder] = useState(false);
  const [createMeasurableOwnerId, setCreateMeasurableOwnerId] = useState<string>('');
  const [savingMeasurable, setSavingMeasurable] = useState(false);
  const [measurableMenuOpen, setMeasurableMenuOpen] = useState(false);
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [organizationRole, setOrganizationRole] = useState<string | null>(null);
  const [confirmOwnerChangeOpen, setConfirmOwnerChangeOpen] = useState(false);
  const [pendingOwnerId, setPendingOwnerId] = useState<string | null>(null);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editGroupInitial, setEditGroupInitial] = useState<{ name: string; description: string } | null>(null);
  const [createGroupSaving, setCreateGroupSaving] = useState(false);
  const [mainGroupName, setMainGroupName] = useState('');
  const [mainGroupDescription, setMainGroupDescription] = useState('');
  const [mainGroupHidden, setMainGroupHidden] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  const [scorecardHistory, setScorecardHistory] = useState<MeasurableRow[][]>([]);
  const [scorecardRedo, setScorecardRedo] = useState<MeasurableRow[][]>([]);
  const measurablesRef = useRef<MeasurableRow[]>(measurables);
  measurablesRef.current = measurables;
  const measurableUpsertGuardRef = useRef<{ payloadKey: string; ts: number } | null>(null);

  const periodColumns = useMemo(() => {
    if (timeframe === 'weekly') return getWeekRangeLabels(13);
    if (timeframe === 'monthly') return getMonthLabels(13);
    return getWeekRangeLabels(4);
  }, [timeframe]);

  useEffect(() => {
    if (addExistingModalOpen) {
      setSavedMeasurables([...MOCK_MEASURABLES]);
    }
  }, [addExistingModalOpen]);

  useEffect(() => {
    setExpandedGroupId(null);
  }, [timeframe]);

  useEffect(() => {
    if (!editingMeasurable) return;
    setCreateMeasurableTitle(editingMeasurable.title);
    setCreateMeasurableDescription('');
    const g = editingMeasurable.goal?.trim() ?? '';
    if (/^>=?\s*-?\d*\.?\d+$/.test(g)) {
      setCreateMeasurableOrientation('Greater than or equal to goal');
      setCreateMeasurableGoalValue(parseFloat(g.replace(/^>=?\s*/, '')) || 0);
    } else if (/^<=?\s*-?\d*\.?\d+$/.test(g)) {
      setCreateMeasurableOrientation('Less than or equal to goal');
      setCreateMeasurableGoalValue(parseFloat(g.replace(/^<=?\s*/, '')) || 0);
    } else {
      const num = parseFloat(g.replace(/^=\s*/, ''));
      setCreateMeasurableOrientation('Equal to goal');
      setCreateMeasurableGoalValue(Number.isNaN(num) ? 0 : num);
    }
    setCreateMeasurableShowTotal(editingMeasurable.showTotal !== false);
    setCreateMeasurableShowAverage(editingMeasurable.showAverage !== false);
    setCreateMeasurableShowGoal(editingMeasurable.showGoal !== false);
    setCreateMeasurableOwnerId(editingMeasurable.ownerId ?? '');
  }, [editingMeasurable]);

  useEffect(() => {
    if (!createMeasurableOpen || editingMeasurable) return;
    setCreateMeasurableOwnerId(currentUserId ?? '');
  }, [createMeasurableOpen, editingMeasurable, currentUserId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncRole = () => setOrganizationRole(localStorage.getItem('organizationRole'));
    syncRole();
    const onRoleChange = (e: Event) => {
      const evt = e as CustomEvent<{ role?: string }>;
      if (evt.detail?.role) setOrganizationRole(evt.detail.role);
      else syncRole();
    };
    window.addEventListener('organizationRoleChanged', onRoleChange as EventListener);
    return () => window.removeEventListener('organizationRoleChanged', onRoleChange as EventListener);
  }, []);

  const isAdmin = organizationRole === 'ADMIN';

  const fetchTeamMembers = useCallback(() => {
    if (!organizationId || !teamId) {
      setTeamMembers([]);
      return Promise.resolve();
    }
    return Promise.allSettled([
      teamsService.getOne(organizationId, teamId),
      teamsService.list(organizationId),
    ])
      .then(([singleRes, listRes]) => {
        const fromSingle = singleRes.status === 'fulfilled' ? singleRes.value.members ?? [] : [];
        const fromListTeam =
          listRes.status === 'fulfilled'
            ? (listRes.value.find((t) => t.id === teamId)?.members ?? [])
            : [];
        const mergedByUserId = new Map<string, TeamMember>();
        [...fromSingle, ...fromListTeam].forEach((m) => {
          const key = m.user?.id ?? m.userId;
          if (!mergedByUserId.has(key)) mergedByUserId.set(key, m);
        });
        setTeamMembers(Array.from(mergedByUserId.values()));
      })
      .catch(() => setTeamMembers([]));
  }, [organizationId, teamId]);

  useEffect(() => {
    if (ownerPickerOpen) fetchTeamMembers();
  }, [ownerPickerOpen, fetchTeamMembers]);

  const selectedOwner = teamMembers.find((m) => (m.user?.id ?? m.userId) === createMeasurableOwnerId);
  const ownerInitials = selectedOwner
    ? getInitials(selectedOwner.user?.name, selectedOwner.user?.email)
    : (editingMeasurable?.ownerInitials || '?');
  const ownerName = selectedOwner?.user?.name || selectedOwner?.user?.email || 'No owner';
  const ownerCandidates = teamMembers.filter((m) => {
    const q = ownerSearch.trim().toLowerCase();
    if (!q) return true;
    const label = `${m.user?.name ?? ''} ${m.user?.email ?? ''}`.toLowerCase();
    return label.includes(q);
  });

  const handleOwnerSelect = (nextOwnerId: string) => {
    if (!isAdmin) {
      toast.error("You're not admin");
      return;
    }
    setPendingOwnerId(nextOwnerId);
    setConfirmOwnerChangeOpen(true);
  };

  const confirmOwnerChange = () => {
    const nextOwnerId = pendingOwnerId ?? '';
    setCreateMeasurableOwnerId(nextOwnerId);
    setOwnerPickerOpen(false);
    setOwnerSearch('');
    setConfirmOwnerChangeOpen(false);
    setPendingOwnerId(null);
  };

  const resolveOwnerMeta = (ownerId: string) => {
    const fromTeam = teamMembers.find((m) => (m.user?.id ?? m.userId) === ownerId);
    if (fromTeam) {
      return {
        ownerName: fromTeam.user?.name || '',
        ownerEmail: fromTeam.user?.email || '',
        ownerInitials: getInitials(fromTeam.user?.name, fromTeam.user?.email),
      };
    }
    const fromAttendance = meetingAttendances.find((a) => a.user?.id === ownerId)?.user;
    if (fromAttendance) {
      return {
        ownerName: fromAttendance.name || '',
        ownerEmail: fromAttendance.email || '',
        ownerInitials: getInitials(fromAttendance.name, fromAttendance.email),
      };
    }
    return {
      ownerName: '',
      ownerEmail: '',
      ownerInitials: '',
    };
  };

  const useApiGroups = Boolean(meetingId && organizationId);
  const [scorecardGroupsLoading, setScorecardGroupsLoading] = useState(false);
  const [scorecardMeasurablesLoading, setScorecardMeasurablesLoading] = useState(false);

  const fetchScorecardGroups = useCallback(async () => {
    if (!organizationId || !meetingId) return;
    setScorecardGroupsLoading(true);
    try {
      const list = await scorecardGroupsService.list(organizationId, meetingId);
      const byTab: Record<TimeframeTab, Array<{ id: string; name: string; description?: string }>> = {
        weekly: [],
        monthly: [],
        quarterly: [],
        annual: [],
      };
      list.forEach((g: ApiScorecardGroup) => {
        const tab = g.timeframe as TimeframeTab;
        if (byTab[tab]) byTab[tab].push({ id: g.id, name: g.name, description: g.description ?? undefined });
      });
      setGroupsByTimeframe(byTab);
    } catch {
      // keep local state on error
    } finally {
      setScorecardGroupsLoading(false);
    }
  }, [meetingId, organizationId]);

  useEffect(() => {
    if (!useApiGroups) return;
    fetchScorecardGroups();
  }, [useApiGroups, fetchScorecardGroups]);

  const fetchMainGroupSettings = useCallback(async () => {
    if (!organizationId || !meetingId) return;
    try {
      const settings = await scorecardMainGroupService.get(organizationId, meetingId);
      if (settings) {
        if (settings.hidden === true) setMainGroupHidden(true);
        if (settings.name != null) setMainGroupName(settings.name);
        if (settings.description != null) setMainGroupDescription(settings.description);
      }
    } catch {
      // keep defaults
    }
  }, [organizationId, meetingId]);

  const fetchScorecardMeasurables = useCallback(async () => {
    if (!organizationId || !meetingId) return;
    setScorecardMeasurablesLoading(true);
    try {
      const list = await scorecardMeasurablesService.list(organizationId, meetingId);
      if (list.length > 0) {
        setMeasurables(
          list.map((m) => {
            const pv = (m.periodValues ?? {}) as Record<string, string>;
            const owner = extractOwnerMeta(pv);
            return {
              id: m.id,
              title: m.title,
              goal: m.goal,
              average: m.average,
              total: m.total,
              trend: m.trend,
              periodValues: stripOwnerMeta(pv),
              groupId: m.groupId ?? undefined,
              ownerId: owner.ownerId,
              ownerName: owner.ownerName,
              ownerEmail: owner.ownerEmail,
              ownerInitials: owner.ownerInitials,
            };
          })
        );
      } else {
        const seed = MOCK_MEASURABLES.map((m) => ({ ...m, groupId: undefined as string | undefined }));
        setMeasurables(seed);
        await scorecardMeasurablesService.upsert(
          organizationId,
          meetingId,
          seed.map((m, i) => ({
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
      }
    } catch {
      // keep mock
    } finally {
      setScorecardMeasurablesLoading(false);
    }
  }, [organizationId, meetingId]);

  useEffect(() => {
    if (!organizationId || !meetingId) return;
    fetchMainGroupSettings();
  }, [organizationId, meetingId, fetchMainGroupSettings]);

  useEffect(() => {
    if (!organizationId || !meetingId) return;
    fetchScorecardMeasurables();
  }, [organizationId, meetingId, fetchScorecardMeasurables]);

  const wrap = embedded ? 'pt-0 pb-4' : 'pt-0 pb-6';
  const contentPad = embedded ? 'px-4' : 'px-6';

  const { socket } = useMeetingSocket();

  // Sync scorecard filters from facilitator to members
  useEffect(() => {
    if (!socket || !meetingId) return;
    const onScorecardFilter = (payload: { timeframe?: TimeframeTab; dateRange?: DateRangeKey; viewBy?: ViewBy; displayDirection?: 'ltr' | 'rtl' }) => {
      if (payload.timeframe !== undefined) setTimeframe(payload.timeframe);
      if (payload.dateRange !== undefined) setDateRange(payload.dateRange);
      if (payload.viewBy !== undefined) setViewBy(payload.viewBy);
      if (payload.displayDirection !== undefined) setDisplayDirection(payload.displayDirection);
    };
    socket.on('scorecard_filter', onScorecardFilter);
    return () => {
      socket.off('scorecard_filter', onScorecardFilter);
    };
  }, [socket, meetingId]);

  // Refetch scorecard groups when any participant creates/updates/deletes a group (backend emits scorecard_groups_changed)
  useEffect(() => {
    if (!socket || !meetingId || !useApiGroups) return;
    const onGroupsChanged = () => fetchScorecardGroups();
    socket.on('scorecard_groups_changed', onGroupsChanged);
    return () => {
      socket.off('scorecard_groups_changed', onGroupsChanged);
    };
  }, [socket, meetingId, useApiGroups, fetchScorecardGroups]);

  useEffect(() => {
    if (!socket || !meetingId || !organizationId) return;
    const onMainGroupChanged = () => fetchMainGroupSettings();
    socket.on('scorecard_main_group_changed', onMainGroupChanged);
    return () => {
      socket.off('scorecard_main_group_changed', onMainGroupChanged);
    };
  }, [socket, meetingId, organizationId, fetchMainGroupSettings]);

  useEffect(() => {
    if (!socket || !meetingId || !organizationId) return;
    const onMeasurablesChanged = () => fetchScorecardMeasurables();
    socket.on('scorecard_measurables_changed', onMeasurablesChanged);
    return () => {
      socket.off('scorecard_measurables_changed', onMeasurablesChanged);
    };
  }, [socket, meetingId, organizationId, fetchScorecardMeasurables]);

  const timeframeLabel = timeframe === 'weekly' ? 'Weekly' : timeframe === 'monthly' ? 'Monthly' : timeframe === 'quarterly' ? 'Quarterly' : 'Annual';
  const currentGroups = groupsByTimeframe[timeframe] || [];
  const mainGroup = { id: 'main', name: mainGroupName || `${timeframeLabel} Flight Metrics`, description: mainGroupDescription || undefined };
  /** Move targets for main card: only real API groups (no synthetic default). */
  const otherGroupsForMain = currentGroups;
  /** For a custom group card: only other real groups. Include main only if it exists (not hidden/deleted). */
  const otherGroupsForGroupId = useCallback(
    (groupId: string) => {
      const others = currentGroups.filter((g) => g.id !== groupId);
      if (!mainGroupHidden) return [{ id: 'main', name: mainGroup.name }, ...others];
      return others;
    },
    [mainGroup.name, mainGroupHidden, currentGroups]
  );
  const mainMeasurables = measurables.filter((m) => !m.groupId || m.groupId === 'main');
  /** Measurables visible on the current tab (main + any group in this timeframe). */
  const measurablesForCurrentTab = useMemo(
    () => measurables.filter((m) => !m.groupId || m.groupId === 'main' || currentGroups.some((g) => g.id === m.groupId)),
    [measurables, currentGroups]
  );

  const downloadCsv = useCallback((rows: MeasurableRow[], filename: string) => {
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
  }, []);

  const downloadPdf = useCallback((rows: MeasurableRow[], title: string) => {
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
  }, []);

  const scorecardColumnVisibility = useMemo(
    () => ({
      showStatusIndicators: scorecardSettings[timeframe].showStatusIndicators,
      showOwnerColumn: scorecardSettings[timeframe].showOwnerColumn,
      showGoalColumn: scorecardSettings[timeframe].showGoalColumn,
      showAverageColumn: scorecardSettings[timeframe].showAverageColumn,
      showTotalColumn: scorecardSettings[timeframe].showTotalColumn,
    }),
    [scorecardSettings, timeframe]
  );
  const pushScorecardHistory = useCallback(() => {
    setScorecardHistory((h) => [...h, measurablesRef.current]);
    setScorecardRedo([]);
  }, []);

  const handleUndoScorecard = useCallback(() => {
    if (!organizationId || !meetingId) return;
    setScorecardHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setScorecardRedo((r) => [...r, measurablesRef.current]);
      setMeasurables(prev);
      scorecardMeasurablesService
        .upsert(
          organizationId,
          meetingId,
          prev.map((m, i) => ({
            id: m.id,
            scorecardGroupId: m.groupId === undefined || m.groupId === 'main' ? null : m.groupId,
            title: m.title,
            goal: m.goal,
            average: m.average,
            total: m.total,
            trend: m.trend,
            periodValues: m.periodValues,
            order: i,
          }))
        )
        .catch((e) => console.error('Failed to persist undo', e));
      return h.slice(0, -1);
    });
  }, [organizationId, meetingId]);

  const handleRedoScorecard = useCallback(() => {
    if (!organizationId || !meetingId) return;
    setScorecardRedo((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1];
      setScorecardHistory((h) => [...h, measurablesRef.current]);
      setMeasurables(next);
      scorecardMeasurablesService
        .upsert(
          organizationId,
          meetingId,
          next.map((m, i) => ({
            id: m.id,
            scorecardGroupId: m.groupId === undefined || m.groupId === 'main' ? null : m.groupId,
            title: m.title,
            goal: m.goal,
            average: m.average,
            total: m.total,
            trend: m.trend,
            periodValues: m.periodValues,
            order: i,
          }))
        )
        .catch((e) => console.error('Failed to persist redo', e));
      return r.slice(0, -1);
    });
  }, [organizationId, meetingId]);

  const handleDuplicateMeasurables = useCallback(
    async (ids: string[]) => {
      pushScorecardHistory();
      setMeasurables((prev) => {
        const newRows = ids.map((id) => {
          const m = prev.find((x) => x.id === id);
          return m ? { ...m, id: `dup-${Date.now()}-${id}` } : null;
        }).filter((x): x is MeasurableRow => x != null);
        const next = [...prev, ...newRows];
        if (organizationId && meetingId) {
          scorecardMeasurablesService
            .upsert(
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
            )
            .catch((e) => console.error('Failed to save duplicated measurables', e));
        }
        return next;
      });
    },
    [organizationId, meetingId, pushScorecardHistory]
  );
  const handleRemoveFromGroup = useCallback(
    async (ids: string[]) => {
      if (!organizationId || !meetingId || ids.length === 0) return;
      pushScorecardHistory();
      try {
        await Promise.all(
          ids.map((id) =>
            scorecardMeasurablesService.updateGroup(organizationId, meetingId, id, null)
          )
        );
        setMeasurables((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, groupId: undefined } : m)));
      } catch (e) {
        console.error('Failed to remove from group', e);
      }
    },
    [organizationId, meetingId, pushScorecardHistory]
  );
  const handleCreateTodoFromMeasurable = useCallback((measurables: MeasurableRow[]) => {
    const n = measurables.length;
    const first = measurables[0];
    const title =
      n === 1 && first
        ? `Clearance: ${first.title}`
        : `Clearance: ${n} Flight Metric${n === 1 ? '' : 's'}`;
    const description = 'Flight metrics:\n' + measurables.map((m) => '• ' + m.title).join('\n');
    onOpenCreate?.('todo', { title, description, linkedEntity: first ? { type: 'measurable', id: first.id, title: first.title } : undefined });
  }, [onOpenCreate]);
  const handleCreateIssueFromMeasurable = useCallback((measurables: MeasurableRow[]) => {
    const n = measurables.length;
    const first = measurables[0];
    const title =
      n === 1 && first
        ? `Turbulence: ${first.title}`
        : `Turbulence: ${n} Flight Metric${n === 1 ? '' : 's'}`;
    const description = 'Flight metrics:\n' + measurables.map((m) => '• ' + m.title).join('\n');
    onOpenCreate?.('issue', { title, description, linkedEntity: first ? { type: 'measurable', id: first.id, title: first.title } : undefined });
  }, [onOpenCreate]);
  const handleMoveToGroup = useCallback(
    async (measurableIds: string[], targetGroupId: string) => {
      if (!organizationId || !meetingId) return;
      pushScorecardHistory();
      const apiGroupId = targetGroupId === 'main' ? null : targetGroupId;
      const displayGroupId = targetGroupId === 'main' ? undefined : targetGroupId;
      try {
        await Promise.all(
          measurableIds.map((id) =>
            scorecardMeasurablesService.updateGroup(organizationId, meetingId, id, apiGroupId)
          )
        );
        setMeasurables((prev) =>
          prev.map((m) => (measurableIds.includes(m.id) ? { ...m, groupId: displayGroupId } : m))
        );
      } catch (e) {
        console.error('Failed to move measurables', e);
      }
    },
    [organizationId, meetingId, pushScorecardHistory]
  );

  const handleDeleteMeasurables = useCallback(
    async (ids: string[]) => {
      if (!organizationId || !meetingId) return;
      pushScorecardHistory();
      try {
        await Promise.all(
          ids.map((id) => scorecardMeasurablesService.delete(organizationId, meetingId, id))
        );
        setMeasurables((prev) => prev.filter((m) => !ids.includes(m.id)));
      } catch (e) {
        console.error('Failed to delete measurables', e);
      }
    },
    [organizationId, meetingId, pushScorecardHistory]
  );

  const periodValueSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePeriodValueChange = useCallback(
    (measurableId: string, periodKey: string, value: string) => {
      pushScorecardHistory();
      setMeasurables((prev) =>
        prev.map((m) => {
          if (m.id !== measurableId) return m;
          const nextPv = { ...m.periodValues, [periodKey]: value };
          const nums = Object.values(nextPv)
            .map((v) => parseFloat(String(v).trim()))
            .filter((n) => !Number.isNaN(n));
          const total = nums.length ? nums.reduce((a, b) => a + b, 0) : 0;
          const avg = nums.length ? total / nums.length : 0;
          const round2 = (x: number) => Math.round(x * 100) / 100;
          return {
            ...m,
            periodValues: nextPv,
            total: String(round2(total)),
            average: String(round2(avg)),
          };
        })
      );
      if (organizationId && meetingId) {
        if (periodValueSaveTimerRef.current) clearTimeout(periodValueSaveTimerRef.current);
        periodValueSaveTimerRef.current = setTimeout(() => {
          periodValueSaveTimerRef.current = null;
          const current = measurablesRef.current;
          scorecardMeasurablesService
            .upsert(
              organizationId!,
              meetingId!,
              current.map((m, i) => ({
                id: m.id,
                scorecardGroupId: m.groupId === undefined || m.groupId === 'main' ? null : m.groupId,
                title: m.title,
                goal: m.goal,
                average: m.average,
                total: m.total,
                trend: m.trend,
                periodValues: m.periodValues,
                order: i,
              }))
            )
            .catch((e) => console.error('Failed to save period values', e));
        }, 800);
      }
    },
    [organizationId, meetingId, pushScorecardHistory]
  );

  useEffect(() => {
    return () => {
      if (periodValueSaveTimerRef.current) clearTimeout(periodValueSaveTimerRef.current);
    };
  }, []);

  const handleEditMeasurable = useCallback((row: MeasurableRow) => {
    setEditingMeasurable(row);
    setCreateMeasurableOpen(true);
  }, []);

  useLayoutEffect(() => {
    if (!moreMenuOpen || !moreMenuBtnRef.current) {
      setMoreMenuPosition(null);
      return;
    }
    const rect = moreMenuBtnRef.current.getBoundingClientRect();
    setMoreMenuPosition({ top: rect.bottom + 4, left: rect.right - 200 });
  }, [moreMenuOpen]);

  return (
    <div className={`flex flex-col min-h-0 h-full min-w-0 overflow-x-hidden ${wrap} ${isMeetingInFuture ? 'bg-muted/40 cursor-not-allowed' : ''}`}>
      {/* Section-style tabs: Weekly / Monthly / Quarterly / Annual (like Upcoming / Past / Agenda) */}
      <div className="w-full border-b border-border shrink-0 bg-background mt-0 overflow-x-auto">
        <div className="flex gap-0 px-2 min-w-max">
          {(['weekly', 'monthly', 'quarterly', 'annual'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                if (!canUseFilters) return;
                setTimeframe(tab);
                if (meetingId && socket) socket.emit('scorecard_filter', { meetingId, timeframe: tab });
              }}
              disabled={!canUseFilters}
              className={`pl-7 pr-6 py-3 text-sm font-medium border-b-2 flex items-center justify-center gap-2 text-center transition-colors rounded-t-md ${
                timeframe === tab
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              } ${!canUseFilters ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {/* Filters row: dropdowns + LTR/RTL | space | undo/redo/search/actions */}
      <div className={`w-full px-4 border-b border-border shrink-0 py-2.5 min-w-0 overflow-x-visible ${isMeetingInFuture ? 'bg-muted/50' : 'bg-muted/30'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 min-w-0 w-full">
          <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
            <Select
              value={teamName || undefined}
              options={teamName ? [{ label: teamName, value: teamName }] : []}
              className="w-[160px] shrink-0"
              disabled={!canUseFilters || !teamName}
              placeholder="Flight Crew"
            />
            <span className="text-muted-foreground text-xs shrink-0">View by:</span>
            <Select<ViewBy>
              value={viewBy}
              onChange={(v) => {
                if (!canUseFilters) return;
                if (v) setViewBy(v);
                if (meetingId && socket && v) socket.emit('scorecard_filter', { meetingId, viewBy: v });
              }}
              disabled={!canUseFilters}
              options={[
                { label: 'Week', value: 'week' },
                { label: 'Month', value: 'month' },
                { label: 'Quarter', value: 'quarter' },
                { label: 'Year', value: 'year' },
              ]}
              className="min-w-[88px] w-[88px] shrink-0"
            />
            <span className="text-muted-foreground text-xs shrink-0">Date:</span>
            <Select<DateRangeKey>
              value={dateRange}
              onChange={(v) => {
                if (!canUseFilters) return;
                if (v) setDateRange(v);
                if (meetingId && socket && v) socket.emit('scorecard_filter', { meetingId, dateRange: v });
              }}
              disabled={!canUseFilters}
              options={DATE_RANGE_OPTIONS}
              className="min-w-[140px] w-[140px] shrink-0"
            />
            <div className="flex rounded-lg border border-border overflow-hidden bg-muted/30 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (!canUseFilters) return;
                  setDisplayDirection('rtl');
                  if (meetingId && socket) socket.emit('scorecard_filter', { meetingId, displayDirection: 'rtl' });
                }}
                disabled={!canUseFilters}
                className={`flex items-center gap-1 px-2 py-1.5 text-xs transition-colors ${displayDirection === 'rtl' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'} ${!canUseFilters ? 'cursor-not-allowed opacity-60 bg-muted/50' : 'cursor-pointer'}`}
                title="Right to left"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!canUseFilters) return;
                  setDisplayDirection('ltr');
                  if (meetingId && socket) socket.emit('scorecard_filter', { meetingId, displayDirection: 'ltr' });
                }}
                disabled={!canUseFilters}
                className={`flex items-center gap-1 px-2 py-1.5 text-xs transition-colors ${displayDirection === 'ltr' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'} ${!canUseFilters ? 'cursor-not-allowed opacity-60 bg-muted/50' : 'cursor-pointer'}`}
                title="Left to right"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-shrink-0">
            <button type="button" disabled={!canUseFilters || scorecardHistory.length === 0} onClick={handleUndoScorecard} className="p-1.5 rounded-md border border-border hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer disabled:bg-muted/50 shrink-0" title="Undo score change"><RotateCcw className="w-4 h-4" /></button>
            <button type="button" disabled={!canUseFilters || scorecardRedo.length === 0} onClick={handleRedoScorecard} className="p-1.5 rounded-md border border-border hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer disabled:bg-muted/50 shrink-0" title="Redo score change"><RotateCw className="w-4 h-4" /></button>
            <button type="button" disabled={!canUseFilters} onClick={() => { setEditGroupId(null); setEditGroupInitial(null); setCreateGroupName(''); setCreateGroupDescription(''); setCreateGroupOpen(true); }} className={`flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-md text-xs font-medium shrink-0 ${canUseFilters ? 'text-primary hover:bg-accent cursor-pointer' : 'text-muted-foreground bg-muted/50 cursor-not-allowed opacity-60'}`}><Plus className="w-3.5 h-3.5" /> New Instrument Group</button>
            {meetingId ? <Link href={`/meeting/${meetingId}?segment=scorecard&manager=1`} className="px-2.5 py-1.5 border border-border rounded-md hover:bg-accent text-xs font-medium text-primary cursor-pointer inline-flex items-center shrink-0 whitespace-nowrap">Go to Metrics Console</Link> : <button type="button" disabled={!canUseFilters} className="px-2.5 py-1.5 border border-border rounded-md hover:bg-accent text-xs font-medium text-primary shrink-0 whitespace-nowrap disabled:opacity-60 disabled:bg-muted/50 disabled:cursor-not-allowed">Go to Metrics Console</button>}
            <Input.Search placeholder="Search Flight Metrics..." value={searchKpis} onChange={(e) => setSearchKpis(e.target.value)} allowClear className="max-w-[180px] min-w-0 w-full text-sm shrink" disabled={!canUseFilters} />
            {canUseFilters && (
              <div className="relative shrink-0">
                <button ref={moreMenuBtnRef} type="button" onClick={() => setMoreMenuOpen((o) => !o)} className="p-1.5 rounded-md border border-border hover:bg-accent hover:text-foreground text-muted-foreground transition-colors cursor-pointer" title="More options (Settings, Export, Print)">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {moreMenuOpen && moreMenuPosition != null && typeof document !== 'undefined' && createPortal(
                  <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setMoreMenuOpen(false)} aria-hidden />
                    <div className="fixed py-2 bg-card border border-border rounded-lg shadow-xl z-[101] min-w-[200px]" style={{ top: moreMenuPosition.top, left: moreMenuPosition.left }}>
                      <button type="button" className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 flex items-center gap-3 cursor-pointer" onClick={() => { setMoreMenuOpen(false); setSettingsPanelOpen(true); }}><Settings className="w-4 h-4 text-muted-foreground" /> Settings</button>
                      <div className="border-t border-border my-1" />
                      <button type="button" className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 flex items-center gap-3 cursor-pointer" onClick={() => { setMoreMenuOpen(false); downloadCsv(measurablesForCurrentTab, `scorecard-${timeframe}.csv`); }}><Download className="w-4 h-4 text-muted-foreground" /> Export as CSV</button>
                      <button type="button" className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 flex items-center gap-3 cursor-pointer" onClick={() => { setMoreMenuOpen(false); downloadPdf(measurablesForCurrentTab, `Flight Metrics ${timeframeLabel}`); }}><FileText className="w-4 h-4 text-muted-foreground" /> Print PDF</button>
                    </div>
                  </>,
                  document.body
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scorecard Settings — right-side sticky panel */}
      {settingsPanelOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSettingsPanelOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border shadow-xl z-50 flex flex-col">
            <header className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h3 className="text-lg font-semibold text-foreground">
                {timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Scorecard Settings
              </h3>
              <button type="button" onClick={() => setSettingsPanelOpen(false)} className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer" aria-label="Close"><X className="w-5 h-5" /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Use company default settings</p>
                  <p className="text-sm text-muted-foreground">When enabled, this Scorecard cannot override individual settings.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={scorecardSettings[timeframe].useCompanyDefault}
                  onClick={() => setScorecardSettings((p) => ({ ...p, [timeframe]: { ...p[timeframe], useCompanyDefault: !p[timeframe].useCompanyDefault } }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${scorecardSettings[timeframe].useCompanyDefault ? 'bg-primary' : 'bg-neutral-300'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition translate-x-0.5 ${scorecardSettings[timeframe].useCompanyDefault ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {[
                { key: 'showStatusIndicators' as const, label: 'Show Flight Metric status indicators', desc: 'Display icon status indicators with colors based on each flight metric\'s target. Green: On-track. Orange: At-risk. Red: Off-track.' },
                { key: 'showOwnerColumn' as const, label: 'Show Owner column', desc: 'Display the owner of the flight metric.' },
                { key: 'showGoalColumn' as const, label: 'Show Target column', desc: 'Display flight metric targets.' },
                { key: 'showAverageColumn' as const, label: 'Show Average column', desc: 'Display the average of all the data points in the selected date range.' },
                { key: 'showTotalColumn' as const, label: 'Show Total column', desc: 'Display the sum total of all the data points in the selected date range.' },
                { key: 'showCurrentPeriod' as const, label: 'Show current period', desc: 'Display the current period on the Scorecard.' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{label}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={scorecardSettings[timeframe][key]}
                    onClick={() => setScorecardSettings((p) => ({ ...p, [timeframe]: { ...p[timeframe], [key]: !p[timeframe][key] } }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${scorecardSettings[timeframe][key] ? 'bg-primary' : 'bg-neutral-300'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition translate-x-0.5 ${scorecardSettings[timeframe][key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
            <footer className="flex items-center gap-2 p-4 border-t border-border shrink-0">
              <button type="button" onClick={() => { saveScorecardSettings(timeframe, scorecardSettings[timeframe]); setSettingsPanelOpen(false); }} className="px-4 py-2 bg-primary text-primary-foreground border border-primary rounded-md hover:bg-primary/90 text-sm font-medium cursor-pointer shadow-sm">Save</button>
              <button type="button" onClick={() => setSettingsPanelOpen(false)} className="px-4 py-2 border border-border bg-background text-foreground rounded-md hover:bg-muted text-sm font-medium cursor-pointer">Cancel</button>
            </footer>
          </div>
        </>
      )}

      {/* Delete group confirmation */}
      {deleteConfirmGroupId !== null && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => !deleteGroupLoading && setDeleteConfirmGroupId(null)} aria-hidden />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg shadow-xl max-w-sm w-full p-6">
              <h3 className="text-lg font-semibold text-foreground">Delete group?</h3>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">This action cannot be undone. The group and its flight metrics will be removed from this flight metrics board.</p>
              </div>
              <div className="mt-4 pt-4 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => !deleteGroupLoading && setDeleteConfirmGroupId(null)}
                  disabled={deleteGroupLoading}
                  className="px-4 py-2 border border-border rounded-md hover:bg-muted text-sm font-medium disabled:opacity-50 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteGroup(deleteConfirmGroupId)}
                  disabled={deleteGroupLoading}
                  className="px-4 py-2 bg-primary text-primary-foreground border border-primary rounded-md hover:bg-primary/90 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition-colors shadow-sm min-h-[2.25rem]"
                >
                  {deleteGroupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Yes, delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create group / Edit group details — right-side full-height panel */}
      {createGroupOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-[55]" onClick={() => setCreateGroupOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border shadow-xl z-[60] flex flex-col h-full">
            <header className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h3 className="text-lg font-semibold text-foreground">{editGroupId ? 'Edit group details' : 'Create group'}</h3>
              <button
                type="button"
                onClick={() => setCreateGroupOpen(false)}
                className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <input
                  type="text"
                  value={createGroupName}
                  onChange={(e) => setCreateGroupName(e.target.value)}
                  placeholder="Group name"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-foreground">Description</label>
                  <span className="text-xs text-muted-foreground">{createGroupDescription.length}/300</span>
                </div>
                <textarea
                  value={createGroupDescription}
                  onChange={(e) => setCreateGroupDescription(e.target.value.slice(0, 300))}
                  placeholder="Description"
                  rows={4}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </div>
            <footer className="flex items-center gap-2 p-4 border-t border-border shrink-0 bg-card">
              <button
                type="button"
                onClick={async () => {
                  if (!createGroupName.trim()) return;
                  setCreateGroupSaving(true);
                  try {
                    if (editGroupId === 'main') {
                      setMainGroupName(createGroupName.trim());
                      setMainGroupDescription(createGroupDescription);
                      if (organizationId && meetingId) {
                        await scorecardMainGroupService.update(organizationId, meetingId, {
                          name: createGroupName.trim(),
                          description: createGroupDescription,
                        });
                      }
                      setEditGroupId(null);
                      setEditGroupInitial(null);
                      setCreateGroupOpen(false);
                      setCreateGroupName('');
                      setCreateGroupDescription('');
                      setCreateGroupSaving(false);
                      return;
                    }
                    if (useApiGroups && meetingId && organizationId) {
                      if (editGroupId) {
                        await scorecardGroupsService.update(organizationId, meetingId, editGroupId, {
                          name: createGroupName.trim(),
                          description: createGroupDescription,
                        });
                      } else {
                        await scorecardGroupsService.create(organizationId, meetingId, {
                          timeframe,
                          name: createGroupName.trim(),
                          description: createGroupDescription || undefined,
                        });
                      }
                      const list = await scorecardGroupsService.list(organizationId, meetingId);
                      const byTab: Record<TimeframeTab, Array<{ id: string; name: string; description?: string }>> = {
                        weekly: [], monthly: [], quarterly: [], annual: [],
                      };
                      list.forEach((g: ApiScorecardGroup) => {
                        const tab = g.timeframe as TimeframeTab;
                        if (byTab[tab]) byTab[tab].push({ id: g.id, name: g.name, description: g.description ?? undefined });
                      });
                      setGroupsByTimeframe(byTab);
                    } else {
                      if (editGroupId) {
                        setGroupsByTimeframe((prev) => ({
                          ...prev,
                          [timeframe]: (prev[timeframe] || []).map((gr) => gr.id === editGroupId ? { ...gr, name: createGroupName.trim(), description: createGroupDescription } : gr),
                        }));
                      } else {
                        const id = `group-${Date.now()}`;
                        setGroupsByTimeframe((prev) => ({
                          ...prev,
                          [timeframe]: [...(prev[timeframe] || []), { id, name: createGroupName.trim(), description: createGroupDescription }],
                        }));
                      }
                    }
                    setEditGroupId(null);
                    setEditGroupInitial(null);
                    setCreateGroupOpen(false);
                    setCreateGroupName('');
                    setCreateGroupDescription('');
                  } catch (e) {
                    console.error('Failed to save group', e);
                  } finally {
                    setCreateGroupSaving(false);
                  }
                }}
                disabled={
                  createGroupSaving ||
                  (editGroupId && editGroupInitial
                    ? !createGroupName.trim() ||
                      (createGroupName.trim() === editGroupInitial.name && createGroupDescription === editGroupInitial.description)
                    : !createGroupName.trim())
                }
                className="px-4 py-2 bg-primary text-primary-foreground border border-primary rounded-md hover:bg-primary/90 text-sm font-medium cursor-pointer shadow-sm disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 min-w-[80px]"
              >
                {createGroupSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateGroupOpen(false);
                  setCreateGroupName('');
                  setCreateGroupDescription('');
                  setEditGroupId(null);
                  setEditGroupInitial(null);
                }}
                className="px-4 py-2 border border-border bg-background text-foreground rounded-md hover:bg-muted text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
            </footer>
          </div>
        </>
      )}

      {/* Add existing flight metric — modal */}
      {addExistingModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setAddExistingModalOpen(false)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[80vh] bg-card border border-border rounded-lg shadow-xl z-50 flex flex-col">
            <header className="p-4 border-b border-border shrink-0">
              <h3 className="text-lg font-semibold text-foreground">{timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Measurables</h3>
              <p className="text-sm text-muted-foreground mt-0.5">All the {timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Measurables in your company</p>
            </header>
            <div className="p-4 border-b border-border shrink-0 flex flex-col sm:flex-row gap-3 flex-wrap">
              <Input.Search
                placeholder="Search flight metrics..."
                value={addExistingSearch}
                onChange={(e) => setAddExistingSearch(e.target.value)}
                allowClear
                className="flex-1 min-w-[200px]"
              />
              <Select
                placeholder="Person"
                value={addExistingPersonFilter}
                onChange={(v) => setAddExistingPersonFilter(v ?? 'All')}
                options={personOptions}
                showSearch
                filterOption={(input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                className="w-auto min-w-[140px] max-w-[220px]"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4 min-h-[120px]">
              {(() => {
                const filtered = savedMeasurables.filter((m) => m.title.toLowerCase().includes(addExistingSearch.toLowerCase()));
                if (filtered.length === 0) return <div className="text-center py-8 text-muted-foreground">No results found</div>;
                return (
                  <ul className="space-y-2">
                    {filtered.map((m) => (
                      <li key={m.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50">
                        <span className="text-sm font-medium text-foreground">{m.title}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
            <footer className="flex items-center justify-end gap-2 p-4 border-t border-border shrink-0">
              <button type="button" onClick={() => setAddExistingModalOpen(false)} className="px-4 py-2 border border-border bg-background text-foreground rounded-md hover:bg-muted text-sm font-medium cursor-pointer">Cancel</button>
              <button type="button" onClick={() => { setAddExistingModalOpen(false); setAddExistingSearch(''); setAddExistingPersonFilter('All'); }} className="px-4 py-2 bg-primary text-primary-foreground border border-primary rounded-md hover:bg-primary/90 text-sm font-medium cursor-pointer shadow-sm">Add</button>
            </footer>
          </div>
        </>
      )}

      {/* Create flight metric — right-side panel */}
      {(createMeasurableOpen || editingMeasurable) && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setCreateMeasurableCloseConfirmOpen(true)} aria-hidden />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border shadow-xl z-50 flex flex-col">
            <header className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-muted/20">
              <h3 className="text-lg font-semibold text-foreground">{editingMeasurable ? 'Edit Flight Metric' : 'Create Flight Metric'}</h3>
              <div className="flex items-center gap-2 relative">
                <button
                  type="button"
                  onClick={() => setMeasurableMenuOpen((o) => !o)}
                  className="p-2.5 rounded-md hover:bg-muted text-muted-foreground"
                  aria-label="More options"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {measurableMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setMeasurableMenuOpen(false)} aria-hidden />
                    <div className="absolute right-20 top-full z-[61] py-2 bg-card border border-border rounded-lg shadow-xl min-w-[220px]">
                      <div className="px-2 py-1 space-y-0.5">
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-md"
                          onClick={() => {
                            if (!editingMeasurable || !onOpenCreate) return;
                            setCreateMeasurableOpen(false);
                            setEditingMeasurable(null);
                            setMeasurableMenuOpen(false);
                            onOpenCreate('todo', {
                              title: `Clearance: ${editingMeasurable.title}`,
                              description: `Flight metric: ${editingMeasurable.title}`,
                              linkedEntity: { type: 'measurable', id: editingMeasurable.id, title: editingMeasurable.title },
                            });
                          }}
                        >
                          <CheckSquare className="w-4 h-4 shrink-0 text-muted-foreground" /> Create Clearance
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-md"
                          onClick={() => {
                            if (!editingMeasurable || !onOpenCreate) return;
                            setCreateMeasurableOpen(false);
                            setEditingMeasurable(null);
                            setMeasurableMenuOpen(false);
                            onOpenCreate('issue', {
                              title: `Turbulence: ${editingMeasurable.title}`,
                              description: `Flight metric: ${editingMeasurable.title}`,
                              linkedEntity: { type: 'measurable', id: editingMeasurable.id, title: editingMeasurable.title },
                            });
                          }}
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0 text-muted-foreground" /> Create Turbulence
                        </button>
                        {editingMeasurable?.groupId && (
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center gap-2 rounded-md"
                            onClick={() => {
                              setMeasurableMenuOpen(false);
                              handleRemoveFromGroup([editingMeasurable.id]);
                            }}
                          >
                            <MinusCircle className="w-4 h-4 shrink-0 text-muted-foreground" /> Remove from group
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOwnerPickerOpen((v) => !v)}
                    className="w-9 h-9 rounded-full bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-xs font-semibold text-primary hover:bg-primary/20"
                    title={`Owner: ${ownerName}`}
                    aria-label="Change owner"
                  >
                    {ownerInitials}
                  </button>
                  {ownerPickerOpen && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setOwnerPickerOpen(false)} aria-hidden />
                      <div className="absolute right-0 top-full mt-2 z-[61] w-[280px] bg-card border border-border rounded-lg shadow-xl p-2">
                        <input
                          type="text"
                          value={ownerSearch}
                          onChange={(e) => setOwnerSearch(e.target.value)}
                          placeholder="Search crew member..."
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm mb-2"
                        />
                        <button
                          type="button"
                          onClick={() => handleOwnerSelect('')}
                          className="w-full text-left px-2.5 py-2 rounded hover:bg-muted text-sm text-muted-foreground"
                        >
                          No owner
                        </button>
                        <div className="max-h-60 overflow-auto">
                          {ownerCandidates.map((m) => {
                            const uid = m.user?.id ?? m.userId;
                            const label = m.user?.name || m.user?.email || uid;
                            const initials = getInitials(m.user?.name, m.user?.email);
                            const isSelected = createMeasurableOwnerId === uid;
                            return (
                              <button
                                key={uid}
                                type="button"
                                onClick={() => handleOwnerSelect(uid)}
                                className={`w-full text-left px-2.5 py-2 rounded flex items-center gap-2 text-sm ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}`}
                              >
                                <span className="w-6 h-6 rounded-full bg-muted inline-flex items-center justify-center text-xs">{initials}</span>
                                <span className="truncate">{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <button type="button" onClick={() => setCreateMeasurableCloseConfirmOpen(true)} className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors" aria-label="Close"><X className="w-5 h-5" /></button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <section>
                <label className="block text-sm font-medium text-foreground mb-2">Title</label>
                <input type="text" value={createMeasurableTitle} onChange={(e) => setCreateMeasurableTitle(e.target.value)} placeholder="Metric name" className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow" />
              </section>

              <hr className="border-border" />

              <section>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">Description (Optional)</label>
                  <span className="text-xs text-muted-foreground">{(createMeasurableDescription.replace(/<[^>]*>/g, '').length)}/10000</span>
                </div>
                <RichTextEditor value={createMeasurableDescription} onChange={setCreateMeasurableDescription} placeholder="Add a description" className="rounded-lg" />
              </section>

              <hr className="border-border" />

              <section>
                <label className="block text-sm font-medium text-foreground mb-2">Reporting Interval</label>
                <Select
                  className="w-full"
                  options={[
                    { label: 'Weekly', value: 'Weekly' },
                    { label: 'Monthly', value: 'Monthly' },
                    { label: 'Quarterly', value: 'Quarterly' },
                  ]}
                  placeholder="Select interval"
                />
              </section>
              <hr className="border-border" />

              <section>
                <p className="text-sm font-medium text-foreground mb-3">Columns</p>
                <div className="space-y-4">
                  {[
                    { key: 'showTotal' as const, label: 'Show Total', desc: 'This column shows the sum total of all the data points in this row.' },
                    { key: 'showAverage' as const, label: 'Show Average', desc: 'This column shows the average of all the data points in this row.' },
                    { key: 'showGoal' as const, label: 'Show Target', desc: 'This column shows the intended target of this flight metric.' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                      <button type="button" role="switch" aria-checked={key === 'showTotal' ? createMeasurableShowTotal : key === 'showAverage' ? createMeasurableShowAverage : createMeasurableShowGoal} onClick={() => { if (key === 'showTotal') setCreateMeasurableShowTotal((o) => !o); if (key === 'showAverage') setCreateMeasurableShowAverage((o) => !o); if (key === 'showGoal') setCreateMeasurableShowGoal((o) => !o); }} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${(key === 'showTotal' ? createMeasurableShowTotal : key === 'showAverage' ? createMeasurableShowAverage : createMeasurableShowGoal) ? 'bg-primary' : 'bg-muted'}`}>
                        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition translate-x-0.5 ${(key === 'showTotal' ? createMeasurableShowTotal : key === 'showAverage' ? createMeasurableShowAverage : createMeasurableShowGoal) ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <hr className="border-border" />

              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-sm font-medium text-foreground">Target</h4>
                  <button type="button" className="p-0.5 rounded-full hover:bg-muted text-muted-foreground" aria-label="Info"><Info className="w-4 h-4" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Unit</label>
                    <Select
                      value={createMeasurableUnit}
                      onChange={(v) => v && setCreateMeasurableUnit(v)}
                      options={[
                        { label: 'Number', value: 'Number' },
                        { label: 'Percentage', value: 'Percentage' },
                        { label: 'Currency', value: 'Currency' },
                      ]}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Orientation rule</label>
                    <Select
                      value={createMeasurableOrientation}
                      onChange={(v) => v && setCreateMeasurableOrientation(v)}
                      options={[
                        { label: 'Greater than or equal to goal', value: 'Greater than or equal to goal' },
                        { label: 'Less than or equal to goal', value: 'Less than or equal to goal' },
                        { label: 'Equal to goal', value: 'Equal to goal' },
                      ]}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Value</label>
                    <div className="flex">
                      <input type="number" value={createMeasurableGoalValue} onChange={(e) => setCreateMeasurableGoalValue(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-l-lg rounded-r-none bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      <div className="flex flex-col border border-l-0 border-border rounded-r-lg overflow-hidden">
                        <button type="button" onClick={() => setCreateMeasurableGoalValue((v) => v + 1)} className="px-2 py-0.5 border-b border-border hover:bg-muted text-foreground">▲</button>
                        <button type="button" onClick={() => setCreateMeasurableGoalValue((v) => v - 1)} className="px-2 py-0.5 hover:bg-muted text-foreground">▼</button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Show rollup data as</label>
                    <Select
                      value={createMeasurableRollup}
                      onChange={(v) => v && setCreateMeasurableRollup(v)}
                      options={[
                        { label: 'Total (default)', value: 'Total (default)' },
                        { label: 'Average', value: 'Average' },
                        { label: 'Min', value: 'Min' },
                        { label: 'Max', value: 'Max' },
                      ]}
                      className="w-full"
                    />
                  </div>
                </div>
              </section>

              <hr className="border-border" />

              <section className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Enable Formula Builder</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Build a custom formula with other Measurables.</p>
                  </div>
                  <button type="button" role="switch" aria-checked={createMeasurableFormulaBuilder} onClick={() => setCreateMeasurableFormulaBuilder((o) => !o)} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${createMeasurableFormulaBuilder ? 'bg-primary' : 'bg-muted'}`}>
                    <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition translate-x-0.5 ${createMeasurableFormulaBuilder ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </section>
            </div>
            <footer className="flex items-center gap-2 p-4 border-t border-border shrink-0 bg-muted/10">
              <button
                type="button"
                onClick={async () => {
                  if (savingMeasurable) return;
                  if (!createMeasurableTitle.trim()) return;
                  const goalOp = createMeasurableOrientation.includes('Greater') ? '>=' : createMeasurableOrientation.includes('Less') ? '<=' : '=';
                  const goalStr = `${goalOp} ${createMeasurableGoalValue}`;
                  setSavingMeasurable(true);
                  const persistMeasurables = async (rows: MeasurableRow[]) => {
                    if (!organizationId || !meetingId) return;
                    const payload = rows.map((mm, i) => ({
                      id: mm.id,
                      scorecardGroupId: mm.groupId === undefined || mm.groupId === 'main' ? null : mm.groupId,
                      title: mm.title,
                      goal: mm.goal,
                      average: mm.average,
                      total: mm.total,
                      trend: mm.trend,
                      periodValues: withOwnerMeta(mm.periodValues ?? {}, {
                        ownerId: mm.ownerId,
                        ownerName: mm.ownerName,
                        ownerEmail: mm.ownerEmail,
                        ownerInitials: mm.ownerInitials,
                      }),
                      order: i,
                    }));
                    const payloadKey = JSON.stringify(payload);
                    const guard = measurableUpsertGuardRef.current;
                    const now = Date.now();
                    if (guard && guard.payloadKey === payloadKey && now - guard.ts < 1000) return;
                    measurableUpsertGuardRef.current = { payloadKey, ts: now };
                    await scorecardMeasurablesService.upsert(organizationId, meetingId, payload);
                  };
                  if (editingMeasurable) {
                    pushScorecardHistory();
                    const effectiveOwnerId = createMeasurableOwnerId || currentUserId || '';
                    const ownerMeta = resolveOwnerMeta(effectiveOwnerId);
                    const next = measurablesRef.current.map((m) =>
                      m.id === editingMeasurable.id
                        ? {
                            ...m,
                            title: createMeasurableTitle.trim(),
                            goal: createMeasurableShowGoal ? goalStr : '',
                            average: createMeasurableShowAverage ? m.average : '',
                            total: createMeasurableShowTotal ? m.total : '',
                            showGoal: createMeasurableShowGoal,
                            showAverage: createMeasurableShowAverage,
                            showTotal: createMeasurableShowTotal,
                            ownerId: effectiveOwnerId,
                            ownerName: ownerMeta.ownerName,
                            ownerEmail: ownerMeta.ownerEmail,
                            ownerInitials: ownerMeta.ownerInitials,
                          }
                        : m
                    );
                    setMeasurables(next);
                    await persistMeasurables(next).catch((e) => console.error('Failed to save measurable', e));
                    setEditingMeasurable(null);
                    setCreateMeasurableOpen(false);
                    setCreateMeasurableTitle('');
                    setCreateMeasurableDescription('');
                    setCreateMeasurableGoalValue(0);
                    setCreateMeasurableShowTotal(true);
                    setCreateMeasurableShowAverage(true);
                    setCreateMeasurableShowGoal(true);
                    setCreateMeasurableOwnerId('');
                    setSavingMeasurable(false);
                    return;
                  }
                  if (createMeasurableForGroupId == null) {
                    setSavingMeasurable(false);
                    return;
                  }
                  const newId = `m-${Date.now()}`;
                  const displayGroupId = createMeasurableForGroupId === 'main' ? undefined : createMeasurableForGroupId;
                  const effectiveOwnerId = createMeasurableOwnerId || currentUserId || '';
                  const ownerMeta = resolveOwnerMeta(effectiveOwnerId);
                  const newRow: MeasurableRow = {
                    id: newId,
                    title: createMeasurableTitle.trim(),
                    goal: createMeasurableShowGoal ? goalStr : '',
                    average: createMeasurableShowAverage ? '0' : '',
                    total: createMeasurableShowTotal ? '0' : '',
                    trend: 'neutral',
                    periodValues: {},
                    groupId: displayGroupId,
                    showGoal: createMeasurableShowGoal,
                    showAverage: createMeasurableShowAverage,
                    showTotal: createMeasurableShowTotal,
                    ownerId: effectiveOwnerId,
                    ownerName: ownerMeta.ownerName,
                    ownerEmail: ownerMeta.ownerEmail,
                    ownerInitials: ownerMeta.ownerInitials,
                  };
                  pushScorecardHistory();
                  const next = [...measurablesRef.current, newRow];
                  setMeasurables(next);
                  await persistMeasurables(next).catch((e) => console.error('Failed to save new measurable', e));
                  setCreateMeasurableOpen(false);
                  setCreateMeasurableTitle('');
                  setCreateMeasurableDescription('');
                  setCreateMeasurableGoalValue(0);
                  setCreateMeasurableShowTotal(true);
                  setCreateMeasurableShowAverage(true);
                  setCreateMeasurableShowGoal(true);
                  setCreateMeasurableOwnerId('');
                  setCreateMeasurableForGroupId(null);
                  setSavingMeasurable(false);
                }}
                disabled={savingMeasurable}
                className="px-4 py-2.5 bg-primary text-primary-foreground border border-primary rounded-lg hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium cursor-pointer shadow-sm transition-colors"
              >
                {savingMeasurable ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => setCreateMeasurableCloseConfirmOpen(true)} className="px-4 py-2.5 border border-border bg-background text-foreground rounded-lg hover:bg-muted text-sm font-medium cursor-pointer transition-colors">Cancel</button>
            </footer>
          </div>
        </>
      )}

      {/* Create flight metric — close confirmation */}
      {createMeasurableCloseConfirmOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[60]" onClick={() => setCreateMeasurableCloseConfirmOpen(false)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl z-[61] p-5">
            <p className="text-sm font-medium text-foreground mb-4">Are you sure you want to close? Your changes won&apos;t be saved.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreateMeasurableCloseConfirmOpen(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm font-medium cursor-pointer">Stay</button>
              <button type="button" onClick={() => { setCreateMeasurableCloseConfirmOpen(false); setCreateMeasurableOpen(false); setEditingMeasurable(null); setCreateMeasurableTitle(''); setCreateMeasurableDescription(''); setCreateMeasurableForGroupId(null); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium cursor-pointer">Close</button>
            </div>
          </div>
        </>
      )}
      {confirmOwnerChangeOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-[70]"
            onClick={() => {
              setConfirmOwnerChangeOpen(false);
              setPendingOwnerId(null);
            }}
            aria-hidden
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[71] w-full max-w-sm bg-card border border-border rounded-lg shadow-xl p-5">
            <h3 className="text-base font-semibold text-foreground mb-2">Change owner?</h3>
            <p className="text-sm text-muted-foreground mb-4">Only admins can change owner. Confirm this owner update.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 border border-border rounded-md text-sm hover:bg-muted"
                onClick={() => {
                  setConfirmOwnerChangeOpen(false);
                  setPendingOwnerId(null);
                }}
              >
                No
              </button>
              <button
                type="button"
                className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
                onClick={confirmOwnerChange}
              >
                Yes
              </button>
            </div>
          </div>
        </>
      )}

      {/* Content: padding after filter bar — fixed header above, only this area scrolls when expanded */}
      <div className={`flex-1 flex flex-col min-h-0 mt-4 ${contentPad} gap-4 overflow-hidden`}>
        {useApiGroups && (scorecardGroupsLoading || scorecardMeasurablesLoading) ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[200px] text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin" aria-hidden />
            <p className="text-sm font-medium">Loading scorecard…</p>
          </div>
        ) : expandedGroupId ? (
          <>
            {/* Expanded card: 80% of content area; rest of cards below in scroll */}
            {expandedGroupId === 'main' && !mainGroupHidden ? (
              <ScorecardTableCard
                key="main"
                title={mainGroup.name + (mainMeasurables.length ? ` ${mainMeasurables.length}` : '')}
                data={mainMeasurables}
                periodColumns={periodColumns}
                displayDirection={displayDirection}
                columnVisibility={scorecardColumnVisibility}
                newMeasurableOpen={newMeasurableOpenGroupId === 'main'}
                onNewMeasurableToggle={() => setNewMeasurableOpenGroupId((id) => (id === 'main' ? null : 'main'))}
                onCreateNew={(groupId) => { setCreateMeasurableForGroupId(groupId); setCreateMeasurableOpen(true); }}
                onAddExisting={() => setAddExistingModalOpen(true)}
                className="flex-[0_0_80%] min-h-0 shrink-0"
                groupId="main"
                group={mainGroup}
                onEditGroup={(gr) => { setCreateGroupName(gr.name); setCreateGroupDescription(gr.description || ''); setEditGroupInitial({ name: gr.name, description: gr.description || '' }); setEditGroupId(gr.id); setCreateGroupOpen(true); }}
                onDeleteGroup={canUseFilters ? (id) => setDeleteConfirmGroupId(id) : undefined}
                isExpanded={true}
                onExpand={() => setExpandedGroupId(null)}
                isCollapsed={collapsedGroupIds.has('main')}
                onCollapse={() => setCollapsedGroupIds((s) => { const n = new Set(s); if (n.has('main')) n.delete('main'); else n.add('main'); return n; })}
                otherGroups={otherGroupsForMain}
                onMoveToGroup={handleMoveToGroup}
                onDuplicate={handleDuplicateMeasurables}
                onCreateTodo={handleCreateTodoFromMeasurable}
                onCreateIssue={handleCreateIssueFromMeasurable}
                onRemoveFromGroup={handleRemoveFromGroup}
                onDelete={handleDeleteMeasurables}
                onPeriodValueChange={canUseFilters ? handlePeriodValueChange : undefined}
                onEditMeasurable={canUseFilters ? handleEditMeasurable : undefined}
              />
            ) : currentGroups.find((g) => g.id === expandedGroupId) ? (
              <ScorecardTableCard
                key={expandedGroupId}
                title={currentGroups.find((g) => g.id === expandedGroupId)!.name}
                data={measurables.filter((m) => m.groupId === expandedGroupId)}
                periodColumns={periodColumns}
                displayDirection={displayDirection}
                columnVisibility={scorecardColumnVisibility}
                newMeasurableOpen={newMeasurableOpenGroupId === expandedGroupId}
                onNewMeasurableToggle={() => setNewMeasurableOpenGroupId((id) => (id === expandedGroupId ? null : expandedGroupId))}
                onCreateNew={(groupId) => { setCreateMeasurableForGroupId(groupId); setCreateMeasurableOpen(true); }}
                onAddExisting={() => setAddExistingModalOpen(true)}
                className="flex-[0_0_80%] min-h-0 shrink-0"
                groupId={expandedGroupId}
                group={currentGroups.find((g) => g.id === expandedGroupId)!}
                onEditGroup={(gr) => { setCreateGroupName(gr.name); setCreateGroupDescription(gr.description || ''); setEditGroupInitial({ name: gr.name, description: gr.description || '' }); setEditGroupId(gr.id); setCreateGroupOpen(true); }}
                onDeleteGroup={canUseFilters ? (id) => setDeleteConfirmGroupId(id) : undefined}
                isExpanded={true}
                onExpand={() => setExpandedGroupId(null)}
                isCollapsed={collapsedGroupIds.has(expandedGroupId)}
                onCollapse={() => setCollapsedGroupIds((s) => { const n = new Set(s); if (n.has(expandedGroupId)) n.delete(expandedGroupId); else n.add(expandedGroupId); return n; })}
                otherGroups={otherGroupsForGroupId(expandedGroupId)}
                onMoveToGroup={handleMoveToGroup}
                onDuplicate={handleDuplicateMeasurables}
                onCreateTodo={handleCreateTodoFromMeasurable}
                onCreateIssue={handleCreateIssueFromMeasurable}
                onRemoveFromGroup={handleRemoveFromGroup}
                onDelete={handleDeleteMeasurables}
                onPeriodValueChange={canUseFilters ? handlePeriodValueChange : undefined}
                onEditMeasurable={canUseFilters ? handleEditMeasurable : undefined}
              />
            ) : null}
            <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-4">
              {expandedGroupId === 'main' ? (
                currentGroups.map((g) => (
                  <ScorecardTableCard
                    key={g.id}
                    title={g.name}
                    data={measurables.filter((m) => m.groupId === g.id)}
                    periodColumns={periodColumns}
                    displayDirection={displayDirection}
                    columnVisibility={scorecardColumnVisibility}
                    newMeasurableOpen={newMeasurableOpenGroupId === g.id}
                    onNewMeasurableToggle={() => setNewMeasurableOpenGroupId((id) => (id === g.id ? null : g.id))}
                    onCreateNew={(groupId) => { setCreateMeasurableForGroupId(groupId); setCreateMeasurableOpen(true); }}
                    onAddExisting={() => setAddExistingModalOpen(true)}
                    className={collapsedGroupIds.has(g.id) ? 'shrink-0' : 'min-h-[200px] shrink-0'}
                    groupId={g.id}
                    group={g}
                    onEditGroup={(gr) => { setCreateGroupName(gr.name); setCreateGroupDescription(gr.description || ''); setEditGroupInitial({ name: gr.name, description: gr.description || '' }); setEditGroupId(gr.id); setCreateGroupOpen(true); }}
                    onDeleteGroup={canUseFilters ? (id) => setDeleteConfirmGroupId(id) : undefined}
                    isExpanded={false}
                    onExpand={() => setExpandedGroupId(g.id)}
                    isCollapsed={collapsedGroupIds.has(g.id)}
                    onCollapse={() => setCollapsedGroupIds((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}
                    otherGroups={otherGroupsForGroupId(g.id)}
                    onMoveToGroup={handleMoveToGroup}
                    onDuplicate={handleDuplicateMeasurables}
                    onCreateTodo={handleCreateTodoFromMeasurable}
                    onCreateIssue={handleCreateIssueFromMeasurable}
                    onRemoveFromGroup={handleRemoveFromGroup}
                    onDelete={handleDeleteMeasurables}
                    onPeriodValueChange={canUseFilters ? handlePeriodValueChange : undefined}
                    onEditMeasurable={canUseFilters ? handleEditMeasurable : undefined}
                  />
                ))
              ) : (
                <>
                  {!mainGroupHidden && (
                  <ScorecardTableCard
                    title={mainGroup.name + (mainMeasurables.length ? ` ${mainMeasurables.length}` : '')}
                    data={mainMeasurables}
                    periodColumns={periodColumns}
                    displayDirection={displayDirection}
                    newMeasurableOpen={newMeasurableOpenGroupId === 'main'}
                    onNewMeasurableToggle={() => setNewMeasurableOpenGroupId((id) => (id === 'main' ? null : 'main'))}
                    onCreateNew={(groupId) => { setCreateMeasurableForGroupId(groupId); setCreateMeasurableOpen(true); }}
                    onAddExisting={() => setAddExistingModalOpen(true)}
                    className={collapsedGroupIds.has('main') ? 'shrink-0' : 'min-h-[200px] shrink-0'}
                    groupId="main"
                    group={mainGroup}
                    onEditGroup={(gr) => { setCreateGroupName(gr.name); setCreateGroupDescription(gr.description || ''); setEditGroupInitial({ name: gr.name, description: gr.description || '' }); setEditGroupId(gr.id); setCreateGroupOpen(true); }}
                    onDeleteGroup={canUseFilters ? (id) => setDeleteConfirmGroupId(id) : undefined}
                    isExpanded={false}
                    onExpand={() => setExpandedGroupId('main')}
                    isCollapsed={collapsedGroupIds.has('main')}
                    onCollapse={() => setCollapsedGroupIds((s) => { const n = new Set(s); if (n.has('main')) n.delete('main'); else n.add('main'); return n; })}
                    otherGroups={otherGroupsForMain}
                    onMoveToGroup={handleMoveToGroup}
                    onDuplicate={handleDuplicateMeasurables}
                    onCreateTodo={handleCreateTodoFromMeasurable}
                    onCreateIssue={handleCreateIssueFromMeasurable}
                    onRemoveFromGroup={handleRemoveFromGroup}
                    onDelete={handleDeleteMeasurables}
                    onPeriodValueChange={canUseFilters ? handlePeriodValueChange : undefined}
                    onEditMeasurable={canUseFilters ? handleEditMeasurable : undefined}
                  />
                  )}
                  {currentGroups.filter((g) => g.id !== expandedGroupId).map((g) => (
                    <ScorecardTableCard
                      key={g.id}
                      title={g.name}
                      data={measurables.filter((m) => m.groupId === g.id)}
                      periodColumns={periodColumns}
                      displayDirection={displayDirection}
                      columnVisibility={scorecardColumnVisibility}
                      newMeasurableOpen={newMeasurableOpenGroupId === g.id}
                      onNewMeasurableToggle={() => setNewMeasurableOpenGroupId((id) => (id === g.id ? null : g.id))}
                      onCreateNew={(groupId) => { setCreateMeasurableForGroupId(groupId); setCreateMeasurableOpen(true); }}
                      onAddExisting={() => setAddExistingModalOpen(true)}
                      className={collapsedGroupIds.has(g.id) ? 'shrink-0' : 'min-h-[200px] shrink-0'}
                      groupId={g.id}
                      group={g}
                      onEditGroup={(gr) => { setCreateGroupName(gr.name); setCreateGroupDescription(gr.description || ''); setEditGroupInitial({ name: gr.name, description: gr.description || '' }); setEditGroupId(gr.id); setCreateGroupOpen(true); }}
                      onDeleteGroup={canUseFilters ? (id) => setDeleteConfirmGroupId(id) : undefined}
                      isExpanded={false}
                      onExpand={() => setExpandedGroupId(g.id)}
                      isCollapsed={collapsedGroupIds.has(g.id)}
                      onCollapse={() => setCollapsedGroupIds((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}
                      otherGroups={otherGroupsForGroupId(g.id)}
                      onMoveToGroup={handleMoveToGroup}
                      onDuplicate={handleDuplicateMeasurables}
                      onCreateTodo={handleCreateTodoFromMeasurable}
                      onCreateIssue={handleCreateIssueFromMeasurable}
                      onRemoveFromGroup={handleRemoveFromGroup}
                      onDelete={handleDeleteMeasurables}
                      onPeriodValueChange={canUseFilters ? handlePeriodValueChange : undefined}
                      onEditMeasurable={canUseFilters ? handleEditMeasurable : undefined}
                    />
                  ))}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto gap-4">
            {!mainGroupHidden && (
            <ScorecardTableCard
              title={mainGroup.name + (mainMeasurables.length ? ` ${mainMeasurables.length}` : '')}
              data={mainMeasurables}
              periodColumns={periodColumns}
              displayDirection={displayDirection}
              columnVisibility={scorecardColumnVisibility}
              newMeasurableOpen={newMeasurableOpenGroupId === 'main'}
              onNewMeasurableToggle={() => setNewMeasurableOpenGroupId((id) => (id === 'main' ? null : 'main'))}
              onCreateNew={(groupId) => { setCreateMeasurableForGroupId(groupId); setCreateMeasurableOpen(true); }}
              onAddExisting={() => setAddExistingModalOpen(true)}
              className="min-h-0 flex-1 shrink-0"
              groupId="main"
              group={mainGroup}
              onEditGroup={(gr) => { setCreateGroupName(gr.name); setCreateGroupDescription(gr.description || ''); setEditGroupInitial({ name: gr.name, description: gr.description || '' }); setEditGroupId(gr.id); setCreateGroupOpen(true); }}
              onDeleteGroup={canUseFilters ? (id) => setDeleteConfirmGroupId(id) : undefined}
              isExpanded={false}
              onExpand={() => setExpandedGroupId('main')}
              isCollapsed={collapsedGroupIds.has('main')}
              onCollapse={() => setCollapsedGroupIds((s) => { const n = new Set(s); if (n.has('main')) n.delete('main'); else n.add('main'); return n; })}
              otherGroups={otherGroupsForMain}
              onMoveToGroup={handleMoveToGroup}
              onDuplicate={handleDuplicateMeasurables}
              onCreateTodo={handleCreateTodoFromMeasurable}
              onCreateIssue={handleCreateIssueFromMeasurable}
              onRemoveFromGroup={handleRemoveFromGroup}
              onDelete={handleDeleteMeasurables}
              onPeriodValueChange={canUseFilters ? handlePeriodValueChange : undefined}
              onEditMeasurable={canUseFilters ? handleEditMeasurable : undefined}
            />
            )}
            {currentGroups.map((g) => (
              <ScorecardTableCard
                key={g.id}
                title={g.name}
                data={measurables.filter((m) => m.groupId === g.id)}
                periodColumns={periodColumns}
                displayDirection={displayDirection}
                newMeasurableOpen={newMeasurableOpenGroupId === g.id}
                onNewMeasurableToggle={() => setNewMeasurableOpenGroupId((id) => (id === g.id ? null : g.id))}
                onCreateNew={(groupId) => { setCreateMeasurableForGroupId(groupId); setCreateMeasurableOpen(true); }}
                onAddExisting={() => setAddExistingModalOpen(true)}
                className={collapsedGroupIds.has(g.id) ? 'shrink-0' : 'min-h-[240px] shrink-0'}
                groupId={g.id}
                group={g}
                onEditGroup={(gr) => { setCreateGroupName(gr.name); setCreateGroupDescription(gr.description || ''); setEditGroupInitial({ name: gr.name, description: gr.description || '' }); setEditGroupId(gr.id); setCreateGroupOpen(true); }}
                onDeleteGroup={canUseFilters ? (id) => setDeleteConfirmGroupId(id) : undefined}
                isExpanded={false}
                onExpand={() => setExpandedGroupId(g.id)}
                isCollapsed={collapsedGroupIds.has(g.id)}
                onCollapse={() => setCollapsedGroupIds((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}
                otherGroups={otherGroupsForGroupId(g.id)}
                onMoveToGroup={handleMoveToGroup}
                onDuplicate={handleDuplicateMeasurables}
                onCreateTodo={handleCreateTodoFromMeasurable}
                onCreateIssue={handleCreateIssueFromMeasurable}
                onRemoveFromGroup={handleRemoveFromGroup}
                onDelete={handleDeleteMeasurables}
                onPeriodValueChange={canUseFilters ? handlePeriodValueChange : undefined}
                onEditMeasurable={canUseFilters ? handleEditMeasurable : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
