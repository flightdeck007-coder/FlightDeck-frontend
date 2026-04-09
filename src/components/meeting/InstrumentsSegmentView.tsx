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
import { OwnerInitialsAvatar } from './OwnerInitialsAvatar';
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

/** Period cells are editable only when the main tab matches the View by grain. */
function tabMatchesView(timeframe: TimeframeTab, viewBy: ViewBy): boolean {
  return (
    (timeframe === 'weekly' && viewBy === 'week') ||
    (timeframe === 'monthly' && viewBy === 'month') ||
    (timeframe === 'quarterly' && viewBy === 'quarter') ||
    (timeframe === 'annual' && viewBy === 'year')
  );
}
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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfWeekSunday(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1, 0, 0, 0, 0);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return endOfDay(new Date(d.getFullYear(), q * 3 + 3, 0));
}

function endOfYear(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), 11, 31));
}

function formatWeekWindowLabel(sun: Date, sat: Date): string {
  const m1 = sun.toLocaleDateString('en-US', { month: 'short' });
  const d1 = sun.getDate();
  const m2 = sat.toLocaleDateString('en-US', { month: 'short' });
  const d2 = sat.getDate();
  return `${m1} ${d1} - ${m2} ${d2}`;
}

/** Weeks (Sun–Sat) that overlap [rangeStart, rangeEnd], oldest first. Labels match persisted `periodValues` keys. */
function enumerateWeekWindowsInRange(rangeStart: Date, rangeEnd: Date): { label: string; start: Date }[] {
  const rs = startOfDay(rangeStart);
  const re = startOfDay(rangeEnd);
  const out: { label: string; start: Date }[] = [];
  let sun = startOfWeekSunday(rs);
  while (sun <= re) {
    const sat = addDays(sun, 6);
    if (sat >= rs && sun <= re) {
      out.push({ label: formatWeekWindowLabel(sun, sat), start: new Date(sun) });
    }
    sun = addDays(sun, 7);
  }
  return out;
}

/** Last N Sunday weeks ending in the week that contains `ref`, oldest first (same shape as legacy 13-week grid). */
function getWeekRangeWindows(count: number, ref: Date = new Date()): { label: string; start: Date }[] {
  const endWeekSun = startOfWeekSunday(ref);
  const startWeekSun = addDays(endWeekSun, -(count - 1) * 7);
  return enumerateWeekWindowsInRange(startWeekSun, ref);
}

function getWeekRangeLabels(count: number, ref?: Date): string[] {
  return getWeekRangeWindows(count, ref ?? new Date()).map((w) => w.label);
}

function resolveScorecardDateHorizon(dateRange: DateRangeKey, ref: Date): { start: Date; end: Date } {
  const today = startOfDay(ref);
  switch (dateRange) {
    case 'last13weeks': {
      const endWeekSun = startOfWeekSunday(ref);
      const startWeekSun = addDays(endWeekSun, -12 * 7);
      return { start: startWeekSun, end: endOfDay(ref) };
    }
    case 'last13months': {
      const start = new Date(ref.getFullYear(), ref.getMonth() - 12, 1);
      return { start: startOfDay(start), end: endOfDay(ref) };
    }
    case 'qtd':
      return { start: startOfQuarter(ref), end: endOfDay(ref) };
    case 'ytd':
      return { start: startOfYear(ref), end: endOfDay(ref) };
    case 'current_quarter':
      return { start: startOfQuarter(ref), end: endOfQuarter(ref) };
    case 'current_year':
      return { start: startOfYear(ref), end: endOfYear(ref) };
    case 'custom':
    default:
      return resolveScorecardDateHorizon('last13weeks', ref);
  }
}

function monthNeedsYearSuffix(horizonStart: Date, horizonEnd: Date): boolean {
  return horizonStart.getFullYear() !== horizonEnd.getFullYear();
}

function formatMonthSlotLabel(y: number, m: number, withYear: boolean): string {
  const d = new Date(y, m, 1);
  const short = d.toLocaleDateString('en-US', { month: 'short' });
  if (!withYear) return short;
  return `${short} '${String(y).slice(-2)}`;
}

function enumerateMonthSlotsInRange(rangeStart: Date, rangeEnd: Date): { label: string; y: number; m: number }[] {
  const slots: { label: string; y: number; m: number }[] = [];
  const needYear = monthNeedsYearSuffix(rangeStart, rangeEnd);
  let y = rangeStart.getFullYear();
  let m = rangeStart.getMonth();
  const endM = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
  while (new Date(y, m, 1) <= endM) {
    slots.push({ label: formatMonthSlotLabel(y, m, needYear), y, m });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return slots;
}

function enumerateQuarterSlotsInRange(rangeStart: Date, rangeEnd: Date): { label: string; y: number; q0: number }[] {
  const slots: { label: string; y: number; q0: number }[] = [];
  let y = rangeStart.getFullYear();
  let q0 = Math.floor(rangeStart.getMonth() / 3);
  const endY = rangeEnd.getFullYear();
  const endQ = Math.floor(rangeEnd.getMonth() / 3);
  while (y < endY || (y === endY && q0 <= endQ)) {
    slots.push({ label: `Q${q0 + 1} ${y}`, y, q0 });
    q0 += 1;
    if (q0 > 3) {
      q0 = 0;
      y += 1;
    }
  }
  return slots;
}

function enumerateYearSlotsInRange(rangeStart: Date, rangeEnd: Date): { label: string; y: number }[] {
  const slots: { label: string; y: number }[] = [];
  for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) {
    slots.push({ label: String(y), y });
  }
  return slots;
}

type ScorecardDisplayBucket = 'week' | 'month' | 'quarter' | 'year';

type ScorecardPeriodPlan = {
  weekWindows: { label: string; start: Date }[];
  periodColumns: string[];
  monthSlots: { label: string; y: number; m: number }[];
  quarterSlots: { label: string; y: number; q0: number }[];
  yearSlots: { label: string; y: number }[];
  displayBucket: ScorecardDisplayBucket;
  /** Shown under filters: tab + date preset + column grain */
  rangeLabel: string;
};

function buildScorecardPeriodPlan(
  ref: Date,
  timeframe: TimeframeTab,
  viewBy: ViewBy,
  dateRange: DateRangeKey
): ScorecardPeriodPlan {
  const { start, end } = resolveScorecardDateHorizon(dateRange, ref);
  const weekWindows = enumerateWeekWindowsInRange(start, end);

  const displayBucket: ScorecardDisplayBucket =
    viewBy === 'week'
      ? 'week'
      : viewBy === 'month'
        ? 'month'
        : viewBy === 'quarter'
          ? 'quarter'
          : 'year';

  const monthSlots = enumerateMonthSlotsInRange(start, end);
  const quarterSlots = enumerateQuarterSlotsInRange(start, end);
  const yearSlots = enumerateYearSlotsInRange(start, end);

  let periodColumns: string[];
  if (displayBucket === 'week') {
    periodColumns = weekWindows.map((w) => w.label);
  } else if (displayBucket === 'month') {
    periodColumns = monthSlots.map((s) => s.label);
  } else if (displayBucket === 'quarter') {
    periodColumns = quarterSlots.map((s) => s.label);
  } else {
    periodColumns = yearSlots.map((s) => s.label);
  }

  const datePresetLabel = DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label ?? dateRange;
  const tabLabel =
    timeframe === 'weekly'
      ? 'Weekly'
      : timeframe === 'monthly'
        ? 'Monthly'
        : timeframe === 'quarterly'
          ? 'Quarterly'
          : 'Annual';
  const grainLabel =
    displayBucket === 'week'
      ? 'week'
      : displayBucket === 'month'
        ? 'month'
        : displayBucket === 'quarter'
          ? 'quarter'
          : 'year';

  const rangeLabel = `${tabLabel} scorecard · ${datePresetLabel} · ${grainLabel} columns`;

  return {
    weekWindows,
    periodColumns,
    monthSlots,
    quarterSlots,
    yearSlots,
    displayBucket,
    rangeLabel,
  };
}

function getMonthSlots(count: number): { label: string; y: number; m: number }[] {
  const slots: { label: string; y: number; m: number }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    slots.push({
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      y: d.getFullYear(),
      m: d.getMonth(),
    });
  }
  return slots.reverse();
}

function getMonthLabels(count: number): string[] {
  return getMonthSlots(count).map((s) => s.label);
}

function getQuarterSlots(count: number): { label: string; y: number; q0: number }[] {
  const slots: { label: string; y: number; q0: number }[] = [];
  const now = new Date();
  let y = now.getFullYear();
  let cur = Math.floor(now.getMonth() / 3);
  for (let i = 0; i < count; i++) {
    slots.push({ label: `Q${cur + 1} ${y}`, y, q0: cur });
    cur -= 1;
    if (cur < 0) {
      cur = 3;
      y -= 1;
    }
  }
  return slots.reverse();
}

function getQuarterLabels(count: number): string[] {
  return getQuarterSlots(count).map((s) => s.label);
}

