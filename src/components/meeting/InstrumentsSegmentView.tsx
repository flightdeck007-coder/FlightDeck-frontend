'use client';

import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  ChevronDown,
  Search,
  RotateCcw,
  RotateCw,
  Plus,
  MoreHorizontal,
  Minus,
  Maximize2,
  ChevronUp,
  User,
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
} from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { scorecardGroupsService, type ScorecardGroup as ApiScorecardGroup } from '@/lib/api/meetings.service';
import { useMeetingSocket } from '@/contexts/MeetingSocketContext';

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
}

const MOCK_MEASURABLES: MeasurableRow[] = [
  { id: '1', title: 'measurable', goal: '>= 0', average: '0', total: '0', trend: 'down', periodValues: {} },
];

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
  onOpenSettings,
}: {
  title: string;
  data: MeasurableRow[];
  periodColumns: string[];
  displayDirection: 'ltr' | 'rtl';
  newMeasurableOpen: boolean;
  onNewMeasurableToggle: () => void;
  onCreateNew: () => void;
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
  onOpenSettings?: () => void;
}) {
  const columns = useMemo<ColumnDef<MeasurableRow, unknown>[]>(() => {
    const cols: ColumnDef<MeasurableRow, unknown>[] = [
      { id: 'select', header: () => <input type="checkbox" className="rounded border-border" />, cell: () => <input type="checkbox" className="rounded border-border" />, size: 40 },
      { id: 'trend', header: () => <span className="font-medium text-foreground">View Trend</span>, cell: ({ row }) => (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600">
          {row.original.trend === 'down' ? <Minus className="w-3 h-3" /> : '−'}
        </span>
      ), size: 100 },
      { id: 'title', header: () => <span className="font-medium text-foreground">Title</span>, cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{row.original.title}</span>
          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs text-foreground/70"><User className="w-3 h-3" /></span>
        </div>
      ), size: 180 },
      { id: 'goal', header: () => <span className="font-medium text-foreground">Goal</span>, cell: ({ row }) => row.original.goal, size: 100 },
      { id: 'average', header: () => <span className="font-medium text-foreground">Average</span>, cell: ({ row }) => row.original.average, size: 90 },
      { id: 'total', header: () => <span className="font-medium text-foreground">Total</span>, cell: ({ row }) => row.original.total, size: 80 },
      ...periodColumns.map((label, i) => ({
        id: `period-${i}`,
        header: () => <span className="font-medium text-foreground text-xs whitespace-nowrap">{label}</span>,
        cell: ({ row }: { row: { original: MeasurableRow } }) => row.original.periodValues[label] ?? '—',
        size: 100,
      })),
    ];
    return cols;
  }, [periodColumns]);
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
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

  const showGroupMenu = (groupId && group) || onOpenSettings;
  return (
    <div className={`border border-border rounded-lg overflow-visible bg-card flex flex-col ${isCollapsed ? 'min-h-0 shrink-0' : 'min-h-[72px]'} ${className}`}>
      <div className={`flex items-center justify-between gap-2 p-4 shrink-0 ${isCollapsed ? 'bg-muted/20' : 'border-b border-border bg-muted/20'}`}>
        <h2 className="text-lg font-semibold text-foreground truncate">{title}{isCollapsed && <span className="text-muted-foreground font-normal ml-2">({data.length} measurables)</span>}</h2>
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <button
              ref={newMeasurableBtnRef}
              type="button"
              onClick={onNewMeasurableToggle}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium cursor-pointer"
            >
              New Measurable <ChevronDown className="w-4 h-4" />
            </button>
            {newMeasurableOpen && dropdownPosition != null && typeof document !== 'undefined' &&
              createPortal(
                <>
                  <div
                    className="fixed z-[100] py-1 bg-card border border-border rounded-md shadow-lg min-w-[200px]"
                    style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                  >
                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer" onClick={() => { onNewMeasurableToggle(); onCreateNew(); }}><Plus className="w-4 h-4" /> Create new Measurable</button>
                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer" onClick={() => { onNewMeasurableToggle(); onAddExisting(); }}><Plus className="w-4 h-4" /> Add existing Measurable</button>
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
                    {groupId && group ? (
                      <>
                        <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer" onClick={() => { setGroupMenuOpen(false); onEditGroup?.(group); }}>Edit group details</button>
                        {onDeleteGroup && (
                          <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive" onClick={() => { setGroupMenuOpen(false); onDeleteGroup(group.id); }}>
                            <Trash2 className="w-4 h-4" /> Delete group
                          </button>
                        )}
                      </>
                    ) : (
                      <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2 cursor-pointer" onClick={() => { setGroupMenuOpen(false); onOpenSettings?.(); }}>
                        <Settings className="w-4 h-4" /> Scorecard settings
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
      <div className="overflow-auto flex-1 min-h-0" dir={displayDirection}>
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className={`text-left font-medium text-foreground border-b border-border px-3 py-2 whitespace-nowrap bg-muted/30 ${h.index === 0 ? 'sticky left-0 z-20 bg-muted shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: h.getSize(), minWidth: h.getSize() }}>
                    {typeof h.column.columnDef.header === 'function' ? flexRender(h.column.columnDef.header, h.getContext()) : h.column.columnDef.header}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr><td colSpan={table.getAllColumns().length} className="px-3 py-8 text-center text-muted-foreground border-b border-border">No data to show</td></tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-border hover:bg-muted/20">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={`px-3 py-2 text-foreground whitespace-nowrap ${cell.column.id === 'select' ? 'sticky left-0 z-10 bg-card border-r border-border' : ''}`} style={{ width: cell.column.getSize(), minWidth: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

interface InstrumentsSegmentViewProps {
  teamName?: string;
  embedded?: boolean;
  meetingId?: string;
  organizationId?: string;
  isFacilitator?: boolean;
}

export function InstrumentsSegmentView({
  teamName = 'Leadership Team',
  embedded = false,
  meetingId,
  organizationId,
  isFacilitator = true,
}: InstrumentsSegmentViewProps) {
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
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [addExistingModalOpen, setAddExistingModalOpen] = useState(false);
  const [createMeasurableOpen, setCreateMeasurableOpen] = useState(false);
  const [deleteConfirmGroupId, setDeleteConfirmGroupId] = useState<string | null>(null);
  const [deleteGroupLoading, setDeleteGroupLoading] = useState(false);
  const moreMenuBtnRef = useRef<HTMLButtonElement>(null);

  const handleDeleteGroup = async (groupId: string) => {
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
    showGoalColumn: false,
    showAverageColumn: false,
    showTotalColumn: false,
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
  const [addExistingPersonOpen, setAddExistingPersonOpen] = useState(false);
  const [addExistingPersonSearch, setAddExistingPersonSearch] = useState('');
  const MOCK_PERSONS = ['Unassigned', 'Gulraiz Saeed'];
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
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [createGroupSaving, setCreateGroupSaving] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());

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

  const useApiGroups = Boolean(meetingId && organizationId);

  const fetchScorecardGroups = useCallback(async () => {
    if (!organizationId || !meetingId) return;
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
    }
  }, [meetingId, organizationId]);

  useEffect(() => {
    if (!useApiGroups) return;
    fetchScorecardGroups();
  }, [useApiGroups, fetchScorecardGroups]);
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

  const timeframeLabel = timeframe === 'weekly' ? 'Weekly' : timeframe === 'monthly' ? 'Monthly' : timeframe === 'quarterly' ? 'Quarterly' : 'Annual';
  const currentGroups = groupsByTimeframe[timeframe] || [];

  return (
    <div className={`flex flex-col min-h-0 h-full ${wrap}`}>
      {/* Details header: tabs + filters — full width like main header */}
      <div className="-mx-6 px-4 border-t border-b border-border bg-muted/30 shrink-0">
        <div className="flex gap-0 border-b border-border mb-0 shrink-0">
          {(['weekly', 'monthly', 'quarterly', 'annual'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                if (!isFacilitator) return;
                setTimeframe(tab);
                if (meetingId && socket) socket.emit('scorecard_filter', { meetingId, timeframe: tab });
              }}
              disabled={!isFacilitator}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors rounded-t-md ${timeframe === tab ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'} ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 py-3 shrink-0">
          <div className="relative">
            <select defaultValue={teamName} className="pl-3 pr-8 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer">
              <option>Leadership Team</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <span className="text-muted-foreground text-sm">View by:</span>
          <div className="relative">
            <select
              value={viewBy}
              onChange={(e) => {
                if (!isFacilitator) return;
                const v = e.target.value as ViewBy;
                setViewBy(v);
                if (meetingId && socket) socket.emit('scorecard_filter', { meetingId, viewBy: v });
              }}
              disabled={!isFacilitator}
              className={`pl-3 pr-8 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none min-w-[100px] ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
            >
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <span className="text-muted-foreground text-sm">Date Range:</span>
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => {
                if (!isFacilitator) return;
                const v = e.target.value as DateRangeKey;
                setDateRange(v);
                if (meetingId && socket) socket.emit('scorecard_filter', { meetingId, dateRange: v });
              }}
              disabled={!isFacilitator}
              className={`pl-3 pr-8 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[180px] appearance-none ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
            >
              {DATE_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          {/* LTR / RTL display toggle — immediately after date range */}
          <div className="flex rounded-lg border border-border overflow-hidden bg-muted/30">
            <button
              type="button"
              onClick={() => {
                if (!isFacilitator) return;
                setDisplayDirection('rtl');
                if (meetingId && socket) socket.emit('scorecard_filter', { meetingId, displayDirection: 'rtl' });
              }}
              disabled={!isFacilitator}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${displayDirection === 'rtl' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'} ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
              title="Right to left"
            >
              <BarChart2 className="w-4 h-4" />
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isFacilitator) return;
                setDisplayDirection('ltr');
                if (meetingId && socket) socket.emit('scorecard_filter', { meetingId, displayDirection: 'ltr' });
              }}
              disabled={!isFacilitator}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${displayDirection === 'ltr' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'} ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
              title="Left to right"
            >
              <BarChart2 className="w-4 h-4" />
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-3 shrink-0">
          <button type="button" className="p-2 rounded-md border border-border hover:bg-accent text-muted-foreground hover:text-foreground" title="Undo score change"><RotateCcw className="w-4 h-4" /></button>
          <button type="button" className="p-2 rounded-md border border-border hover:bg-accent text-muted-foreground hover:text-foreground" title="Redo score change"><RotateCw className="w-4 h-4" /></button>
          <button type="button" onClick={() => isFacilitator && setCreateGroupOpen(true)} disabled={!isFacilitator} className={`flex items-center gap-2 px-3 py-2 border border-border rounded-md text-sm font-medium text-primary ${!isFacilitator ? 'cursor-not-allowed opacity-70' : 'hover:bg-accent cursor-pointer'}`}><Plus className="w-4 h-4" /> New group</button>
          <button type="button" className="px-3 py-2 border border-border rounded-md hover:bg-accent text-sm font-medium text-primary">Go to Measurable Manager</button>
          {isFacilitator && (
            <div className="relative">
              <button
                ref={moreMenuBtnRef}
                type="button"
                onClick={() => setMoreMenuOpen((o) => !o)}
                className="p-2 rounded-md border border-border hover:bg-accent hover:text-foreground text-muted-foreground transition-colors cursor-pointer"
                title="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {moreMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMoreMenuOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full mt-1 py-2 bg-card border border-border rounded-lg shadow-xl z-20 min-w-[200px]">
                    <button type="button" className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 flex items-center gap-3 cursor-pointer" onClick={() => { setMoreMenuOpen(false); setSettingsPanelOpen(true); }}>
                      <Settings className="w-4 h-4 text-muted-foreground" /> Settings
                    </button>
                    <div className="border-t border-border my-1" />
                    <button type="button" className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 flex items-center gap-3" onClick={() => { setMoreMenuOpen(false); }}>
                      <Download className="w-4 h-4 text-muted-foreground" /> Export as CSV
                    </button>
                    <button type="button" className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 flex items-center gap-3" onClick={() => { setMoreMenuOpen(false); }}>
                      <FileText className="w-4 h-4 text-muted-foreground" /> Print PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="search" placeholder="Search KPIs..." value={searchKpis} onChange={(e) => setSearchKpis(e.target.value)} className="w-full min-w-[180px] max-w-xs pl-9 pr-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
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
                {timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Scorecard Scorecard Settings
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
                { key: 'showStatusIndicators' as const, label: 'Show Measurable status indicators', desc: 'Display icon status indicators with colors based on each Measurable\'s target. Green: On-track. Orange: At-risk. Red: Off-track.' },
                { key: 'showOwnerColumn' as const, label: 'Show Owner column', desc: 'Display the owner of the Measurable.' },
                { key: 'showGoalColumn' as const, label: 'Show Goal column', desc: 'Display Measurable Goals.' },
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
              <h3 className="text-lg font-semibold text-foreground mb-2">Delete group?</h3>
              <p className="text-sm text-muted-foreground mb-4">This action cannot be undone. The group and its measurables will be removed from this scorecard.</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => !deleteGroupLoading && setDeleteConfirmGroupId(null)}
                  disabled={deleteGroupLoading}
                  className="px-4 py-2 border border-border rounded-md hover:bg-muted text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteGroup(deleteConfirmGroupId)}
                  disabled={deleteGroupLoading}
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  {deleteGroupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create group — right-side panel */}
      {createGroupOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setCreateGroupOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border shadow-xl z-50 flex flex-col">
            <header className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h3 className="text-lg font-semibold text-foreground">{editGroupId ? 'Edit group' : 'Create group'}</h3>
              <button
                type="button"
                onClick={() => setCreateGroupOpen(false)}
                className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
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
            <footer className="flex items-center gap-2 p-4 border-t border-border shrink-0">
              <button
                type="button"
                onClick={async () => {
                  if (!createGroupName.trim()) return;
                  setCreateGroupSaving(true);
                  try {
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
                    setCreateGroupOpen(false);
                    setCreateGroupName('');
                    setCreateGroupDescription('');
                  } catch (e) {
                    console.error('Failed to save group', e);
                  } finally {
                    setCreateGroupSaving(false);
                  }
                }}
                disabled={createGroupSaving}
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
                }}
                className="px-4 py-2 border border-border bg-background text-foreground rounded-md hover:bg-muted text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
            </footer>
          </div>
        </>
      )}

      {/* Add existing measurable — modal */}
      {addExistingModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setAddExistingModalOpen(false)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[80vh] bg-card border border-border rounded-lg shadow-xl z-50 flex flex-col">
            <header className="p-4 border-b border-border shrink-0">
              <h3 className="text-lg font-semibold text-foreground">{timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Measurables</h3>
              <p className="text-sm text-muted-foreground mt-0.5">All the {timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Measurables in your company</p>
            </header>
            <div className="p-4 border-b border-border shrink-0 flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="search" placeholder="Search measurables..." value={addExistingSearch} onChange={(e) => setAddExistingSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="relative w-auto max-w-[220px]">
                <button type="button" onClick={() => setAddExistingPersonOpen((o) => !o)} className="flex items-center gap-2 w-full min-w-[140px] px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm text-left hover:bg-muted/50 cursor-pointer">
                  <span className="text-muted-foreground shrink-0">Person:</span>
                  <span className="truncate">{addExistingPersonFilter}</span>
                  <ChevronDown className={`w-4 h-4 ml-auto shrink-0 transition-transform ${addExistingPersonOpen ? 'rotate-180' : ''}`} />
                </button>
                {addExistingPersonOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAddExistingPersonOpen(false)} aria-hidden />
                    <div className="absolute left-0 right-0 top-full mt-1 py-2 bg-card border border-border rounded-md shadow-lg z-20">
                      <div className="relative px-2 pb-2">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input type="search" placeholder="Search..." value={addExistingPersonSearch} onChange={(e) => setAddExistingPersonSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-border rounded-md text-sm" />
                      </div>
                      {['All', 'Unassigned', ...MOCK_PERSONS.filter((p) => p !== 'Unassigned')]
                        .filter((opt) => opt.toLowerCase().includes(addExistingPersonSearch.toLowerCase()))
                        .map((opt) => (
                        <button key={opt} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 cursor-pointer" onClick={() => { setAddExistingPersonFilter(opt); setAddExistingPersonOpen(false); setAddExistingPersonSearch(''); }}>{opt}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
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

      {/* Create measurable — right-side panel */}
      {createMeasurableOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setCreateMeasurableCloseConfirmOpen(true)} aria-hidden />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border shadow-xl z-50 flex flex-col">
            <header className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-muted/20">
              <h3 className="text-lg font-semibold text-foreground">Create Measurable</h3>
              <button type="button" onClick={() => setCreateMeasurableCloseConfirmOpen(true)} className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors" aria-label="Close"><X className="w-5 h-5" /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <section>
                <label className="block text-sm font-medium text-foreground mb-2">Title</label>
                <input type="text" value={createMeasurableTitle} onChange={(e) => setCreateMeasurableTitle(e.target.value)} placeholder="Title" className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow" />
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
                <label className="block text-sm font-medium text-foreground mb-2">Period Interval</label>
                <select className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option>Weekly</option>
                  <option>Monthly</option>
                  <option>Quarterly</option>
                </select>
              </section>
              <section>
                <label className="block text-sm font-medium text-foreground mb-2">Owner</label>
                <select className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option>Owner</option>
                  {MOCK_PERSONS.map((p) => (p !== 'Unassigned' ? <option key={p}>{p}</option> : <option key={p}>Unassigned</option>))}
                </select>
              </section>

              <hr className="border-border" />

              <section>
                <p className="text-sm font-medium text-foreground mb-3">Columns</p>
                <div className="space-y-4">
                  {[
                    { key: 'showTotal' as const, label: 'Show Total', desc: 'This column shows the sum total of all the data points in this row.' },
                    { key: 'showAverage' as const, label: 'Show Average', desc: 'This column shows the average of all the data points in this row.' },
                    { key: 'showGoal' as const, label: 'Show Goal', desc: 'This column shows the intended goal of this measurable.' },
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
                  <h4 className="text-sm font-medium text-foreground">Goal</h4>
                  <button type="button" className="p-0.5 rounded-full hover:bg-muted text-muted-foreground" aria-label="Info"><Info className="w-4 h-4" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Unit</label>
                    <select value={createMeasurableUnit} onChange={(e) => setCreateMeasurableUnit(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option>Number</option>
                      <option>Percentage</option>
                      <option>Currency</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Orientation rule</label>
                    <select value={createMeasurableOrientation} onChange={(e) => setCreateMeasurableOrientation(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option>Greater than or equal to goal</option>
                      <option>Less than or equal to goal</option>
                      <option>Equal to goal</option>
                    </select>
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
                    <select value={createMeasurableRollup} onChange={(e) => setCreateMeasurableRollup(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option>Total (default)</option>
                      <option>Average</option>
                      <option>Min</option>
                      <option>Max</option>
                    </select>
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
              <button type="button" onClick={() => { if (createMeasurableTitle.trim()) { setMeasurables((prev) => [...prev, { id: `m-${Date.now()}`, title: createMeasurableTitle.trim(), goal: '>= 0', average: '0', total: '0', trend: 'down', periodValues: {} }]); setCreateMeasurableOpen(false); setCreateMeasurableTitle(''); setCreateMeasurableDescription(''); } }} className="px-4 py-2.5 bg-primary text-primary-foreground border border-primary rounded-lg hover:bg-primary/90 text-sm font-medium cursor-pointer shadow-sm transition-colors">Save</button>
              <button type="button" onClick={() => setCreateMeasurableCloseConfirmOpen(true)} className="px-4 py-2.5 border border-border bg-background text-foreground rounded-lg hover:bg-muted text-sm font-medium cursor-pointer transition-colors">Cancel</button>
            </footer>
          </div>
        </>
      )}

      {/* Create measurable — close confirmation */}
      {createMeasurableCloseConfirmOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[60]" onClick={() => setCreateMeasurableCloseConfirmOpen(false)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl z-[61] p-5">
            <p className="text-sm font-medium text-foreground mb-4">Are you sure you want to close? Your changes won&apos;t be saved.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreateMeasurableCloseConfirmOpen(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm font-medium cursor-pointer">Stay</button>
              <button type="button" onClick={() => { setCreateMeasurableCloseConfirmOpen(false); setCreateMeasurableOpen(false); setCreateMeasurableTitle(''); setCreateMeasurableDescription(''); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium cursor-pointer">Close</button>
            </div>
          </div>
        </>
      )}

      {/* Content: padding after filter bar — fixed header above, only this area scrolls when expanded */}
      <div className={`flex-1 flex flex-col min-h-0 mt-4 ${contentPad} gap-4 overflow-hidden`}>
        {expandedGroupId ? (
          <>
            {/* Expanded card: 80% of content area; rest of cards below in scroll */}
            {expandedGroupId === 'main' ? (
              <ScorecardTableCard
                key="main"
                title={`${timeframeLabel} KPIs ${measurables.length}`}
                data={measurables}
                periodColumns={periodColumns}
                displayDirection={displayDirection}
                newMeasurableOpen={newMeasurableOpenGroupId === 'main'}
                onNewMeasurableToggle={() => setNewMeasurableOpenGroupId((id) => (id === 'main' ? null : 'main'))}
                onCreateNew={() => setCreateMeasurableOpen(true)}
                onAddExisting={() => setAddExistingModalOpen(true)}
                className="flex-[0_0_80%] min-h-0 shrink-0"
                onOpenSettings={() => setSettingsPanelOpen(true)}
                isExpanded={true}
                onExpand={() => setExpandedGroupId(null)}
                isCollapsed={collapsedGroupIds.has('main')}
                onCollapse={() => setCollapsedGroupIds((s) => { const n = new Set(s); if (n.has('main')) n.delete('main'); else n.add('main'); return n; })}
              />
            ) : currentGroups.find((g) => g.id === expandedGroupId) ? (
              <ScorecardTableCard
                key={expandedGroupId}
                title={currentGroups.find((g) => g.id === expandedGroupId)!.name}
                data={[]}
                periodColumns={periodColumns}
                displayDirection={displayDirection}
                newMeasurableOpen={newMeasurableOpenGroupId === expandedGroupId}
                onNewMeasurableToggle={() => setNewMeasurableOpenGroupId((id) => (id === expandedGroupId ? null : expandedGroupId))}
                onCreateNew={() => setCreateMeasurableOpen(true)}
                onAddExisting={() => setAddExistingModalOpen(true)}
                className="flex-[0_0_80%] min-h-0 shrink-0"
                groupId={expandedGroupId}
                group={currentGroups.find((g) => g.id === expandedGroupId)!}
                onEditGroup={(gr) => { setCreateGroupName(gr.name); setCreateGroupDescription(gr.description || ''); setEditGroupId(gr.id); setCreateGroupOpen(true); }}
                onDeleteGroup={isFacilitator ? (id) => setDeleteConfirmGroupId(id) : undefined}
                isExpanded={true}
                onExpand={() => setExpandedGroupId(null)}
                isCollapsed={collapsedGroupIds.has(expandedGroupId)}
                onCollapse={() => setCollapsedGroupIds((s) => { const n = new Set(s); if (n.has(expandedGroupId)) n.delete(expandedGroupId); else n.add(expandedGroupId); return n; })}
              />
            ) : null}
            <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-4">
              {expandedGroupId === 'main' ? (
                currentGroups.map((g) => (
                  <ScorecardTableCard
                    key={g.id}
                    title={g.name}
                    data={[]}
                    periodColumns={periodColumns}
                    displayDirection={displayDirection}
                    newMeasurableOpen={newMeasurableOpenGroupId === g.id}
                    onNewMeasurableToggle={() => setNewMeasurableOpenGroupId((id) => (id === g.id ? null : g.id))}
                    onCreateNew={() => setCreateMeasurableOpen(true)}
                    onAddExisting={() => setAddExistingModalOpen(true)}
                    className={collapsedGroupIds.has(g.id) ? 'shrink-0' : 'min-h-[200px] shrink-0'}
                    groupId={g.id}
                    group={g}
                    onEditGroup={(gr) => { setCreateGroupName(gr.name); setCreateGroupDescription(gr.description || ''); setEditGroupId(gr.id); setCreateGroupOpen(true); }}
                    onDeleteGroup={isFacilitator ? (id) => setDeleteConfirmGroupId(id) : undefined}
                    isExpanded={false}
                    onExpand={() => setExpandedGroupId(g.id)}
                    isCollapsed={collapsedGroupIds.has(g.id)}
                    onCollapse={() => setCollapsedGroupIds((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}
                  />
                ))
              ) : (
                <>
                  <ScorecardTableCard
                    title={`${timeframeLabel} KPIs ${measurables.length}`}
                    data={measurables}
                    periodColumns={periodColumns}
                    displayDirection={displayDirection}
                    newMeasurableOpen={newMeasurableOpenGroupId === 'main'}
                    onNewMeasurableToggle={() => setNewMeasurableOpenGroupId((id) => (id === 'main' ? null : 'main'))}
                    onCreateNew={() => setCreateMeasurableOpen(true)}
                    onAddExisting={() => setAddExistingModalOpen(true)}
                    className={collapsedGroupIds.has('main') ? 'shrink-0' : 'min-h-[200px] shrink-0'}
                    onOpenSettings={() => setSettingsPanelOpen(true)}
                    isExpanded={false}
                    onExpand={() => setExpandedGroupId('main')}
                    isCollapsed={collapsedGroupIds.has('main')}
                    onCollapse={() => setCollapsedGroupIds((s) => { const n = new Set(s); if (n.has('main')) n.delete('main'); else n.add('main'); return n; })}
                  />
                  {currentGroups.filter((g) => g.id !== expandedGroupId).map((g) => (
                    <ScorecardTableCard
                      key={g.id}
                      title={g.name}
                      data={[]}
                      periodColumns={periodColumns}
                      displayDirection={displayDirection}
                      newMeasurableOpen={newMeasurableOpenGroupId === g.id}
                      onNewMeasurableToggle={() => setNewMeasurableOpenGroupId((id) => (id === g.id ? null : g.id))}
                      onCreateNew={() => setCreateMeasurableOpen(true)}
                      onAddExisting={() => setAddExistingModalOpen(true)}
                      className={collapsedGroupIds.has(g.id) ? 'shrink-0' : 'min-h-[200px] shrink-0'}
                      groupId={g.id}
                      group={g}
                      onEditGroup={(gr) => { setCreateGroupName(gr.name); setCreateGroupDescription(gr.description || ''); setEditGroupId(gr.id); setCreateGroupOpen(true); }}
                      onDeleteGroup={isFacilitator ? (id) => setDeleteConfirmGroupId(id) : undefined}
                      isExpanded={false}
                      onExpand={() => setExpandedGroupId(g.id)}
                      isCollapsed={collapsedGroupIds.has(g.id)}
                      onCollapse={() => setCollapsedGroupIds((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}
                    />
                  ))}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto gap-4">
            <ScorecardTableCard
              title={`${timeframeLabel} KPIs ${measurables.length}`}
              data={measurables}
              periodColumns={periodColumns}
              displayDirection={displayDirection}
              newMeasurableOpen={newMeasurableOpenGroupId === 'main'}
              onNewMeasurableToggle={() => setNewMeasurableOpenGroupId((id) => (id === 'main' ? null : 'main'))}
              onCreateNew={() => setCreateMeasurableOpen(true)}
              onAddExisting={() => setAddExistingModalOpen(true)}
              className="min-h-0 flex-1 shrink-0"
              onOpenSettings={() => setSettingsPanelOpen(true)}
              isExpanded={false}
              onExpand={() => setExpandedGroupId('main')}
              isCollapsed={collapsedGroupIds.has('main')}
              onCollapse={() => setCollapsedGroupIds((s) => { const n = new Set(s); if (n.has('main')) n.delete('main'); else n.add('main'); return n; })}
            />
            {currentGroups.map((g) => (
              <ScorecardTableCard
                key={g.id}
                title={g.name}
                data={[]}
                periodColumns={periodColumns}
                displayDirection={displayDirection}
                newMeasurableOpen={newMeasurableOpenGroupId === g.id}
                onNewMeasurableToggle={() => setNewMeasurableOpenGroupId((id) => (id === g.id ? null : g.id))}
                onCreateNew={() => setCreateMeasurableOpen(true)}
                onAddExisting={() => setAddExistingModalOpen(true)}
                className={collapsedGroupIds.has(g.id) ? 'shrink-0' : 'min-h-[240px] shrink-0'}
                groupId={g.id}
                group={g}
                onEditGroup={(gr) => { setCreateGroupName(gr.name); setCreateGroupDescription(gr.description || ''); setEditGroupId(gr.id); setCreateGroupOpen(true); }}
                onDeleteGroup={isFacilitator ? (id) => setDeleteConfirmGroupId(id) : undefined}
                isExpanded={false}
                onExpand={() => setExpandedGroupId(g.id)}
                isCollapsed={collapsedGroupIds.has(g.id)}
                onCollapse={() => setCollapsedGroupIds((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
