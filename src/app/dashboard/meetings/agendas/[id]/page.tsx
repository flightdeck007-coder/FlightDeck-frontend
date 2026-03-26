'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants/routes';
import { meetingSeriesService, type MeetingSeries, type SectionTemplateItem } from '@/lib/api/meeting-series.service';
import { teamsService, type Team } from '@/lib/api/teams.service';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, GripVertical, Lock, Pencil, MoreVertical, Printer, ChevronLeft } from 'lucide-react';
import { Select } from 'antd';
import { RichTextEditor } from '@/components/meeting/RichTextEditor';

/** Default flight review agenda template used for new and reset states. */
const DEFAULT_SECTION_TEMPLATE: SectionTemplateItem[] = [
  { title: 'PRE-FLIGHT', durationMinutes: 5, order: 0, visible: true, isDefaultLocked: false, subtitle: '', details: '' },
  { title: 'INSTRUMENTS', durationMinutes: 5, order: 1, visible: true, isDefaultLocked: false, subtitle: '', details: '' },
  { title: 'WAYPOINT REVIEW', durationMinutes: 5, order: 2, visible: true, isDefaultLocked: true, subtitle: '', details: '' },
  { title: 'FLIGHT ANNOUNCEMENTS', durationMinutes: 5, order: 3, visible: true, isDefaultLocked: false, subtitle: '', details: '' },
  { title: 'CLEARANCES', durationMinutes: 5, order: 4, visible: true, isDefaultLocked: true, subtitle: '', details: '' },
  { title: 'TURBULENCE', durationMinutes: 60, order: 5, visible: true, isDefaultLocked: true, subtitle: '', details: '' },
  { title: 'DEBRIEF', durationMinutes: 5, order: 6, visible: true, isDefaultLocked: true, subtitle: '', details: '' },
];

function getTotalDuration(sections: SectionTemplateItem[]): number {
  return sections.reduce((sum, s) => sum + (s.visible ? s.durationMinutes : 0), 0);
}