function getYearSlots(count: number): { label: string; y: number }[] {
  const y0 = new Date().getFullYear();
  const slots: { label: string; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const y = y0 - i;
    slots.push({ label: String(y), y });
  }
  return slots.reverse();
}

function getYearLabels(count: number): string[] {
  return getYearSlots(count).map((s) => s.label);
}

function buildColumnWeekMap(
  labels: string[],
  bucket: 'month' | 'quarter' | 'year',
  weekWindows: { label: string; start: Date }[],
  monthSlots: { label: string; y: number; m: number }[],
  quarterSlots: { label: string; y: number; q0: number }[],
  yearSlots: { label: string; y: number }[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const col of labels) map.set(col, []);

  for (const w of weekWindows) {
    const sun = w.start;
    let col: string | undefined;
    if (bucket === 'month') {
      const slot = monthSlots.find((s) => s.y === sun.getFullYear() && s.m === sun.getMonth());
      col = slot?.label;
    } else if (bucket === 'quarter') {
      const q0 = Math.floor(sun.getMonth() / 3);
      const slot = quarterSlots.find((s) => s.y === sun.getFullYear() && s.q0 === q0);
      col = slot?.label;
    } else {
      const slot = yearSlots.find((s) => s.y === sun.getFullYear());
      col = slot?.label;
    }
    if (col && map.has(col)) {
      map.get(col)!.push(w.label);
    }
  }
  return map;
}

/** Flight desk measurable unit — immutable after the measurable is first saved. */
export type MeasurableUnitType = 'Currency' | 'Percentage' | 'Number' | 'Yes/No' | 'Time';
export type MeasurableCurrencyCode = 'USD' | 'GBP' | 'EUR';

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
  /** Persisted in periodValues as __sc_* — cannot change after create */
  unitType?: MeasurableUnitType;
  currencyCode?: MeasurableCurrencyCode;
  orientationRule?: string;
  rollup?: 'total' | 'average';
}

const ORIENTATION_RULE_OPTIONS = [
  'Inside min and max',
  'Outside min and max',
  'Greater than or equal to goal',
  'Greater than goal',
  'Equal to goal',
  'Less than goal',
  'Less than or equal to goal',
] as const;

const CURRENCY_OPTIONS: Array<{ value: MeasurableCurrencyCode; label: string }> = [
  { value: 'USD', label: '$ USD — US Dollar' },
  { value: 'GBP', label: '£ GBP — British Pound' },
  { value: 'EUR', label: '€ EUR — Euro' },
];

const SC_PREFIX = '__sc_';

function extractScorecardMeta(periodValues: Record<string, string> | undefined): Pick<
  MeasurableRow,
  'unitType' | 'currencyCode' | 'orientationRule' | 'rollup'
> {
  const pv = periodValues ?? {};
  const unitType = pv[`${SC_PREFIX}unitType`] as MeasurableUnitType | undefined;
  const rawCur = pv[`${SC_PREFIX}currency`] as MeasurableCurrencyCode | undefined;
  const currencyCode =
    rawCur === 'USD' || rawCur === 'GBP' || rawCur === 'EUR' ? rawCur : undefined;
  const orientationRule = pv[`${SC_PREFIX}orientation`];
  const rollupRaw = pv[`${SC_PREFIX}rollup`];
  const rollup = rollupRaw === 'average' ? 'average' : rollupRaw === 'total' ? 'total' : undefined;
  return { unitType, currencyCode, orientationRule, rollup };
}

function stripScorecardMetaFromPeriodValues(periodValues: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(periodValues).filter(([k]) => !k.startsWith(SC_PREFIX)));
}

function mergeScorecardMetaIntoPeriodValues(
  periodValues: Record<string, string>,
  meta: Pick<MeasurableRow, 'unitType' | 'currencyCode' | 'orientationRule' | 'rollup'>
): Record<string, string> {
  const next = { ...periodValues };
  if (meta.unitType) next[`${SC_PREFIX}unitType`] = meta.unitType;
  else delete next[`${SC_PREFIX}unitType`];
  if (meta.currencyCode) next[`${SC_PREFIX}currency`] = meta.currencyCode;
  else delete next[`${SC_PREFIX}currency`];
  if (meta.orientationRule) next[`${SC_PREFIX}orientation`] = meta.orientationRule;
  else delete next[`${SC_PREFIX}orientation`];
  if (meta.rollup) next[`${SC_PREFIX}rollup`] = meta.rollup;
  else delete next[`${SC_PREFIX}rollup`];
  return next;
}

function measurableRowToUpsertEntry(m: MeasurableRow, order: number) {
  const ownerPv = withOwnerMeta(m.periodValues ?? {}, {
    ownerId: m.ownerId,
    ownerName: m.ownerName,
    ownerEmail: m.ownerEmail,
    ownerInitials: m.ownerInitials,
  });
  const periodValues = mergeScorecardMetaIntoPeriodValues(ownerPv, {
    unitType: m.unitType,
    currencyCode: m.currencyCode,
    orientationRule: m.orientationRule,
    rollup: m.rollup,
  });
  return {
    id: m.id,
    scorecardGroupId: m.groupId === undefined || m.groupId === 'main' ? null : m.groupId,
    title: m.title,
    goal: m.goal,
    average: m.average,
    total: m.total,
    trend: m.trend,
    periodValues,
    order,
  };
}

function padTimeUnit(n: number, max: number) {
  return String(Math.max(0, Math.min(max, Math.floor(n)))).padStart(2, '0');
}

function parseTimeWithMs(raw: string): { h: number; m: number; s: number; ms: number } {
  const t = raw.trim();
  if (!t) return { h: 0, m: 0, s: 0, ms: 0 };
  const dot = t.split('.');
  const main = dot[0];
  let ms = 0;
  if (dot.length > 1) {
    const msStr = dot[1].replace(/\D/g, '').padEnd(3, '0').slice(0, 3);
    ms = parseInt(msStr, 10);
    if (Number.isNaN(ms)) ms = 0;
  }
  const segs = main.split(':').map((x) => parseInt(x.trim(), 10));
  if (segs.length !== 3 || segs.some((n) => Number.isNaN(n))) {
    return { h: 0, m: 0, s: 0, ms: 0 };
  }
  return {
    h: Math.max(0, Math.min(999, segs[0])),
    m: Math.max(0, Math.min(59, segs[1])),
    s: Math.max(0, Math.min(59, segs[2])),
    ms: Math.max(0, Math.min(999, ms)),
  };
}

function formatTimeWithMs(h: number, m: number, s: number, ms: number): string {
  const hh = String(Math.max(0, Math.min(999, Math.floor(h)))).padStart(2, '0');
  const mm = padTimeUnit(Math.max(0, Math.min(59, Math.floor(m))), 59);
  const ss = padTimeUnit(Math.max(0, Math.min(59, Math.floor(s))), 59);
  const msc = Math.max(0, Math.min(999, Math.floor(ms)));
  if (msc === 0) return `${hh}:${mm}:${ss}`;
  return `${hh}:${mm}:${ss}.${String(msc).padStart(3, '0')}`;
}

function buildGoalFromTargetForm(params: {
  unitType: MeasurableUnitType;
  orientation: string;
  value: number;
  valueMax: number;
  yesNo: 'Yes' | 'No';
  time: { h: number; m: number; s: number };
}): string {
  if (params.unitType === 'Yes/No') return params.yesNo;
  if (params.unitType === 'Time') {
    const h = Math.max(0, Math.min(999, Math.floor(params.time.h)));
    const m = Math.max(0, Math.min(59, Math.floor(params.time.m)));
    const s = Math.max(0, Math.min(59, Math.floor(params.time.s)));
    return `${String(h).padStart(2, '0')}:${padTimeUnit(m, 59)}:${padTimeUnit(s, 59)}`;
  }
  if (params.orientation === 'Inside min and max') {
    return `in ${params.value} ${params.valueMax}`;
  }
  if (params.orientation === 'Outside min and max') {
    return `out ${params.value} ${params.valueMax}`;
  }
  const v = params.value;
  if (params.orientation === 'Greater than or equal to goal') return `>= ${v}`;
  if (params.orientation === 'Greater than goal') return `> ${v}`;
  if (params.orientation === 'Equal to goal') return `= ${v}`;
  if (params.orientation === 'Less than goal') return `< ${v}`;
  if (params.orientation === 'Less than or equal to goal') return `<= ${v}`;
  return `>= ${v}`;
}

