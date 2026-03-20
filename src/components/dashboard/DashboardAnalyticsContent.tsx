'use client';

import { useEffect, useMemo, useState } from 'react';
import { Select } from 'antd';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Table2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useMeetingsData } from '@/hooks/useMeetingsData';
import { todosService, type TodoApiItem } from '@/lib/api/todos.service';
import { issuesService, type IssueApiItem } from '@/lib/api/issues.service';
import { meetingsService } from '@/lib/api/meetings.service';

type RockLite = { achieved: boolean };
type Granularity = 'daily' | 'weekly' | 'monthly' | 'yearly';
type SourceLoading = { todos: boolean; issues: boolean; rocks: boolean };
type SourceError = { todos: boolean; issues: boolean; rocks: boolean };
type BucketRow = {
  key: string;
  label: string;
  todosCreated: number;
  todosCompleted: number;
  issuesCreated: number;
  issuesResolved: number;
  rocksLogged: number;
  meetingsConducted: number;
};

const CHART_COLORS = ['#4F46E5', '#06B6D4', '#22C55E', '#F59E0B', '#EF4444'];

function safeDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday as week start
  const base = new Date(d);
  base.setDate(base.getDate() - diff);
  return startOfDay(base);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function addBuckets(d: Date, granularity: Granularity, delta: number): Date {
  if (granularity === 'daily') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
  if (granularity === 'weekly') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta * 7);
  if (granularity === 'monthly') return new Date(d.getFullYear(), d.getMonth() + delta, 1);
  return new Date(d.getFullYear() + delta, 0, 1);
}

function bucketStart(d: Date, granularity: Granularity): Date {
  if (granularity === 'daily') return startOfDay(d);
  if (granularity === 'weekly') return startOfWeek(d);
  if (granularity === 'monthly') return startOfMonth(d);
  return startOfYear(d);
}

function bucketKey(d: Date, granularity: Granularity): string {
  const b = bucketStart(d, granularity);
  const y = b.getFullYear();
  const m = String(b.getMonth() + 1).padStart(2, '0');
  const day = String(b.getDate()).padStart(2, '0');
  if (granularity === 'yearly') return `${y}`;
  return `${y}-${m}-${day}`;
}