function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} minutes`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m ? `${h} hour${h !== 1 ? 's' : ''} ${m} minutes` : `${h} hour${h !== 1 ? 's' : ''}`;
}

function SortableRow({
  section,
  index,
  onUpdate,
  onEditClick,
}: {
  section: SectionTemplateItem;
  index: number;
  onUpdate: (index: number, patch: Partial<SectionTemplateItem>) => void;
  onEditClick: (index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `section-${index}`,
    data: { index },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-border/30 last:border-b-0 ${isDragging ? 'opacity-50 bg-muted/50' : ''}`}
    >
      <td className="px-2 py-4 w-8 align-middle">
        <button
          type="button"
          className="p-1 rounded hover:bg-accent cursor-grab active:cursor-grabbing text-muted-foreground"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="px-3 py-4">
        <input
          type="text"
          value={section.title}
          onChange={(e) => onUpdate(index, { title: e.target.value })}
          disabled={section.isDefaultLocked}
          className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
            section.isDefaultLocked
              ? 'border-border/40 bg-muted/70 text-muted-foreground/90 cursor-not-allowed hover:cursor-not-allowed'
              : 'border-border bg-background text-foreground'
          }`}
        />
      </td>
      <td className="px-3 py-4 w-36">
        <input
          type="number"
          min={1}
          max={120}
          value={section.durationMinutes}
          onChange={(e) => onUpdate(index, { durationMinutes: Math.max(1, parseInt(e.target.value, 10) || 1) })}
          disabled={section.isDefaultLocked}
          className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
            section.isDefaultLocked
              ? 'border-border/40 bg-muted/70 text-muted-foreground/90 cursor-not-allowed hover:cursor-not-allowed'
              : 'border-border bg-background text-foreground'
          }`}
        />
      </td>
      <td className="px-3 py-4 w-28">
        <button
          type="button"
          role="switch"
          aria-checked={section.visible}
          aria-disabled={section.isDefaultLocked}
          onClick={() => !section.isDefaultLocked && onUpdate(index, { visible: !section.visible })}
          disabled={section.isDefaultLocked}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
            section.isDefaultLocked
              ? 'cursor-not-allowed hover:cursor-not-allowed opacity-70 bg-muted/80 border-border text-muted-foreground/80'
              : 'cursor-pointer'
          } ${
            section.visible ? 'bg-primary border-primary' : 'bg-muted border-border'
          }`}
        >
          <span
            className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
              section.visible ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </td>
      <td className="px-2 py-4 w-10 text-center">
        {section.isDefaultLocked ? (
          <Lock className="w-4 h-4 text-muted-foreground shrink-0 inline" aria-label="Locked (cannot edit)" />
        ) : (
          <Pencil className="w-4 h-4 text-primary shrink-0 inline" aria-label="Editable" />
        )}
      </td>
      <td className="px-2 py-4 w-20">
        {section.isDefaultLocked ? (
          <span
            className="inline-block px-2 py-1 rounded text-sm font-medium bg-muted/70 text-muted-foreground/80 cursor-not-allowed hover:cursor-not-allowed"
            aria-label="Section is locked"
          >
            Edit
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onEditClick(index)}
            className="text-primary hover:text-primary/80 hover:underline text-sm font-medium cursor-pointer"
          >
            Edit
          </button>
        )}
      </td>
    </tr>
  );
}

export default function AgendaEditPage() {
  const params = useParams();
  const router = useRouter();
  const seriesId = params.id as string;
  const [organizationId, setOrganizationId] = useState<string>('');
  const [series, setSeries] = useState<MeetingSeries | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [sections, setSections] = useState<SectionTemplateItem[]>([]);
  const [savedSections, setSavedSections] = useState<SectionTemplateItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [teamId, setTeamId] = useState<string>('');
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);
  const [orgRole, setOrgRole] = useState<string | null>(null);

  const isAdminOrManager = orgRole === 'ADMIN' || orgRole === 'MANAGER';

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('organizationRole') : null;
    setOrgRole(stored ?? null);
    const onRoleChange = (e: CustomEvent<{ role?: string }>) => {
      setOrgRole(e.detail?.role ?? null);
    };
    window.addEventListener('organizationRoleChanged', onRoleChange as EventListener);
    return () => window.removeEventListener('organizationRoleChanged', onRoleChange as EventListener);
  }, []);

  useEffect(() => {
    if (orgRole != null && !isAdminOrManager) {
      router.replace(ROUTES.MEETINGS_UPCOMING);
      return;
    }
  }, [orgRole, isAdminOrManager, router]);

  const loadSeries = useCallback(async () => {
    const orgId = typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null;
    if (!orgId || !seriesId) return;
    setOrganizationId(orgId);
    setLoading(true);
    try {
      const data = await meetingSeriesService.get(orgId, seriesId);
      setSeries(data);
      setTeamId(data.teamId);
      const template = (data.sectionTemplate as SectionTemplateItem[] | null | undefined);
      const list = template && Array.isArray(template) && template.length > 0
        ? [...template].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((s, i) => ({ ...s, order: i }))
        : DEFAULT_SECTION_TEMPLATE.map((s, i) => ({ ...s, order: i }));
      setSections(list);
      setSavedSections(list);
    } catch {
      setSeries(null);
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  useEffect(() => {
    if (!organizationId) return;
    teamsService.list(organizationId).then(setTeams).catch(() => setTeams([]));
  }, [organizationId]);

  const updateSection = (index: number, patch: Partial<SectionTemplateItem>) => {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = Number(String(active.id).replace('section-', ''));
      const newIndex = Number(String(over.id).replace('section-', ''));
      if (!Number.isNaN(oldIndex) && !Number.isNaN(newIndex)) {
        setSections((prev) => arrayMove(prev, oldIndex, newIndex).map((s, i) => ({ ...s, order: i })));
        setSelectedSectionIndex((prev) => {
          if (prev === oldIndex) return newIndex;
          if (prev !== null && prev > oldIndex && prev <= newIndex) return prev - 1;
          if (prev !== null && prev < oldIndex && prev >= newIndex) return prev + 1;
          return prev;
        });
      }
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSave = async () => {
    if (!organizationId || !seriesId) return;
    setSaving(true);
    try {
      const updated = await meetingSeriesService.update(organizationId, seriesId, {
        sectionTemplate: sections.map((s, i) => ({ ...s, order: i })),
        ...(teamId && series?.teamId !== teamId ? {} : {}), // team change could be added later
      });
      setSavedSections([...sections].map((s, i) => ({ ...s, order: i })));
      setSeries(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleUndoAll = () => {
    if (savedSections) setSections(savedSections.map((s, i) => ({ ...s, order: i })));
    setMenuOpen(false);
  };

  const handleResetToDefault = () => {
    setSections(DEFAULT_SECTION_TEMPLATE.map((s, i) => ({ ...s, order: i })));
    setMenuOpen(false);
  };

  const totalMinutes = getTotalDuration(sections);
  const hasChanges = savedSections
    ? JSON.stringify(sections.map((s, i) => ({ ...s, order: i }))) !== JSON.stringify(savedSections.map((s, i) => ({ ...s, order: i })))
    : false;

  if (loading || !series) {
    return (
      <div className="p-8">
        {loading ? <p className="text-muted-foreground">Loading…</p> : <p className="text-muted-foreground">Agenda not found.</p>}
      </div>
    );
  }

  return (
    <>
      {/* Full-width white header: Back link → Title + Team filter → Save / 3-dot / Print */}
      <div className="w-full bg-card border-b border-border">
        <div className="px-6 py-4">
          <Link
            href={ROUTES.MEETINGS_AGENDAS}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {series.team?.name ?? 'Team'} Flight Plan
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Editing {series.name}</h1>
              <div className="mt-1">
                <label className="text-sm text-muted-foreground mr-2">Team:</label>
                <Select
                  value={teamId || undefined}
                  onChange={(v) => setTeamId(v ?? '')}
                  options={teams.map((t) => ({ label: t.name, value: t.id }))}
                  className="min-w-[180px]"
                  disabled
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !hasChanges}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="p-2 rounded-md border border-border hover:bg-accent text-foreground"
                  aria-label="More options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                    <div className="absolute right-0 top-full mt-1 py-1 bg-card border border-border rounded-lg shadow-lg z-20 min-w-[180px]">
                      <button
                        type="button"
                        onClick={handleUndoAll}
                        className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent"
                      >
                        Undo all changes
                      </button>
                      <button
                        type="button"
                        onClick={handleResetToDefault}
                        className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent"
                      >
                        Reset to default
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-accent text-sm font-medium"
              >
                <Printer className="w-4 h-4" />
                Print Meeting Agenda
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Spacing then drag-drop / edit section: single column (centered, wide) or 2-column when a row Edit is clicked. DndContext wraps table from outside to avoid invalid <div> inside <table>. */}
      <div className={`p-6 flex flex-col md:flex-row gap-6 ${selectedSectionIndex === null ? 'justify-center items-center' : 'max-w-full'}`}>
        <div className={`border border-border rounded-xl bg-card overflow-hidden w-full ${selectedSectionIndex === null ? 'max-w-6xl' : 'flex-1 min-w-0'}`}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="w-8 px-2 py-4" />
                  <th className="px-3 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Section Name</th>
                  <th className="px-3 py-4 w-36 text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration (minutes)</th>
                  <th className="px-3 py-4 w-28 text-xs font-medium text-muted-foreground uppercase tracking-wider">Visible</th>
                  <th className="w-10 px-2 py-4" />
                  <th className="w-20 px-2 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Edit</th>
                </tr>
              </thead>
              <SortableContext items={sections.map((_, i) => `section-${i}`)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {sections.map((section, index) => (
                    <SortableRow
                      key={`section-${index}`}
                      section={section}
                      index={index}
                      onUpdate={updateSection}
                      onEditClick={setSelectedSectionIndex}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
          <div className="flex items-center justify-end border-t border-border px-4 py-3 bg-muted/20">
            <div className="text-sm font-medium text-foreground">
              Total Duration: {formatDuration(totalMinutes)}
            </div>
          </div>
        </div>

        {/* Right column: section detail editor (subtitle + details) when a row Edit is clicked */}
        {selectedSectionIndex !== null && sections[selectedSectionIndex] && (
          <div className="w-full md:w-[420px] shrink-0 border border-border rounded-xl bg-card overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3 bg-muted/20">
              <button
                type="button"
                onClick={() => setSelectedSectionIndex(null)}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                aria-label="Back to list"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="h-5 w-px bg-border" />
              <h2 className="font-semibold text-foreground uppercase tracking-wide">
                {sections[selectedSectionIndex].title}
              </h2>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Subtitle</label>
                <input
                  type="text"
                  value={sections[selectedSectionIndex].subtitle ?? ''}
                  onChange={(e) => updateSection(selectedSectionIndex, { subtitle: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Section subtitle"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Section Details</label>
                <RichTextEditor
                  value={sections[selectedSectionIndex].details ?? ''}
                  onChange={(value) => updateSection(selectedSectionIndex, { details: value })}
                  placeholder="Section Details..."
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