function parseGoalForEditForm(
  goal: string,
  unitType: MeasurableUnitType | undefined
): {
  orientation: (typeof ORIENTATION_RULE_OPTIONS)[number];
  value: number;
  valueMax: number;
  yesNo: 'Yes' | 'No';
  time: { h: number; m: number; s: number };
} {
  const g = goal.trim();
  const fallback: (typeof ORIENTATION_RULE_OPTIONS)[number] = 'Greater than or equal to goal';
  if (unitType === 'Yes/No') {
    return { orientation: fallback, value: 0, valueMax: 0, yesNo: g === 'No' ? 'No' : 'Yes', time: { h: 0, m: 0, s: 0 } };
  }
  if (unitType === 'Time') {
    const parts = g.split(':');
    return {
      orientation: fallback,
      value: 0,
      valueMax: 0,
      yesNo: 'Yes',
      time: {
        h: parseInt(parts[0] ?? '0', 10) || 0,
        m: parseInt(parts[1] ?? '0', 10) || 0,
        s: parseInt(parts[2] ?? '0', 10) || 0,
      },
    };
  }
  const inMatch = /^in\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s*$/.exec(g);
  if (inMatch) {
    return {
      orientation: 'Inside min and max',
      value: parseFloat(inMatch[1]) || 0,
      valueMax: parseFloat(inMatch[2]) || 0,
      yesNo: 'Yes',
      time: { h: 0, m: 0, s: 0 },
    };
  }
  const outMatch = /^out\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s*$/.exec(g);
  if (outMatch) {
    return {
      orientation: 'Outside min and max',
      value: parseFloat(outMatch[1]) || 0,
      valueMax: parseFloat(outMatch[2]) || 0,
      yesNo: 'Yes',
      time: { h: 0, m: 0, s: 0 },
    };
  }
  if (/^>=\s*-?\d/.test(g)) {
    return { orientation: 'Greater than or equal to goal', value: parseFloat(g.replace(/^>=\s*/, '')) || 0, valueMax: 0, yesNo: 'Yes', time: { h: 0, m: 0, s: 0 } };
  }
  if (/^>\s*-?\d/.test(g) && !/^>=/.test(g)) {
    return { orientation: 'Greater than goal', value: parseFloat(g.replace(/^>\s*/, '')) || 0, valueMax: 0, yesNo: 'Yes', time: { h: 0, m: 0, s: 0 } };
  }
  if (/^<=\s*-?\d/.test(g)) {
    return { orientation: 'Less than or equal to goal', value: parseFloat(g.replace(/^<=\s*/, '')) || 0, valueMax: 0, yesNo: 'Yes', time: { h: 0, m: 0, s: 0 } };
  }
  if (/^<\s*-?\d/.test(g) && !/^<=/.test(g)) {
    return { orientation: 'Less than goal', value: parseFloat(g.replace(/^<\s*/, '')) || 0, valueMax: 0, yesNo: 'Yes', time: { h: 0, m: 0, s: 0 } };
  }
  if (/^=\s*-?\d/.test(g)) {
    return { orientation: 'Equal to goal', value: parseFloat(g.replace(/^=\s*/, '')) || 0, valueMax: 0, yesNo: 'Yes', time: { h: 0, m: 0, s: 0 } };
  }
  return { orientation: fallback, value: 0, valueMax: 0, yesNo: 'Yes', time: { h: 0, m: 0, s: 0 } };
}

function currencySymbol(code: MeasurableCurrencyCode | undefined): string {
  if (code === 'GBP') return '£';
  if (code === 'EUR') return '€';
  return '$';
}

function inferUnitTypeFromRow(r: MeasurableRow): MeasurableUnitType {
  if (r.unitType) return r.unitType;
  return inferUnitTypeFromGoalString(r.goal);
}

function inferUnitTypeFromGoalString(goal: string | undefined): MeasurableUnitType {
  const g = goal?.trim() ?? '';
  if (g === 'Yes' || g === 'No') return 'Yes/No';
  if (/^\d{1,3}:\d{2}:\d{2}(\.\d{1,3})?$/.test(g)) return 'Time';
  return 'Number';
}

function formatGoalNumberToken(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(Math.trunc(n));
  return String(n);
}

function orientationRuleToTextPrefix(orient: string | undefined): string {
  switch (orient) {
    case 'Greater than or equal to goal':
      return '>=';
    case 'Greater than goal':
      return '>';
    case 'Equal to goal':
      return '=';
    case 'Less than or equal to goal':
      return '<=';
    case 'Less than goal':
      return '<';
    default:
      return '>=';
  }
}

/** Human-readable Target column: units ($, %, time), ranges (“>= $1 and <= $10”), not raw storage tokens. */
function formatGoalDisplay(r: MeasurableRow): string {
  const unit = inferUnitTypeFromRow(r);
  const g = r.goal?.trim() ?? '';
  if (!g) return '—';

  if (unit === 'Yes/No') return g;

  const sym = currencySymbol(r.currencyCode);

  if (unit === 'Time') {
    const prefix = orientationRuleToTextPrefix(r.orientationRule);
    return `${prefix} ${g}`;
  }

  if (g.startsWith('in ')) {
    const m = /^in\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s*$/.exec(g);
    if (m) {
      const v1 = parseFloat(m[1]);
      const v2 = parseFloat(m[2]);
      const lo = Math.min(v1, v2);
      const hi = Math.max(v1, v2);
      const loS = formatGoalNumberToken(lo);
      const hiS = formatGoalNumberToken(hi);
      if (unit === 'Currency') return `>= ${sym}${loS} and <= ${sym}${hiS}`;
      if (unit === 'Percentage') return `>= ${loS}% and <= ${hiS}%`;
      return `>= ${loS} and <= ${hiS}`;
    }
  }
  if (g.startsWith('out ')) {
    const m = /^out\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s*$/.exec(g);
    if (m) {
      const v1 = parseFloat(m[1]);
      const v2 = parseFloat(m[2]);
      const lo = Math.min(v1, v2);
      const hi = Math.max(v1, v2);
      const loS = formatGoalNumberToken(lo);
      const hiS = formatGoalNumberToken(hi);
      if (unit === 'Currency') return `< ${sym}${loS} or > ${sym}${hiS}`;
      if (unit === 'Percentage') return `< ${loS}% or > ${hiS}%`;
      return `< ${loS} or > ${hiS}`;
    }
  }

  const single = /^(>=|>|=|<=|<)\s*(-?\d*\.?\d+)\s*$/.exec(g);
  if (single) {
    const op = single[1];
    const n = single[2];
    if (unit === 'Currency') return `${op} ${sym}${n}`;
    if (unit === 'Percentage') return `${op} ${n}%`;
    return `${op} ${n}`;
  }

  return g;
}

function timeStringToSeconds(hms: string): number | null {
  const t = hms.trim();
  if (!t) return null;
  const dot = t.split('.');
  const main = dot[0];
  let ms = 0;
  if (dot.length > 1) {
    const msStr = dot[1].replace(/\D/g, '').padEnd(3, '0').slice(0, 3);
    ms = parseInt(msStr, 10);
    if (Number.isNaN(ms)) return null;
  }
  const p = main.split(':').map((x) => parseInt(x.trim(), 10));
  if (p.length !== 3 || p.some((n) => Number.isNaN(n))) return null;
  return p[0] * 3600 + p[1] * 60 + p[2] + ms / 1000;
}

function parseNumericCell(raw: string): number | null {
  const t = raw.trim().replace(/,/g, '');
  if (!t) return null;
  const stripped = t.replace(/[^0-9.-]/g, '');
  if (stripped === '' || stripped === '-') return null;
  const n = parseFloat(stripped);
  return Number.isNaN(n) ? null : n;
}

function secondsToRollupTimeDisplay(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const ms = Math.round((totalSeconds % 1) * 1000);
  const secFloat = Math.floor(totalSeconds);
  const h = Math.min(999, Math.floor(secFloat / 3600));
  const m = Math.floor((secFloat % 3600) / 60);
  const s = secFloat % 60;
  const base = `${String(h).padStart(2, '0')}:${padTimeUnit(m, 59)}:${padTimeUnit(s, 59)}`;
  if (ms === 0) return base;
  return `${base}.${String(ms).padStart(3, '0')}`;
}

function formatCurrencyRollup(n: number, sym: string): string {
  if (!Number.isFinite(n)) return `${sym}0`;
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded) || Math.abs(rounded - Math.trunc(rounded)) < 1e-9) {
    return `${sym}${Math.trunc(rounded)}`;
  }
  return `${sym}${rounded.toFixed(2)}`;
}

function formatPercentageRollup(n: number, kind: 'average' | 'total'): string {
  if (!Number.isFinite(n)) return '0%';
  if (kind === 'average') {
    return `${(Math.round(n * 100) / 100).toFixed(2)}%`;
  }
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded) || Math.abs(rounded - Math.trunc(rounded)) < 1e-9) {
    return `${Math.trunc(rounded)}%`;
  }
  return `${rounded.toFixed(2)}%`;
}