function bucketLabel(key: string, granularity: Granularity): string {
  if (granularity === 'yearly') return key;
  const [yy, mm, dd] = key.split('-').map(Number);
  const d = new Date(yy, (mm ?? 1) - 1, dd ?? 1);
  if (granularity === 'monthly') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  if (granularity === 'weekly') return `Wk ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function bucketCount(granularity: Granularity): number {
  if (granularity === 'daily') return 14;
  if (granularity === 'weekly') return 12;
  if (granularity === 'monthly') return 12;
  return 5;
}

function recentBucketKeys(granularity: Granularity): string[] {
  const count = bucketCount(granularity);
  const now = bucketStart(new Date(), granularity);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    out.push(bucketKey(addBuckets(now, granularity, -i), granularity));
  }
  return out;
}

function useAnimatedNumber(value: number, durationMs = 900): number {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = display;
    const delta = value - from;
    const tick = (t: number) => {
      const p = Math.min((t - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + delta * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return display;
}

async function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function KpiCard({
  label,
  value,
  icon,
  accentClass,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accentClass: string;
}) {
  const animated = useAnimatedNumber(value);
  return (
    <div className="relative overflow-hidden bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div className={`absolute inset-x-0 top-0 h-1 ${accentClass}`} />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium tracking-wide text-foreground/70 mb-2.5">{label}</p>
          <p className="text-3xl font-semibold text-foreground tabular-nums">{animated}</p>
        </div>
        <div className="w-11 h-11 rounded-xl bg-muted/60 border border-border flex items-center justify-center">{icon}</div>
      </div>
    </div>
  );
}

function downloadCsv(rows: BucketRow[], granularity: Granularity) {
  const header = [
    'bucket',
    'todos_created',
    'todos_completed',
    'issues_created',
    'issues_resolved',
    'rocks_logged',
    'meetings_conducted',
    'created_actions',
    'solved_actions',
    'net_actions',
  ];
  const lines = rows.map((r) => {
    const created = r.todosCreated + r.issuesCreated + r.rocksLogged;
    const solved = r.todosCompleted + r.issuesResolved;
    return [
      r.label,
      r.todosCreated,
      r.todosCompleted,
      r.issuesCreated,
      r.issuesResolved,
      r.rocksLogged,
      r.meetingsConducted,
      created,
      solved,
      solved - created,
    ].join(',');
  });
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flightdeck-analytics-${granularity}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DashboardAnalyticsContent() {
  const {
    organizationId,
    teams,
    selectedTeamId,
    setSelectedTeamId,
    selectedTeam,
    meetings,
    isLoading: baseLoading,
  } = useMeetingsData();

  const [todos, setTodos] = useState<TodoApiItem[]>([]);
  const [issues, setIssues] = useState<IssueApiItem[]>([]);
  const [rocks, setRocks] = useState<RockLite[]>([]);
  const [loading, setLoading] = useState<SourceLoading>({ todos: false, issues: false, rocks: false });
  const [errors, setErrors] = useState<SourceError>({ todos: false, issues: false, rocks: false });
  const [granularity, setGranularity] = useState<Granularity>('monthly');

  useEffect(() => {
    if (!organizationId || !selectedTeamId) {
      setTodos([]);
      setIssues([]);
      setRocks([]);
      setLoading({ todos: false, issues: false, rocks: false });
      setErrors({ todos: false, issues: false, rocks: false });
      return;
    }
    let active = true;
    setLoading({ todos: true, issues: true, rocks: true });
    setErrors({ todos: false, issues: false, rocks: false });

    withTimeout(todosService.findAll(organizationId, selectedTeamId, false))
      .then((todoList) => {
        if (!active) return;
        setTodos(todoList);
      })
      .catch(() => {
        if (!active) return;
        setTodos([]);
        setErrors((prev) => ({ ...prev, todos: true }));
      })
      .finally(() => {
        if (active) setLoading((prev) => ({ ...prev, todos: false }));
      });

    withTimeout(
      Promise.all([
        issuesService.findAll(organizationId, selectedTeamId, 'short_term', false),
        issuesService.findAll(organizationId, selectedTeamId, 'long_term', false),
      ]).then(([s, l]) => [...s, ...l]),
    )
      .then((issueList) => {
        if (!active) return;
        setIssues(issueList);
      })
      .catch(() => {
        if (!active) return;
        setIssues([]);
        setErrors((prev) => ({ ...prev, issues: true }));
      })
      .finally(() => {
        if (active) setLoading((prev) => ({ ...prev, issues: false }));
      });

    withTimeout(
      Promise.allSettled(
        meetings.map((m) => withTimeout(meetingsService.getRocks(organizationId, m.id), 10000)),
      ),
      20000,
    )
      .then((settled) => {
        if (!active) return;
        const anyFailed = settled.some((s) => s.status === 'rejected');
        const rockList = settled.reduce<RockLite[]>((acc, s) => {
          if (s.status === 'fulfilled') {
            acc.push(...s.value.map((r) => ({ achieved: r.achieved })));
          }
          return acc;
        }, []);
        setRocks(rockList);
        if (anyFailed) setErrors((prev) => ({ ...prev, rocks: true }));
      })
      .catch(() => {
        if (!active) return;
        setRocks([]);
        setErrors((prev) => ({ ...prev, rocks: true }));
      })
      .finally(() => {
        if (active) setLoading((prev) => ({ ...prev, rocks: false }));
      });

    return () => {
      active = false;
    };
  }, [organizationId, selectedTeamId, meetings]);

  const bucketRows = useMemo<BucketRow[]>(() => {
    const keys = recentBucketKeys(granularity);
    const map = new Map<string, BucketRow>(
      keys.map((k) => [
        k,
        {
          key: k,
          label: bucketLabel(k, granularity),
          todosCreated: 0,
          todosCompleted: 0,
          issuesCreated: 0,
          issuesResolved: 0,
          rocksLogged: 0,
          meetingsConducted: 0,
        },
      ]),
    );

    for (const t of todos) {
      const created = safeDate(t.createdAt);
      if (created) {
        const k = bucketKey(created, granularity);
        if (map.has(k)) map.get(k)!.todosCreated += 1;
      }
      const completed = safeDate(t.completedAt);
      if (completed) {
        const k = bucketKey(completed, granularity);
        if (map.has(k)) map.get(k)!.todosCompleted += 1;
      }
    }

    for (const i of issues) {
      const created = safeDate(i.createdAt);
      if (created) {
        const k = bucketKey(created, granularity);
        if (map.has(k)) map.get(k)!.issuesCreated += 1;
      }
      const resolved = safeDate(i.resolvedAt);
      if (resolved) {
        const k = bucketKey(resolved, granularity);
        if (map.has(k)) map.get(k)!.issuesResolved += 1;
      }
    }

    for (const m of meetings) {
      const conducted = safeDate(m.endedAt) ?? safeDate(m.startedAt) ?? safeDate(m.scheduledAt);
      if (!conducted) continue;
      const k = bucketKey(conducted, granularity);
      if (map.has(k)) map.get(k)!.meetingsConducted += 1;
    }

    const totalMeetingBuckets = Array.from(map.values()).reduce((acc, r) => acc + r.meetingsConducted, 0);
    if (totalMeetingBuckets > 0 && rocks.length > 0) {
      for (const row of map.values()) {
        row.rocksLogged = Math.round((row.meetingsConducted / totalMeetingBuckets) * rocks.length);
      }
    }
    return keys.map((k) => map.get(k)!);
  }, [todos, issues, meetings, rocks, granularity]);

  const totals = useMemo(() => {
    const todosDone = todos.filter((t) => t.status === 'done' || Boolean(t.completedAt)).length;
    const issuesResolved = issues.filter((i) => Boolean(i.resolvedAt)).length;
    const activeRocks = rocks.filter((r) => !r.achieved).length;
    const achievedRocks = rocks.filter((r) => r.achieved).length;
    const meetingsConducted = meetings.filter((m) => Boolean(m.startedAt) || Boolean(m.endedAt)).length;
    return { todosDone, issuesResolved, activeRocks, achievedRocks, meetingsConducted };
  }, [todos, issues, rocks, meetings]);

  const throughputData = useMemo(
    () =>
      bucketRows.map((r) => ({
        bucket: r.label,
        todos: r.todosCreated,
        issues: r.issuesCreated,
        meetings: r.meetingsConducted,
      })),
    [bucketRows],
  );

  const actionsTrendData = useMemo(
    () =>
      bucketRows.map((r) => ({
        bucket: r.label,
        created: r.todosCreated + r.issuesCreated + r.rocksLogged,
        solved: r.todosCompleted + r.issuesResolved,
      })),
    [bucketRows],
  );

  const statusDistribution = useMemo(
    () =>
      [
        { name: 'Todos Completed', value: totals.todosDone, color: CHART_COLORS[2] },
        { name: 'Open Todos', value: Math.max(todos.length - totals.todosDone, 0), color: CHART_COLORS[0] },
        { name: 'Issues Resolved', value: totals.issuesResolved, color: CHART_COLORS[1] },
        { name: 'Open Issues', value: Math.max(issues.length - totals.issuesResolved, 0), color: CHART_COLORS[4] },
        { name: 'Active Rocks', value: totals.activeRocks, color: CHART_COLORS[3] },
      ].filter((x) => x.value > 0),
    [totals, todos.length, issues.length],
  );

  const isBusy = baseLoading || loading.todos || loading.issues || loading.rocks;
  const hasSourceErrors = errors.todos || errors.issues || errors.rocks;

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Flight Deck Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Major activity metrics for todos, issues, rocks, and meeting throughput.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedTeamId || undefined}
            onChange={(v) => setSelectedTeamId(v ?? '')}
            options={teams.map((t) => ({ label: t.name, value: t.id }))}
            className="min-w-[220px]"
            placeholder="Select team"
          />
          <Select
            value={granularity}
            onChange={(v) => setGranularity(v)}
            options={[
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
              { label: 'Monthly', value: 'monthly' },
              { label: 'Yearly', value: 'yearly' },
            ]}
            className="min-w-[130px]"
          />
          <button
            type="button"
            onClick={() => downloadCsv(bucketRows, granularity)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-card hover:bg-muted text-sm"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>
      {hasSourceErrors && (
        <div className="mb-4 rounded-lg border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
          Some analytics sources failed to load. Available charts are shown with partial data.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Completed Clearances" value={totals.todosDone} icon={<CheckCircle2 className="w-6 h-6 text-emerald-600" />} accentClass="bg-emerald-500" />
        <KpiCard label="Open Turbulence" value={Math.max(issues.length - totals.issuesResolved, 0)} icon={<AlertCircle className="w-6 h-6 text-red-600" />} accentClass="bg-red-500" />
        <KpiCard label="Active Waypoints" value={totals.activeRocks} icon={<TrendingUp className="w-6 h-6 text-indigo-600" />} accentClass="bg-indigo-500" />
        <KpiCard label="Meetings Conducted" value={totals.meetingsConducted} icon={<CalendarDays className="w-6 h-6 text-cyan-600" />} accentClass="bg-cyan-500" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-6">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm xl:col-span-2">
          <h2 className="text-2xl font-bold text-foreground/85 mb-6 tracking-tight flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-primary/10 text-primary">
              <PieChartIcon className="w-5 h-5" />
            </span>
            Status Distribution
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4 items-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={90}
                  dataKey="value"
                  labelLine={false}
                >
                  {statusDistribution.map((entry, idx) => (
                    <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase mb-2">Color Legend</p>
              <div className="space-y-2">
                {statusDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-foreground truncate">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm xl:col-span-3">
          <h2 className="text-2xl font-bold text-foreground/85 mb-6 tracking-tight flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-primary/10 text-primary">
              <BarChart3 className="w-5 h-5" />
            </span>
            Throughput
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={throughputData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="bucket" interval={0} angle={-22} textAnchor="end" tickMargin={12} height={64} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="todos" fill={CHART_COLORS[0]} name="Todos Created" radius={[6, 6, 0, 0]} />
              <Bar dataKey="issues" fill={CHART_COLORS[3]} name="Issues Created" radius={[6, 6, 0, 0]} />
              <Bar dataKey="meetings" fill={CHART_COLORS[1]} name="Meetings" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm xl:col-span-2">
          <h2 className="text-2xl font-bold text-foreground/85 mb-6 tracking-tight flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-primary/10 text-primary">
              <LineChartIcon className="w-5 h-5" />
            </span>
            Created vs Solved Actions
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={actionsTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="bucket" interval={0} angle={-18} textAnchor="end" tickMargin={10} height={58} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="created" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={{ r: 3 }} name="Created" />
              <Line type="monotone" dataKey="solved" stroke={CHART_COLORS[2]} strokeWidth={2.5} dot={{ r: 3 }} name="Solved" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-foreground/85 mb-6 tracking-tight flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-primary/10 text-primary">
              <Activity className="w-5 h-5" />
            </span>
            Snapshot
          </h2>
          <div className="space-y-2">
            {[
              ['Team', selectedTeam?.name ?? '-'],
              ['Todos', `${todos.length}`],
              ['Issues', `${issues.length}`],
              ['Rocks', `${rocks.length}`],
              ['Achieved Rocks', `${totals.achievedRocks}`],
              ['Meetings', `${meetings.length}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 bg-muted/20">
                <span className="text-muted-foreground text-sm">{k}</span>
                <span className="font-semibold text-foreground text-lg tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-foreground/85 mb-6 tracking-tight flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-primary/10 text-primary">
            <Table2 className="w-5 h-5" />
          </span>
          Operations Detail ({granularity})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/25">
                <th className="px-3 py-2 text-left font-semibold text-foreground border border-border">Period</th>
                <th className="px-3 py-2 text-left font-semibold text-foreground border border-border">Todos C/D</th>
                <th className="px-3 py-2 text-left font-semibold text-foreground border border-border">Issues C/R</th>
                <th className="px-3 py-2 text-left font-semibold text-foreground border border-border">Rocks</th>
                <th className="px-3 py-2 text-left font-semibold text-foreground border border-border">Meetings</th>
                <th className="px-3 py-2 text-left font-semibold text-foreground border border-border">Created</th>
                <th className="px-3 py-2 text-left font-semibold text-foreground border border-border">Solved</th>
                <th className="px-3 py-2 text-left font-semibold text-foreground border border-border">Net</th>
              </tr>
            </thead>
            <tbody>
              {bucketRows.map((r) => {
                const created = r.todosCreated + r.issuesCreated + r.rocksLogged;
                const solved = r.todosCompleted + r.issuesResolved;
                const net = solved - created;
                return (
                  <tr key={r.key} className="odd:bg-muted/10 even:bg-accent/15">
                    <td className="px-3 py-2.5 font-semibold text-foreground border border-border">{r.label}</td>
                    <td className="px-3 py-2.5 border border-border text-base tabular-nums">{r.todosCreated}/{r.todosCompleted}</td>
                    <td className="px-3 py-2.5 border border-border text-base tabular-nums">{r.issuesCreated}/{r.issuesResolved}</td>
                    <td className="px-3 py-2.5 border border-border text-base tabular-nums">{r.rocksLogged}</td>
                    <td className="px-3 py-2.5 border border-border text-base tabular-nums">{r.meetingsConducted}</td>
                    <td className="px-3 py-2.5 border border-border font-semibold text-base tabular-nums">{created}</td>
                    <td className="px-3 py-2.5 border border-border font-semibold text-base tabular-nums">{solved}</td>
                    <td className={`px-3 py-2.5 border border-border font-semibold text-base tabular-nums ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {net >= 0 ? `+${net}` : net}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isBusy && (
        <div className="mt-4 text-sm text-muted-foreground inline-flex items-center gap-2">
          <Users className="w-4 h-4" /> Refreshing analytics...
        </div>
      )}
    </div>
  );
}

