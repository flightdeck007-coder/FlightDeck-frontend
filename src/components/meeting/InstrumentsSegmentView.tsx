'use client';

import { useState, useMemo } from 'react';
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
  Filter,
  Upload,
  Minus,
  Maximize2,
  ChevronUp,
  User,
} from 'lucide-react';

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

interface InstrumentsSegmentViewProps {
  teamName?: string;
  embedded?: boolean;
}

export function InstrumentsSegmentView({
  teamName = 'Leadership Team',
  embedded = false,
}: InstrumentsSegmentViewProps) {
  const [timeframe, setTimeframe] = useState<TimeframeTab>('weekly');
  const [viewBy, setViewBy] = useState<ViewBy>('week');
  const [dateRange, setDateRange] = useState<DateRangeKey>('last13weeks');
  const [searchKpis, setSearchKpis] = useState('');
  const [newMeasurableOpen, setNewMeasurableOpen] = useState(false);

  const periodColumns = useMemo(() => {
    if (timeframe === 'weekly') return getWeekRangeLabels(13);
    if (timeframe === 'monthly') return getMonthLabels(13);
    return getWeekRangeLabels(4);
  }, [timeframe]);

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
      ...periodColumns.map((label) => ({
        id: label,
        header: () => <span className="font-medium text-foreground text-xs whitespace-nowrap">{label}</span>,
        cell: ({ row }: { row: { original: MeasurableRow } }) => row.original.periodValues[label] ?? '—',
        size: 100,
      })),
    ];
    return cols;
  }, [periodColumns]);

  const table = useReactTable({ data: MOCK_MEASURABLES, columns, getCoreRowModel: getCoreRowModel() });
  const wrap = embedded ? 'p-4' : 'p-6';

  return (
    <div className={`flex flex-col min-h-0 h-full ${wrap}`}>
      <div className="flex gap-0 border-b border-border mb-4 shrink-0">
        {(['weekly', 'monthly', 'quarterly', 'annual'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setTimeframe(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors rounded-t-md ${timeframe === tab ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-3 shrink-0">
        <div>
          <select defaultValue={teamName} className="pl-3 pr-8 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer">
            <option>Leadership Team</option>
          </select>
        </div>
        <span className="text-muted-foreground text-sm">View by:</span>
        <select value={viewBy} onChange={(e) => setViewBy(e.target.value as ViewBy)} className="pl-3 pr-8 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer">
          <option value="week">Week</option>
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
          <option value="year">Year</option>
        </select>
        <span className="text-muted-foreground text-sm">Date Range:</span>
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangeKey)} className="pl-3 pr-8 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[180px] appearance-none cursor-pointer">
          {DATE_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="button" className="p-2 rounded-md border border-border hover:bg-accent text-muted-foreground"><Filter className="w-4 h-4" /></button>
        <button type="button" className="p-2 rounded-md border border-border hover:bg-accent text-muted-foreground"><Upload className="w-4 h-4" /></button>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4 shrink-0">
        <button type="button" className="p-2 rounded-md border border-border hover:bg-accent text-muted-foreground"><RotateCcw className="w-4 h-4" /></button>
        <button type="button" className="p-2 rounded-md border border-border hover:bg-accent text-muted-foreground"><RotateCw className="w-4 h-4" /></button>
        <button type="button" className="flex items-center gap-2 px-3 py-2 border border-border rounded-md hover:bg-accent text-sm font-medium text-primary"><Plus className="w-4 h-4" /> New group</button>
        <button type="button" className="px-3 py-2 border border-border rounded-md hover:bg-accent text-sm font-medium text-primary">Go to Measurable Manager</button>
        <button type="button" className="p-2 rounded-md border border-border hover:bg-accent text-muted-foreground"><MoreHorizontal className="w-4 h-4" /></button>
        <div className="flex-1 min-w-[200px] flex justify-end">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="search" placeholder="Search KPIs..." value={searchKpis} onChange={(e) => setSearchKpis(e.target.value)} className="w-full max-w-xs pl-9 pr-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
      </div>
      <div className="border border-border rounded-lg overflow-hidden bg-card flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between gap-2 p-4 border-b border-border bg-muted/20 shrink-0">
          <h2 className="text-lg font-semibold text-foreground">
            {timeframe === 'weekly' && 'Weekly'}{timeframe === 'monthly' && 'Monthly'}{timeframe === 'quarterly' && 'Quarterly'}{timeframe === 'annual' && 'Annual'} KPIs {MOCK_MEASURABLES.length}
          </h2>
          <div className="flex items-center gap-1">
            <div className="relative">
              <button type="button" onClick={() => setNewMeasurableOpen((o) => !o)} className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium">
                New Measurable <ChevronDown className="w-4 h-4" />
              </button>
              {newMeasurableOpen && (
                <>
                  <div className="absolute right-0 top-full mt-1 py-1 bg-card border border-border rounded-md shadow-lg z-20 min-w-[200px]">
                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" onClick={() => setNewMeasurableOpen(false)}><Plus className="w-4 h-4" /> Create new Measurable</button>
                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2" onClick={() => setNewMeasurableOpen(false)}><Plus className="w-4 h-4" /> Add existing Measurable</button>
                  </div>
                  <div className="fixed inset-0 z-10" onClick={() => setNewMeasurableOpen(false)} aria-hidden />
                </>
              )}
            </div>
            <button type="button" className="p-2 rounded hover:bg-accent text-muted-foreground"><MoreHorizontal className="w-4 h-4" /></button>
            <button type="button" className="p-2 rounded hover:bg-accent text-muted-foreground"><Maximize2 className="w-4 h-4" /></button>
            <button type="button" className="p-2 rounded hover:bg-accent text-muted-foreground"><ChevronUp className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="overflow-auto flex-1 min-h-0">
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
      </div>
    </div>
  );
}