/** Average / Total column: apply unit suffix/prefix like period cells ($, %, HH:MM:SS). */
function formatRollupCellDisplay(r: MeasurableRow, raw: string | undefined, kind: 'average' | 'total'): string {
  const t = (raw ?? '').trim();
  if (t === '') return '—';
  const unit = inferUnitTypeFromRow(r);

  if (unit === 'Yes/No') {
    return t;
  }

  if (unit === 'Time') {
    if (/^\d{1,3}:\d{2}:\d{2}(\.\d{1,3})?$/.test(t)) return t;
    const n = parseFloat(t);
    if (!Number.isNaN(n)) return secondsToRollupTimeDisplay(n);
    return t;
  }

  const n = parseNumericCell(t);
  if (n === null) return t;

  if (unit === 'Currency') {
    return formatCurrencyRollup(n, currencySymbol(r.currencyCode));
  }
  if (unit === 'Percentage') {
    return formatPercentageRollup(n, kind);
  }
  return formatGoalNumberToken(n);
}

function aggregateRawCellsForRow(rawCells: string[], row: MeasurableRow): string {
  const unit = inferUnitTypeFromRow(row);
  const rollup = row.rollup === 'average' ? 'average' : 'total';
  const ne = rawCells.map((c) => c.trim()).filter(Boolean);
  if (ne.length === 0) return '';

  if (unit === 'Yes/No') {
    let yes = 0;
    let no = 0;
    for (const c of ne) {
      if (c === 'Yes') yes++;
      else if (c === 'No') no++;
    }
    if (yes === 0 && no === 0) return ne[ne.length - 1] ?? '';
    return yes >= no ? 'Yes' : 'No';
  }

  if (unit === 'Time') {
    const secs = ne.map(timeStringToSeconds).filter((n): n is number => n != null);
    if (secs.length === 0) return '';
    const t = rollup === 'average' ? secs.reduce((a, b) => a + b, 0) / secs.length : secs.reduce((a, b) => a + b, 0);
    return secondsToRollupTimeDisplay(t);
  }

  const nums = ne.map((c) => parseNumericCell(c)).filter((n): n is number => n !== null);
  if (nums.length === 0) return '';
  const v = rollup === 'average' ? nums.reduce((a, b) => a + b, 0) / nums.length : nums.reduce((a, b) => a + b, 0);
  const round2 = (x: number) => Math.round(x * 100) / 100;
  return String(round2(v));
}

function recomputeAvgTotalFromPeriodCols(row: MeasurableRow, periodCols: string[]): { average: string; total: string } {
  const unit = inferUnitTypeFromRow(row);
  if (unit === 'Yes/No' || unit === 'Time') {
    return { average: row.average, total: row.total };
  }
  const nums = periodCols
    .map((k) => parseNumericCell(row.periodValues[k] ?? ''))
    .filter((n): n is number => n !== null);
  if (nums.length === 0) {
    return { average: row.average, total: row.total };
  }
  const round2 = (x: number) => Math.round(x * 100) / 100;
  const total = round2(nums.reduce((a, b) => a + b, 0));
  const avg = round2(total / nums.length);
  return { average: String(avg), total: String(total) };
}

/** Roll week-level `periodValues` into month/quarter/year columns for read-only tabs / view modes. */
function transformMeasurablesForScorecardView(
  rows: MeasurableRow[],
  opts: {
    timeframe: TimeframeTab;
    viewBy: ViewBy;
    plan: ScorecardPeriodPlan;
  }
): MeasurableRow[] {
  const { timeframe, viewBy, plan } = opts;
  const isWeekEdit = timeframe === 'weekly' && viewBy === 'week' && plan.displayBucket === 'week';
  if (isWeekEdit) return rows;

  const { weekWindows, monthSlots, quarterSlots, yearSlots, periodColumns, displayBucket } = plan;
  if (displayBucket === 'week') return rows;

  const bucket = displayBucket;
  const labels = periodColumns;

  const colWeeks = buildColumnWeekMap(labels, bucket, weekWindows, monthSlots, quarterSlots, yearSlots);

  return rows.map((row) => {
    const nextPv: Record<string, string> = {};
    for (const col of labels) {
      const explicit = row.periodValues[col];
      if (explicit != null && String(explicit).trim() !== '') {
        nextPv[col] = String(explicit).trim();
        continue;
      }
      const weeks = colWeeks.get(col) ?? [];
      const rawWeekVals = weeks
        .map((w) => row.periodValues[w])
        .filter((v) => v != null && String(v).trim() !== '') as string[];
      let cell: string;
      if (rawWeekVals.length === 0) {
        const fallback = row.periodValues[col];
        cell = fallback != null && String(fallback).trim() !== '' ? String(fallback) : '';
      } else {
        cell = aggregateRawCellsForRow(rawWeekVals, row);
      }
      nextPv[col] = cell;
    }
    const roll = recomputeAvgTotalFromPeriodCols({ ...row, periodValues: nextPv }, labels);
    return { ...row, periodValues: nextPv, average: roll.average, total: roll.total };
  });
}

/** Whether a period cell satisfies the row goal (green/red heatmap). */
function evaluatePeriodCellAgainstGoal(r: MeasurableRow, rawCell: string): 'pass' | 'fail' | 'empty' {
  const cell = rawCell.trim();
  if (!cell) return 'empty';
  const unit = inferUnitTypeFromRow(r);
  const g = r.goal?.trim() ?? '';
  if (!g) return 'empty';

  if (unit === 'Yes/No') {
    return cell === g ? 'pass' : 'fail';
  }

  if (unit === 'Time') {
    const cSec = timeStringToSeconds(cell);
    const gSec = timeStringToSeconds(g);
    if (cSec == null || gSec == null) return 'empty';
    const orient = r.orientationRule ?? 'Greater than or equal to goal';
    switch (orient) {
      case 'Greater than or equal to goal':
        return cSec >= gSec ? 'pass' : 'fail';
      case 'Greater than goal':
        return cSec > gSec ? 'pass' : 'fail';
      case 'Equal to goal':
        return cSec === gSec ? 'pass' : 'fail';
      case 'Less than or equal to goal':
        return cSec <= gSec ? 'pass' : 'fail';
      case 'Less than goal':
        return cSec < gSec ? 'pass' : 'fail';
      default:
        return cSec >= gSec ? 'pass' : 'fail';
    }
  }

  const n = parseNumericCell(cell);
  if (n === null) return 'empty';

  const inM = /^in\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s*$/.exec(g);
  if (inM) {
    const a = parseFloat(inM[1]);
    const b = parseFloat(inM[2]);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return n >= lo && n <= hi ? 'pass' : 'fail';
  }

  const outM = /^out\s+(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s*$/.exec(g);
  if (outM) {
    const a = parseFloat(outM[1]);
    const b = parseFloat(outM[2]);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return n < lo || n > hi ? 'pass' : 'fail';
  }

  const single = /^(>=|>|=|<=|<)\s*(-?\d*\.?\d+)\s*$/.exec(g);
  if (single) {
    const op = single[1];
    const gv = parseFloat(single[2]);
    if (Number.isNaN(gv)) return 'empty';
    const eqEps = 1e-9;
    switch (op) {
      case '>=':
        return n >= gv ? 'pass' : 'fail';
      case '>':
        return n > gv ? 'pass' : 'fail';
      case '=':
        return Math.abs(n - gv) < eqEps ? 'pass' : 'fail';
      case '<=':
        return n <= gv ? 'pass' : 'fail';
      case '<':
        return n < gv ? 'pass' : 'fail';
      default:
        return 'empty';
    }
  }

  return 'empty';
}

function periodCellHeatmapClasses(status: 'pass' | 'fail' | 'empty'): string {
  if (status === 'pass') {
    return 'bg-emerald-950/35 text-emerald-100 border-emerald-700/50 dark:bg-emerald-950/55 dark:text-emerald-200 dark:border-emerald-600/50';
  }
  if (status === 'fail') {
    return 'bg-red-950/35 text-red-100 border-red-700/50 dark:bg-red-950/55 dark:text-red-200 dark:border-red-600/50';
  }
  return 'bg-background text-foreground border-border';
}

/** $ / % strips — match pass|fail cell so they don’t stay neutral grey on heatmap. */
function periodCellAffixClasses(status: 'pass' | 'fail' | 'empty'): string {
  if (status === 'pass') {
    return 'border-emerald-700/45 bg-emerald-950/40 text-emerald-200';
  }
  if (status === 'fail') {
    return 'border-red-700/45 bg-red-950/40 text-red-200';
  }
  return 'border-border/60 bg-muted/30 text-muted-foreground';
}

/** Fixed height for scorecard body rows (left + period columns align). */
const SCORECARD_BODY_TD = 'h-[50px] min-h-[50px] max-h-[50px] px-3 py-0 align-middle box-border';
const PERIOD_CTRL_H = 'h-8 min-h-8 max-h-8 py-0 text-sm leading-none';

const MOCK_MEASURABLES: MeasurableRow[] = [
  {
    id: '1',
    title: 'measurable',
    goal: '>= 0',
    average: '0',
    total: '0',
    trend: 'down',
    periodValues: {},
    ownerId: '',
    ownerName: '',
    ownerEmail: '',
    ownerInitials: '',
    unitType: 'Number',
    rollup: 'total',
  },
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

function TimePeriodSetModal({
  initialValue,
  onClose,
  onApply,
}: {
  initialValue: string;
  onClose: () => void;
  onApply: (v: string) => void;
}) {
  const p0 = parseTimeWithMs(initialValue);
  const [h, setH] = useState(p0.h);
  const [mi, setMi] = useState(p0.m);
  const [s, setS] = useState(p0.s);
  const [ms, setMs] = useState(p0.ms);

  useEffect(() => {
    const p = parseTimeWithMs(initialValue);
    setH(p.h);
    setMi(p.m);
    setS(p.s);
    setMs(p.ms);
  }, [initialValue]);

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  const apply = () => {
    onApply(formatTimeWithMs(clamp(h, 0, 999), clamp(mi, 0, 59), clamp(s, 0, 59), clamp(ms, 0, 999)));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fieldCls =
    'mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums text-foreground';

  return (
    <>
      <div className="fixed inset-0 z-[110] bg-black/20" onClick={onClose} aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 z-[111] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 shadow-xl"
        role="dialog"
        aria-labelledby="time-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="time-modal-title" className="text-base font-semibold text-foreground mb-4">
          Set time
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-xs text-muted-foreground">
            Hours
            <input
              type="number"
              min={0}
              max={999}
              className={fieldCls}
              value={h}
              onChange={(e) => setH(clamp(Number(e.target.value) || 0, 0, 999))}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Minutes
            <input
              type="number"
              min={0}
              max={59}
              className={fieldCls}
              value={mi}
              onChange={(e) => setMi(clamp(Number(e.target.value) || 0, 0, 59))}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Seconds
            <input
              type="number"
              min={0}
              max={59}
              className={fieldCls}
              value={s}
              onChange={(e) => setS(clamp(Number(e.target.value) || 0, 0, 59))}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Milliseconds
            <input
              type="number"
              min={0}
              max={999}
              className={fieldCls}
              value={ms}
              onChange={(e) => setMs(clamp(Number(e.target.value) || 0, 0, 999))}
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-md hover:bg-muted text-sm font-medium text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            className="px-4 py-2 bg-primary text-primary-foreground border border-primary rounded-md hover:bg-primary/90 text-sm font-medium shadow-sm"
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
}

function ScorecardTimePeriodCell({
  value,
  onCommit,
  heat,
}: {
  value: string;
  onCommit: (next: string) => void;
  heat: string;
}) {
  const [open, setOpen] = useState(false);
  const { h, m, s, ms } = parseTimeWithMs(value);
  const hh = String(h).padStart(2, '0');
  const mm = padTimeUnit(m, 59);
  const ss = padTimeUnit(s, 59);
  const msStr = ms === 0 ? '' : `.${String(ms).padStart(3, '0')}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex h-8 min-h-8 max-h-8 w-full min-w-0 items-stretch rounded-md border overflow-hidden text-left text-sm leading-none ${heat} focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-background`}
      >
        <span className="flex flex-1 min-w-0 items-center justify-center border-r border-border/50 px-1.5 py-0 tabular-nums text-xs font-medium">
          {hh}
        </span>
        <span className="flex flex-1 min-w-0 items-center justify-center border-r border-border/50 px-1.5 py-0 tabular-nums text-xs font-medium">
          {mm}
        </span>
        <span className="flex flex-[1.2] min-w-0 items-center justify-center px-1.5 py-0 tabular-nums text-xs font-medium">
          {ss}
          {msStr ? <span className="text-muted-foreground font-normal">{msStr}</span> : null}
        </span>
      </button>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <TimePeriodSetModal
            initialValue={value}
            onClose={() => setOpen(false)}
            onApply={(v) => {
              onCommit(v);
              setOpen(false);
            }}
          />,
          document.body
        )}
    </>
  );
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
  periodHeadersMuted = false,
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
  /** Muted styling for period column headers (e.g. view-only grain vs tab) */
  periodHeadersMuted?: boolean;
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

  const periodColumnsSig = periodColumns.join('\u0001');
  useLayoutEffect(() => {
    setColumnSizing({});
  }, [periodColumnsSig]);

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
              <OwnerInitialsAvatar
                initials={initials || undefined}
                size="sm"
                title={tooltip}
                className="cursor-default"
              />
            </div>
          );
        },
        size: 82,
      });
    }
    if (visibility.showGoalColumn)
      cols.push({
        id: 'goal',
        header: () => <span className="font-medium text-foreground">Target</span>,
        cell: ({ row }) => {
          const r = row.original;
          if (r.showGoal === false) return '';
          const v = formatGoalDisplay(r);
          return (
            <span className="text-left text-foreground tabular-nums whitespace-normal text-sm">{v}</span>
          );
        },
        size: 140,
      });
    if (visibility.showAverageColumn)
      cols.push({
        id: 'average',
        header: () => <span className="font-medium text-foreground">Average</span>,
        cell: ({ row }) => {
          const r = row.original;
          if (r.showAverage === false) return '';
          return formatRollupCellDisplay(r, r.average, 'average');
        },
        size: 90,
      });
    if (visibility.showTotalColumn)
      cols.push({
        id: 'total',
        header: () => <span className="font-medium text-foreground">Total</span>,
        cell: ({ row }) => {
          const r = row.original;
          if (r.showTotal === false) return '';
          return formatRollupCellDisplay(r, r.total, 'total');
        },
        size: 80,
      });
    const periodCols = (displayDirection === 'rtl' ? [...periodColumns].reverse() : periodColumns).map((label, i) => ({
      id: `period-${i}-${periodColumnsSig.slice(0, 12)}-${label.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 48)}`,
      header: () => (
        <span
          className={`font-medium text-sm leading-snug whitespace-nowrap ${periodHeadersMuted ? 'text-muted-foreground' : 'text-foreground'}`}
        >
          {label}
        </span>
      ),
      cell: ({ row }: { row: { original: MeasurableRow } }) => {
        const r = row.original;
        const pv = r.periodValues[label] ?? '';
        const unit = inferUnitTypeFromRow(r);
        const status = evaluatePeriodCellAgainstGoal(r, pv);
        const heat = periodCellHeatmapClasses(status);
        const ringFocus = 'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary';

        if (!onPeriodValueChange) {
          const show = pv || '—';
          if (status === 'empty') return show;
          return (
            <span
              className={`inline-flex min-w-[3rem] ${PERIOD_CTRL_H} items-center justify-center rounded border px-2 ${heat}`}
            >
              {show}
            </span>
          );
        }

        if (unit === 'Yes/No') {
          const selectTone =
            status === 'pass'
              ? '[&_.ant-select-selection-item]:!text-emerald-100 [&_.ant-select-selection-placeholder]:!text-emerald-300/70'
              : status === 'fail'
                ? '[&_.ant-select-selection-item]:!text-red-100 [&_.ant-select-selection-placeholder]:!text-red-300/70'
                : '';
          return (
            <div className={`h-8 min-h-8 max-h-8 rounded-md border overflow-hidden ${heat}`}>
              <Select
                value={pv || undefined}
                onChange={(v) => {
                  onPeriodValueChange(r.id, label, typeof v === 'string' ? v : '');
                }}
                allowClear
                placeholder="—"
                options={[
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' },
                ]}
                className={`w-full min-w-[88px] h-8 [&_.ant-select-selector]:!h-8 [&_.ant-select-selector]:!min-h-8 [&_.ant-select-selector]:!py-0 [&_.ant-select-selector]:!px-2 [&_.ant-select-selector]:border-0 [&_.ant-select-selector]:shadow-none [&_.ant-select-selector]:flex [&_.ant-select-selector]:items-center ${selectTone}`}
              />
            </div>
          );
        }

        if (unit === 'Time') {
          return (
            <ScorecardTimePeriodCell
              value={pv}
              onCommit={(next) => onPeriodValueChange(r.id, label, next)}
              heat={heat}
            />
          );
        }

        if (unit === 'Currency') {
          const sym = currencySymbol(r.currencyCode);
          const inputTone =
            status === 'pass'
              ? 'text-emerald-100 placeholder:text-emerald-400/50'
              : status === 'fail'
                ? 'text-red-100 placeholder:text-red-400/50'
                : '';
          return (
            <div className={`flex h-8 min-h-8 max-h-8 items-stretch rounded-md border overflow-hidden ${heat}`}>
              <span
                className={`flex items-center shrink-0 border-r px-1.5 text-xs ${periodCellAffixClasses(status)}`}
              >
                {sym}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={pv}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^-?\d*\.?\d*$/.test(v)) onPeriodValueChange(r.id, label, v);
                }}
                className={`min-w-0 flex-1 bg-transparent px-2 ${PERIOD_CTRL_H} ${ringFocus} ${inputTone}`}
                placeholder="0"
              />
            </div>
          );
        }

        if (unit === 'Percentage') {
          const inputTone =
            status === 'pass'
              ? 'text-emerald-100 placeholder:text-emerald-400/50'
              : status === 'fail'
                ? 'text-red-100 placeholder:text-red-400/50'
                : '';
          return (
            <div className={`flex h-8 min-h-8 max-h-8 items-stretch rounded-md border overflow-hidden ${heat}`}>
              <input
                type="text"
                inputMode="decimal"
                value={pv}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^-?\d*\.?\d*%?$/.test(v)) onPeriodValueChange(r.id, label, v);
                }}
                className={`min-w-0 flex-1 bg-transparent px-2 ${PERIOD_CTRL_H} ${ringFocus} ${inputTone}`}
                placeholder="0"
              />
              <span
                className={`flex shrink-0 items-center border-l px-1.5 text-xs ${periodCellAffixClasses(status)}`}
              >
                %
              </span>
            </div>
          );
        }

        const numInputTone =
          status === 'pass'
            ? 'text-emerald-100 placeholder:text-emerald-400/50'
            : status === 'fail'
              ? 'text-red-100 placeholder:text-red-400/50'
              : '';
        return (
          <input
            type="text"
            inputMode="decimal"
            value={pv}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '' || /^-?\d*\.?\d*$/.test(v)) onPeriodValueChange(r.id, label, v);
            }}
            className={`w-full min-w-0 rounded-md border px-2 ${PERIOD_CTRL_H} ${heat} ${ringFocus} ${numInputTone}`}
            placeholder="—"
          />
        );
      },
      size: 100,
    }));
    cols.push(...periodCols);
    return cols;
  }, [periodColumns, selectedIds, data, displayDirection, visibility, onPeriodValueChange, onEditMeasurable, isExpanded, periodHeadersMuted]);
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
        {/* Left section: fixed columns (through Total), no scroll — body cell metrics match period table below */}
        <div className="shrink-0 overflow-hidden bg-card" style={{ width: fixedWidth }}>
          <table className="w-full border-collapse text-sm table-fixed leading-normal">
            <thead>
              <tr>
                {fixedHeaders.map((h) => (
                  <th
                    key={h.id}
                    className={`group relative min-h-12 align-middle border-b border-border bg-muted/30 px-3 py-3 text-sm font-medium text-foreground whitespace-nowrap ${h.column.id === 'average' || h.column.id === 'total' ? 'text-right' : 'text-left'}`}
                    style={{ width: h.column.getSize(), minWidth: h.column.getSize() }}
                  >
                    <span className="inline-flex min-h-8 items-center">
                      {typeof h.column.columnDef.header === 'function' ? flexRender(h.column.columnDef.header, h.getContext()) : h.column.columnDef.header}
                    </span>
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
                      <td
                        key={cell.id}
                        className={`${SCORECARD_BODY_TD} text-foreground whitespace-nowrap ${cell.column.id === 'average' || cell.column.id === 'total' ? 'text-right tabular-nums' : ''}`}
                        style={{ width: cell.column.getSize(), minWidth: cell.column.getSize() }}
                      >
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
        <div className={`flex-1 min-w-0 flex flex-col border-l-2 ${periodHeadersMuted ? 'border-border' : 'border-primary'}`}>
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
            <table className="border-collapse text-sm w-max min-w-full leading-normal">
              <thead>
                <tr>
                  {periodHeaders.map((h) => (
                    <th
                      key={h.id}
                      className={`group relative min-h-12 align-middle border-b border-border px-3 py-3 text-left text-sm font-medium whitespace-nowrap ${periodHeadersMuted ? 'bg-muted/50 text-muted-foreground' : 'bg-muted/30 text-foreground'}`}
                      style={{ width: h.column.getSize(), minWidth: h.column.getSize() }}
                    >
                      <span className="inline-flex min-h-8 items-center">
                        {typeof h.column.columnDef.header === 'function' ? flexRender(h.column.columnDef.header, h.getContext()) : h.column.columnDef.header}
                      </span>
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
                        <td
                          key={cell.id}
                          className={`${SCORECARD_BODY_TD} text-foreground whitespace-nowrap`}
                          style={{ width: cell.column.getSize(), minWidth: cell.column.getSize() }}
                        >
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
  const [createMeasurableUnit, setCreateMeasurableUnit] = useState<MeasurableUnitType>('Number');
  const [createMeasurableCurrency, setCreateMeasurableCurrency] = useState<MeasurableCurrencyCode>('USD');
  const [createMeasurableOrientation, setCreateMeasurableOrientation] = useState<
    (typeof ORIENTATION_RULE_OPTIONS)[number]
  >('Greater than or equal to goal');
  const [createMeasurableGoalValue, setCreateMeasurableGoalValue] = useState(0);
  const [createMeasurableGoalMax, setCreateMeasurableGoalMax] = useState(0);
  const [createMeasurableYesNo, setCreateMeasurableYesNo] = useState<'Yes' | 'No'>('Yes');
  const [createMeasurableTimeH, setCreateMeasurableTimeH] = useState(0);
  const [createMeasurableTimeM, setCreateMeasurableTimeM] = useState(0);
  const [createMeasurableTimeS, setCreateMeasurableTimeS] = useState(0);
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

  const scorecardPeriodPlan = useMemo(
    () => buildScorecardPeriodPlan(new Date(), timeframe, viewBy, dateRange),
    [timeframe, viewBy, dateRange]
  );
  const weekWindows = scorecardPeriodPlan.weekWindows;
  const periodColumns = scorecardPeriodPlan.periodColumns;

  /** Forces scorecard tables to remount when filters / period headers change (avoids TanStack Table stale headers). */
  const scorecardGridKey = useMemo(
    () => `${timeframe}|${viewBy}|${dateRange}|${periodColumns.join('\u0001')}`,
    [timeframe, viewBy, dateRange, periodColumns]
  );

  useEffect(() => {
    if (timeframe === 'monthly') {
      setDateRange((r) => (r === 'last13weeks' ? 'last13months' : r));
    } else if (timeframe === 'quarterly') {
      setDateRange((r) => (r === 'last13weeks' || r === 'last13months' ? 'current_quarter' : r));
    } else if (timeframe === 'annual') {
      setDateRange((r) => (r === 'last13weeks' || r === 'last13months' ? 'current_year' : r));
    }
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
    const gTrim = editingMeasurable.goal?.trim() ?? '';
    const inferredUnit: MeasurableUnitType =
      editingMeasurable.unitType ??
      (gTrim === 'Yes' || gTrim === 'No'
        ? 'Yes/No'
        : /^\d{1,3}:\d{2}:\d{2}(\.\d{1,3})?$/.test(gTrim)
          ? 'Time'
          : 'Number');
    setCreateMeasurableUnit(inferredUnit);
    setCreateMeasurableCurrency(editingMeasurable.currencyCode ?? 'USD');
    setCreateMeasurableRollup(editingMeasurable.rollup === 'average' ? 'Average' : 'Total (default)');
    const parsed = parseGoalForEditForm(editingMeasurable.goal ?? '', inferredUnit);
    const storedOr = editingMeasurable.orientationRule;
    const orientOk =
      storedOr != null &&
      storedOr !== '' &&
      (ORIENTATION_RULE_OPTIONS as readonly string[]).includes(storedOr as string) &&
      inferredUnit !== 'Yes/No';
    setCreateMeasurableOrientation(
      orientOk ? (storedOr as (typeof ORIENTATION_RULE_OPTIONS)[number]) : parsed.orientation
    );
    setCreateMeasurableGoalValue(parsed.value);
    setCreateMeasurableGoalMax(parsed.valueMax);
    setCreateMeasurableYesNo(parsed.yesNo);
    setCreateMeasurableTimeH(parsed.time.h);
    setCreateMeasurableTimeM(parsed.time.m);
    setCreateMeasurableTimeS(parsed.time.s);
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
    if (!createMeasurableOpen || editingMeasurable) return;
    setCreateMeasurableUnit('Number');
    setCreateMeasurableCurrency('USD');
    setCreateMeasurableOrientation('Greater than or equal to goal');
    setCreateMeasurableGoalValue(0);
    setCreateMeasurableGoalMax(0);
    setCreateMeasurableYesNo('Yes');
    setCreateMeasurableTimeH(0);
    setCreateMeasurableTimeM(0);
    setCreateMeasurableTimeS(0);
    setCreateMeasurableRollup('Total (default)');
  }, [createMeasurableOpen, editingMeasurable]);

  const flightMetricFormValidation = useMemo(() => {
    const errors: string[] = [];
    if (!createMeasurableTitle.trim()) {
      errors.push('Enter a title for this flight metric.');
    }
    if (!editingMeasurable && createMeasurableForGroupId == null) {
      errors.push('Use New measurable on a flight metrics card to choose where this metric belongs.');
    }
    if (createMeasurableShowGoal) {
      const effectiveUnit = (editingMeasurable?.unitType ?? createMeasurableUnit) as MeasurableUnitType;
      if (
        effectiveUnit !== 'Yes/No' &&
        effectiveUnit !== 'Time' &&
        createMeasurableOrientation === 'Inside min and max' &&
        createMeasurableGoalValue > createMeasurableGoalMax
      ) {
        errors.push('For Inside min and max, Min must be less than or equal to Max.');
      }
    }
    return { errors, canSave: errors.length === 0 };
  }, [
    createMeasurableTitle,
    editingMeasurable,
    createMeasurableForGroupId,
    createMeasurableShowGoal,
    createMeasurableUnit,
    createMeasurableOrientation,
    createMeasurableGoalValue,
    createMeasurableGoalMax,
  ]);

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
            const sc = extractScorecardMeta(pv);
            const cleanPv = stripOwnerMeta(stripScorecardMetaFromPeriodValues(pv));
            return {
              id: m.id,
              title: m.title,
              goal: m.goal,
              average: m.average,
              total: m.total,
              trend: m.trend,
              periodValues: cleanPv,
              groupId: m.groupId ?? undefined,
              ownerId: owner.ownerId,
              ownerName: owner.ownerName,
              ownerEmail: owner.ownerEmail,
              ownerInitials: owner.ownerInitials,
              ...sc,
            };
          })
        );
      } else {
        const seed = MOCK_MEASURABLES.map((m) => ({ ...m, groupId: undefined as string | undefined }));
        setMeasurables(seed);
        await scorecardMeasurablesService.upsert(
          organizationId,
          meetingId,
          seed.map((m, i) => measurableRowToUpsertEntry(m, i))
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
  /** Flush to meeting sidebar when embedded; keep right padding for readability */
  const contentPad = embedded ? 'pl-0 pr-4' : 'px-6';
  const filtersRowPad = embedded ? 'pl-0 pr-4' : 'px-4';
  const tabsRowPad = embedded ? 'pl-0 pr-2' : '';

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
  const displayMeasurables = useMemo(
    () =>
      transformMeasurablesForScorecardView(measurables, {
        timeframe,
        viewBy,
        plan: scorecardPeriodPlan,
      }),
    [measurables, timeframe, viewBy, scorecardPeriodPlan]
  );

  const mainMeasurables = displayMeasurables.filter((m) => !m.groupId || m.groupId === 'main');
  /** Measurables visible on the current tab (main + any group in this timeframe). */
  const measurablesForCurrentTab = useMemo(
    () =>
      displayMeasurables.filter(
        (m) => !m.groupId || m.groupId === 'main' || currentGroups.some((g) => g.id === m.groupId)
      ),
    [displayMeasurables, currentGroups]
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
          prev.map((m, i) => measurableRowToUpsertEntry(m, i))
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
          next.map((m, i) => measurableRowToUpsertEntry(m, i))
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
              next.map((m, i) => measurableRowToUpsertEntry(m, i))
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
          if (m.unitType === 'Yes/No' || m.unitType === 'Time') {
            return { ...m, periodValues: nextPv };
          }
          const roll = recomputeAvgTotalFromPeriodCols({ ...m, periodValues: nextPv }, periodColumns);
          return {
            ...m,
            periodValues: nextPv,
            total: roll.total,
            average: roll.average,
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
              current.map((m, i) => measurableRowToUpsertEntry(m, i))
            )
            .catch((e) => console.error('Failed to save period values', e));
        }, 800);
      }
    },
    [organizationId, meetingId, pushScorecardHistory, periodColumns]
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

  const scorecardPeriodGridReadOnly = !canUseFilters || !tabMatchesView(timeframe, viewBy);

  const viewBySelectOptions = useMemo(
    () =>
      (['week', 'month', 'quarter', 'year'] as const).map((v) => {
        const base = { week: 'Week', month: 'Month', quarter: 'Quarter', year: 'Year' }[v];
        return {
          value: v,
          label: tabMatchesView(timeframe, v) ? base : `${base} (view only)`,
        };
      }),
    [timeframe]
  );

  const dateRangeSelectDisabled = !canUseFilters || !tabMatchesView(timeframe, viewBy);

  const resolveSourceMeasurableRow = useCallback(
    (displayRow: MeasurableRow) => measurables.find((m) => m.id === displayRow.id) ?? displayRow,
    [measurables]
  );

  const handleEditMeasurableFromGrid = useCallback(
    (row: MeasurableRow) => handleEditMeasurable(resolveSourceMeasurableRow(row)),
    [handleEditMeasurable, resolveSourceMeasurableRow]
  );

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
        <div className={`flex gap-0 min-w-max ${tabsRowPad}`}>
          {(['weekly', 'monthly', 'quarterly', 'annual'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                if (!canUseFilters) return;
                setTimeframe(tab);
                const defaultViewBy: ViewBy = tab === 'weekly' ? 'week' : tab === 'monthly' ? 'month' : tab === 'quarterly' ? 'quarter' : 'year';
                setViewBy(defaultViewBy);
                if (meetingId && socket) socket.emit('scorecard_filter', { meetingId, timeframe: tab, viewBy: defaultViewBy });
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
      <div className={`w-full ${filtersRowPad} border-b border-border shrink-0 py-2.5 min-w-0 overflow-x-visible ${isMeetingInFuture ? 'bg-muted/50' : 'bg-muted/30'}`}>
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
              title="Pick column grain (week/month/quarter/year) for this tab and date range."
              options={viewBySelectOptions}
              className="min-w-[150px] w-[150px] shrink-0"
            />
            <span className="text-muted-foreground text-xs shrink-0">Date:</span>
            <Select<DateRangeKey>
              value={dateRange}
              onChange={(v) => {
                if (!canUseFilters || dateRangeSelectDisabled) return;
                if (v) setDateRange(v);
                if (meetingId && socket && v) socket.emit('scorecard_filter', { meetingId, dateRange: v });
              }}
              disabled={dateRangeSelectDisabled}
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
                    className="p-0 rounded-full border-0 bg-transparent hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ring-offset-background"
                    title={`Owner: ${ownerName}`}
                    aria-label="Change owner"
                  >
                    <OwnerInitialsAvatar initials={ownerInitials} size="lg" title={`Owner: ${ownerName}`} />
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
                                <OwnerInitialsAvatar initials={initials} size="xs" />
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
                  <div
                    title={
                      editingMeasurable
                        ? "This can't be edited after the flight metric is created."
                        : undefined
                    }
                  >
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Unit</label>
                    <Select
                      value={createMeasurableUnit}
                      disabled={Boolean(editingMeasurable)}
                      onChange={(v) => {
                        if (!v) return;
                        setCreateMeasurableUnit(v as MeasurableUnitType);
                      }}
                      options={[
                        { label: 'Currency', value: 'Currency' },
                        { label: 'Percentage', value: 'Percentage' },
                        { label: 'Number', value: 'Number' },
                        { label: 'Yes/No', value: 'Yes/No' },
                        { label: 'Time', value: 'Time' },
                      ]}
                      className="w-full"
                    />
                  </div>
                  {createMeasurableUnit === 'Currency' ? (
                    <div
                      title={
                        editingMeasurable
                          ? "This can't be edited after the flight metric is created."
                          : undefined
                      }
                    >
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Currency</label>
                      <Select
                        value={createMeasurableCurrency}
                        disabled={Boolean(editingMeasurable)}
                        onChange={(v) => v && setCreateMeasurableCurrency(v as MeasurableCurrencyCode)}
                        options={CURRENCY_OPTIONS.map((c) => ({ label: c.label, value: c.value }))}
                        className="w-full"
                      />
                    </div>
                  ) : null}
                  {createMeasurableUnit !== 'Yes/No' ? (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Orientation rule</label>
                      <Select
                        value={createMeasurableOrientation}
                        onChange={(v) =>
                          v && setCreateMeasurableOrientation(v as (typeof ORIENTATION_RULE_OPTIONS)[number])
                        }
                        options={ORIENTATION_RULE_OPTIONS.map((o) => ({ label: o, value: o }))}
                        className="w-full"
                      />
                    </div>
                  ) : null}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Value</label>
                    {createMeasurableUnit === 'Yes/No' ? (
                      <Select
                        value={createMeasurableYesNo}
                        onChange={(v) => v && setCreateMeasurableYesNo(v as 'Yes' | 'No')}
                        options={[
                          { label: 'Yes', value: 'Yes' },
                          { label: 'No', value: 'No' },
                        ]}
                        className="w-full"
                      />
                    ) : createMeasurableUnit === 'Time' ? (
                      <div className="flex items-center gap-1 max-w-xs">
                        <input
                          type="number"
                          min={0}
                          value={Number.isNaN(createMeasurableTimeH) ? 0 : createMeasurableTimeH}
                          onChange={(e) => setCreateMeasurableTimeH(Number(e.target.value))}
                          className="w-full min-w-0 px-2 py-2 border border-border rounded-md bg-background text-foreground text-sm text-center tabular-nums"
                          aria-label="Hours"
                        />
                        <span className="text-muted-foreground shrink-0">:</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={Number.isNaN(createMeasurableTimeM) ? 0 : createMeasurableTimeM}
                          onChange={(e) => setCreateMeasurableTimeM(Number(e.target.value))}
                          className="w-full min-w-0 px-2 py-2 border border-border rounded-md bg-background text-foreground text-sm text-center tabular-nums"
                          aria-label="Minutes"
                        />
                        <span className="text-muted-foreground shrink-0">:</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={Number.isNaN(createMeasurableTimeS) ? 0 : createMeasurableTimeS}
                          onChange={(e) => setCreateMeasurableTimeS(Number(e.target.value))}
                          className="w-full min-w-0 px-2 py-2 border border-border rounded-md bg-background text-foreground text-sm text-center tabular-nums"
                          aria-label="Seconds"
                        />
                      </div>
                    ) : createMeasurableOrientation === 'Inside min and max' ||
                      createMeasurableOrientation === 'Outside min and max' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-xs text-muted-foreground">Min</span>
                          <input
                            type="number"
                            value={createMeasurableGoalValue}
                            onChange={(e) => setCreateMeasurableGoalValue(Number(e.target.value))}
                            className="w-full mt-1 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
                          />
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Max</span>
                          <input
                            type="number"
                            value={createMeasurableGoalMax}
                            onChange={(e) => setCreateMeasurableGoalMax(Number(e.target.value))}
                            className="w-full mt-1 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex max-w-xs">
                        <input
                          type="number"
                          value={createMeasurableGoalValue}
                          onChange={(e) => setCreateMeasurableGoalValue(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-border rounded-l-lg rounded-r-none bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <div className="flex flex-col border border-l-0 border-border rounded-r-lg overflow-hidden shrink-0">
                          <button
                            type="button"
                            onClick={() => setCreateMeasurableGoalValue((v) => v + 1)}
                            className="px-2 py-0.5 border-b border-border hover:bg-muted text-foreground text-xs leading-none"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => setCreateMeasurableGoalValue((v) => v - 1)}
                            className="px-2 py-0.5 hover:bg-muted text-foreground text-xs leading-none"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rollup data</label>
                    <Select
                      value={createMeasurableRollup}
                      onChange={(v) => v && setCreateMeasurableRollup(v)}
                      options={[
                        { label: 'Total (default)', value: 'Total (default)' },
                        { label: 'Average', value: 'Average' },
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
                  if (!flightMetricFormValidation.canSave) {
                    toast.error(
                      flightMetricFormValidation.errors[0] ?? 'Please complete the required fields.'
                    );
                    return;
                  }
                  const rollupStored: 'total' | 'average' =
                    createMeasurableRollup === 'Average' ? 'average' : 'total';
                  const unitForNew = createMeasurableUnit;
                  const unitForSaved =
                    (editingMeasurable?.unitType ?? unitForNew) as MeasurableUnitType;
                  const goalStr = buildGoalFromTargetForm({
                    unitType: unitForSaved,
                    orientation: createMeasurableOrientation,
                    value: createMeasurableGoalValue,
                    valueMax: createMeasurableGoalMax,
                    yesNo: createMeasurableYesNo,
                    time: {
                      h: createMeasurableTimeH,
                      m: createMeasurableTimeM,
                      s: createMeasurableTimeS,
                    },
                  });
                  const orientationRuleStored =
                    unitForSaved === 'Yes/No' ? undefined : createMeasurableOrientation;
                  setSavingMeasurable(true);
                  const persistMeasurables = async (rows: MeasurableRow[]) => {
                    if (!organizationId || !meetingId) return;
                    const payload = rows.map((mm, i) => measurableRowToUpsertEntry(mm, i));
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
                            unitType: editingMeasurable.unitType ?? m.unitType,
                            currencyCode: editingMeasurable.currencyCode ?? m.currencyCode,
                            orientationRule: orientationRuleStored,
                            rollup: rollupStored,
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
                    setCreateMeasurableGoalMax(0);
                    setCreateMeasurableYesNo('Yes');
                    setCreateMeasurableTimeH(0);
                    setCreateMeasurableTimeM(0);
                    setCreateMeasurableTimeS(0);
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
                    unitType: unitForNew,
                    currencyCode: unitForNew === 'Currency' ? createMeasurableCurrency : undefined,
                    orientationRule: orientationRuleStored,
                    rollup: rollupStored,
                  };
                  pushScorecardHistory();
                  const next = [...measurablesRef.current, newRow];
                  setMeasurables(next);
                  await persistMeasurables(next).catch((e) => console.error('Failed to save new measurable', e));
                  setCreateMeasurableOpen(false);
                  setCreateMeasurableTitle('');
                  setCreateMeasurableDescription('');
                  setCreateMeasurableGoalValue(0);
                  setCreateMeasurableGoalMax(0);
                  setCreateMeasurableYesNo('Yes');
                  setCreateMeasurableTimeH(0);
                  setCreateMeasurableTimeM(0);
                  setCreateMeasurableTimeS(0);
                  setCreateMeasurableShowTotal(true);
                  setCreateMeasurableShowAverage(true);
                  setCreateMeasurableShowGoal(true);
                  setCreateMeasurableOwnerId('');
                  setCreateMeasurableForGroupId(null);
                  setSavingMeasurable(false);
                }}
                disabled={savingMeasurable || !flightMetricFormValidation.canSave}
                title={
                  !savingMeasurable && !flightMetricFormValidation.canSave
                    ? flightMetricFormValidation.errors[0]
                    : undefined
                }
                className="rounded-lg border border-primary bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
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
                key={`main-${scorecardGridKey}`}
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
                onPeriodValueChange={scorecardPeriodGridReadOnly ? undefined : handlePeriodValueChange}
                onEditMeasurable={scorecardPeriodGridReadOnly ? undefined : handleEditMeasurableFromGrid}
                periodHeadersMuted={scorecardPeriodGridReadOnly}
              />
            ) : currentGroups.find((g) => g.id === expandedGroupId) ? (
              <ScorecardTableCard
                key={`${expandedGroupId}-${scorecardGridKey}`}
                title={currentGroups.find((g) => g.id === expandedGroupId)!.name}
                data={displayMeasurables.filter((m) => m.groupId === expandedGroupId)}
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
                onPeriodValueChange={scorecardPeriodGridReadOnly ? undefined : handlePeriodValueChange}
                onEditMeasurable={scorecardPeriodGridReadOnly ? undefined : handleEditMeasurableFromGrid}
                periodHeadersMuted={scorecardPeriodGridReadOnly}
              />
            ) : null}
            <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-4">
              {expandedGroupId === 'main' ? (
                currentGroups.map((g) => (
                  <ScorecardTableCard
                    key={`${g.id}-${scorecardGridKey}`}
                    title={g.name}
                    data={displayMeasurables.filter((m) => m.groupId === g.id)}
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
                    onPeriodValueChange={scorecardPeriodGridReadOnly ? undefined : handlePeriodValueChange}
                    onEditMeasurable={scorecardPeriodGridReadOnly ? undefined : handleEditMeasurableFromGrid}
                    periodHeadersMuted={scorecardPeriodGridReadOnly}
                  />
                ))
              ) : (
                <>
                  {!mainGroupHidden && (
                  <ScorecardTableCard
                    key={`main-${scorecardGridKey}`}
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
                    onPeriodValueChange={scorecardPeriodGridReadOnly ? undefined : handlePeriodValueChange}
                    onEditMeasurable={scorecardPeriodGridReadOnly ? undefined : handleEditMeasurableFromGrid}
                    periodHeadersMuted={scorecardPeriodGridReadOnly}
                  />
                  )}
                  {currentGroups.filter((g) => g.id !== expandedGroupId).map((g) => (
                    <ScorecardTableCard
                      key={`${g.id}-${scorecardGridKey}`}
                      title={g.name}
                      data={displayMeasurables.filter((m) => m.groupId === g.id)}
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
                      onPeriodValueChange={scorecardPeriodGridReadOnly ? undefined : handlePeriodValueChange}
                      onEditMeasurable={scorecardPeriodGridReadOnly ? undefined : handleEditMeasurableFromGrid}
                      periodHeadersMuted={scorecardPeriodGridReadOnly}
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
              key={`main-${scorecardGridKey}`}
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
              onPeriodValueChange={scorecardPeriodGridReadOnly ? undefined : handlePeriodValueChange}
              onEditMeasurable={scorecardPeriodGridReadOnly ? undefined : handleEditMeasurableFromGrid}
              periodHeadersMuted={scorecardPeriodGridReadOnly}
            />
            )}
            {currentGroups.map((g) => (
              <ScorecardTableCard
                key={`${g.id}-${scorecardGridKey}`}
                title={g.name}
                data={displayMeasurables.filter((m) => m.groupId === g.id)}
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
                onPeriodValueChange={scorecardPeriodGridReadOnly ? undefined : handlePeriodValueChange}
                onEditMeasurable={scorecardPeriodGridReadOnly ? undefined : handleEditMeasurableFromGrid}
                periodHeadersMuted={scorecardPeriodGridReadOnly}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
