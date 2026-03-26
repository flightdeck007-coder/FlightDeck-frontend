'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMeetingSocket } from '@/contexts/MeetingSocketContext';
import { Select, Input } from 'antd';
import {
  MoreVertical,
  MoreHorizontal,
  CheckCircle2,
  Circle,
  Mountain,
  CheckSquare,
  AlertCircle,
  Megaphone,
  Archive,
  Link2,
  Trash2,
  RotateCw,
  FileDown,
  Download,
  Package,
  ChevronDown,
  ChevronUp,
  LayoutList,
  LayoutGrid,
  Paperclip,
  Settings,
  Loader2,
  X,
  User,
} from 'lucide-react';
import { useIssues, type IssueItem } from '@/contexts/IssuesContext';
import { ContentAreaLoader } from '@/components/ui/loaders';
import { formatDate } from '@/lib/formatDate';
import { RichTextEditor } from '@/components/meeting/RichTextEditor';
import { teamsService } from '@/lib/api/teams.service';
import type { TeamMember } from '@/lib/api/teams.service';
import { issuesService } from '@/lib/api/issues.service';
import { toast } from 'sonner';

const MENU_WIDTH = 248;
const MENU_GAP = 8;
const PAGE_SIZES = [10, 25, 50];

function linkedEntityTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Item';
  const map: Record<string, string> = {
    issue: 'Turbulence',
    rock: 'Waypoint',
    todo: 'Clearance',
    headline: 'Announcement',
    cascading_message: 'Flight Directive',
  };
  return map[type] ?? type;
}

function getLinkedCreateOptions(item: IssueItem, target: CreatePopupType) {
  const linkedEntity = { type: 'issue' as const, id: item.id, title: item.title };
  const details = [
    `Linked turbulence: ${item.title}`,
    item.priority ? `Priority: ${item.priority}` : null,
  ].filter(Boolean);
  const description = details.join('\n');
  if (target === 'rock') return { title: `Waypoint: ${item.title}`, description, linkedEntity };
  if (target === 'todo') return { title: `Clearance: ${item.title}`, description, linkedEntity };
  if (target === 'issue') return { title: `Turbulence: ${item.title}`, description, linkedEntity };
  if (target === 'headline') return { title: `Announcement: ${item.title}`, description, linkedEntity };
  return { title: item.title, description, linkedEntity };
}

type CreatePopupType = 'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message';

interface IssuesSegmentViewProps {
  teamName?: string;
  /** Flight crew id (for edit-panel member fetch) */
  teamId?: string | null;
  /** Teams list (reserved for future team switching in edit) */
  teams?: Array<{ id: string; name: string }>;
  organizationId?: string | null;
  embedded?: boolean;
  meetingId?: string;
  isFacilitator?: boolean;
  /** Scribe or facilitator can change filters and create (recording) */
  canRecord?: boolean;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; issueInterval?: 'short' | 'long'; linkedEntity?: { type: 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message'; id: string; title: string } }) => void;
  onOpenCreateIssue?: () => void;
}

function FilterIconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      aria-label={label}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

export function IssuesSegmentView({
  teamName = 'No team found',
  teamId: contextTeamId,
  organizationId,
  embedded = false,
  meetingId,
  isFacilitator = true,
  canRecord,
  onOpenCreate,
  onOpenCreateIssue,
}: IssuesSegmentViewProps) {
  const canUseFilters = canRecord ?? isFacilitator;
  const [teamFilter, setTeamFilter] = useState(teamName);
  const [archiveOn, setArchiveOn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'short_term' | 'long_term' | 'completed'>('short_term');
  const [layout, setLayout] = useState<'list' | 'column'>('list');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [page, setPage] = useState(0);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState<{
    sourceIssueId: string;
    sourceTermType: 'short_term' | 'long_term';
    targetTermType: 'short_term' | 'long_term';
  } | null>(null);

  const { socket } = useMeetingSocket();

  useEffect(() => {
    if (!socket || !meetingId) return;
    const onIssuesFilter = (payload: {
      teamFilter?: string;
      archiveOn?: boolean;
      searchQuery?: string;
      activeTab?: 'short_term' | 'long_term' | 'completed';
      layout?: 'list' | 'column';
    }) => {
      if (payload.teamFilter !== undefined) setTeamFilter(payload.teamFilter);
      if (payload.archiveOn !== undefined) setArchiveOn(payload.archiveOn);
      if (payload.searchQuery !== undefined) setSearchQuery(payload.searchQuery);
      if (payload.activeTab !== undefined) setActiveTab(payload.activeTab);
      if (payload.layout !== undefined) setLayout(payload.layout);
    };
    socket.on('issues_filter', onIssuesFilter);
    return () => {
      socket.off('issues_filter', onIssuesFilter);
      return;
    };
  }, [socket, meetingId]);

  const {
    shortTerm,
    longTerm,
    shortTermResolved,
    longTermResolved,
    updateIssue,
    deleteIssue,
    setResolved,
    makeLongTerm,
    refetch,
    isLoading,
  } = useIssues();

  const allIssues = useMemo(
    () => [...shortTerm, ...longTerm, ...shortTermResolved, ...longTermResolved],
    [shortTerm, longTerm, shortTermResolved, longTermResolved]
  );

  const currentList = useMemo(() => {
    if (archiveOn) {
      const combined = [...shortTermResolved, ...longTermResolved];
      combined.sort((a, b) => (b.resolvedAt && a.resolvedAt ? new Date(b.resolvedAt).getTime() - new Date(a.resolvedAt).getTime() : 0));
      return combined;
    }
    if (activeTab === 'short_term') return shortTerm;
    if (activeTab === 'long_term') return longTerm;
    // Completed: all resolved for this meeting (short + long), newest first
    const combined = [...shortTermResolved, ...longTermResolved];
    combined.sort((a, b) => (b.resolvedAt && a.resolvedAt ? new Date(b.resolvedAt).getTime() - new Date(a.resolvedAt).getTime() : 0));
    return combined;
  }, [archiveOn, activeTab, shortTerm, longTerm, shortTermResolved, longTermResolved]);

  const filteredList = useMemo(() => {
    let list = [...currentList];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }
    return list;
  }, [currentList, searchQuery]);

  const totalItems = filteredList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, currentPage, itemsPerPage]);

  const mergeSourceIssue = useMemo(
    () => (mergeMode ? allIssues.find((i) => i.id === mergeMode.sourceIssueId) ?? null : null),
    [mergeMode, allIssues]
  );

  const performMergeInto = async (targetIssue: IssueItem) => {
    if (!organizationId || !mergeMode || !mergeSourceIssue) return;
    if (targetIssue.id === mergeSourceIssue.id) return;
    const combine = (a?: string | null, b?: string | null) => {
      const left = (a ?? '').trim();
      const right = (b ?? '').trim();
      if (left && right) return `${left} / ${right}`;
      return left || right || '';
    };
    const mergedTitle = combine(targetIssue.title, mergeSourceIssue.title);
    const mergedDescription = combine(targetIssue.description ?? '', mergeSourceIssue.description ?? '');
    try {
      await issuesService.update(
        organizationId,
        targetIssue.id,
        {
          title: mergedTitle,
          description: mergedDescription || null,
        },
        meetingId
      );
      await issuesService.delete(organizationId, mergeSourceIssue.id, meetingId);
      await refetch();
      setMergeMode(null);
      toast.success('Turbulence merged successfully');
    } catch {
      toast.error('Failed to merge turbulence');
    }
  };

  const wrap = embedded ? 'pt-0 pb-0' : 'pt-0 pb-0';
  const contentPad = embedded ? 'px-4' : 'px-6';
  return (
    <div className={`flex flex-col min-h-0 h-full ${wrap}`}>
      {/* Filter bar — full width */}
      <div className="flex flex-wrap items-center gap-3 py-3 -mx-6 px-4 border-t border-b border-border bg-muted/30 shrink-0">
        <div className={`flex items-center gap-1 ${!canUseFilters ? 'dark:[&_.ant-select-selector]:bg-zinc-600/60 dark:[&_.ant-select-selector]:text-zinc-300' : ''}`}>
          <span className="text-muted-foreground text-sm">Flight Crew:</span>
          <Select
            value={teamFilter}
            onChange={(v) => {
              setTeamFilter(v);
              if (meetingId && socket) socket.emit('issues_filter', { meetingId, teamFilter: v });
            }}
            disabled={!canUseFilters}
            options={[{ label: teamName, value: teamName }]}
            className="w-[160px]"
          />
        </div>
        <label className={`flex items-center gap-2 group ${!canUseFilters ? 'cursor-not-allowed opacity-70 dark:[&_span]:text-zinc-300 dark:opacity-90' : 'cursor-pointer'}`}>
          <span className="text-sm text-foreground group-hover:text-foreground/90">Archive</span>
          <button
            type="button"
            role="switch"
            aria-checked={archiveOn}
            disabled={!canUseFilters}
            onClick={() => {
              setArchiveOn((o) => {
                const next = !o;
                if (meetingId && socket) socket.emit('issues_filter', { meetingId, archiveOn: next });
                return next;
              });
            }}
            className={`relative w-11 h-6 rounded-full transition-colors border-2 flex items-center ${!canUseFilters ? 'cursor-not-allowed dark:opacity-80' : ''} ${
              archiveOn
                ? 'bg-primary border-primary justify-end'
                : 'bg-muted border-border justify-start hover:bg-muted/80'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow border border-border shrink-0 m-0.5" />
          </button>
        </label>
        <span className="flex-1" />
        <button
          type="button"
          onClick={canUseFilters ? () => refetch() : undefined}
          disabled={!canUseFilters}
          className={`p-2 rounded-lg transition-colors ${!canUseFilters ? 'cursor-not-allowed opacity-70 text-muted-foreground dark:bg-zinc-600/60 dark:text-zinc-300' : 'hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer'}`}
          aria-label="Refresh"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={!canUseFilters}
          className={`p-2 rounded-lg transition-colors ${!canUseFilters ? 'cursor-not-allowed opacity-70 text-muted-foreground dark:bg-zinc-600/60 dark:text-zinc-300' : 'hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer'}`}
          aria-label="Export PDF"
        >
          <FileDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={!canUseFilters}
          className={`p-2 rounded-lg transition-colors ${!canUseFilters ? 'cursor-not-allowed opacity-70 text-muted-foreground dark:bg-zinc-600/60 dark:text-zinc-300' : 'hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer'}`}
          aria-label="Download"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={!canUseFilters}
          className={`p-2 rounded-lg transition-colors ${!canUseFilters ? 'cursor-not-allowed opacity-70 text-muted-foreground dark:bg-zinc-600/60 dark:text-zinc-300' : 'hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer'}`}
          aria-label="Archive all completed"
        >
          <Package className="w-4 h-4" />
        </button>
        <div className={`min-w-[200px] ${!canUseFilters ? 'dark:[&_.ant-input]:bg-zinc-600/60 dark:[&_.ant-input]:text-zinc-300' : ''}`}>
          <Input.Search
            placeholder="Search Turbulence | Flight Review..."
            value={searchQuery}
            onChange={(e) => {
              const v = e.target.value;
              setSearchQuery(v);
              if (meetingId && socket) socket.emit('issues_filter', { meetingId, searchQuery: v });
            }}
            disabled={!canUseFilters}
            allowClear
            className="w-full"
          />
        </div>
        <button
          type="button"
          disabled={!canUseFilters}
          className={`p-2 rounded-lg transition-colors ${!canUseFilters ? 'cursor-not-allowed opacity-70 text-muted-foreground dark:bg-zinc-600/60 dark:text-zinc-300' : 'hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer'}`}
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Short-Term / Long-Term tabs attached to header — no space from top or left/right */}
      <div className="flex gap-1 border-b border-border shrink-0 -mx-6 px-6 bg-background">
        <button
          type="button"
          disabled={!canUseFilters}
          onClick={() => {
            setActiveTab('short_term');
            if (meetingId && socket) socket.emit('issues_filter', { meetingId, activeTab: 'short_term' });
          }}
          className={`px-8 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px ${!canUseFilters ? 'cursor-not-allowed opacity-70 dark:bg-zinc-600/50 dark:text-zinc-300' : ''} ${
            activeTab === 'short_term'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          Short-Term
        </button>
        <button
          type="button"
          disabled={!canUseFilters}
          onClick={() => {
            setActiveTab('long_term');
            if (meetingId && socket) socket.emit('issues_filter', { meetingId, activeTab: 'long_term' });
          }}
          className={`px-8 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px ${!canUseFilters ? 'cursor-not-allowed opacity-70 dark:bg-zinc-600/50 dark:text-zinc-300' : ''} ${
            activeTab === 'long_term'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          Long-Term
        </button>
        {meetingId && (
          <button
            type="button"
            disabled={!canUseFilters}
            onClick={() => {
              setActiveTab('completed');
              if (socket) socket.emit('issues_filter', { meetingId, activeTab: 'completed' });
            }}
            className={`px-8 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px ${!canUseFilters ? 'cursor-not-allowed opacity-70 dark:bg-zinc-600/50 dark:text-zinc-300' : ''} ${
              activeTab === 'completed'
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            Completed ({shortTermResolved.length + longTermResolved.length})
          </button>
        )}
      </div>

      {/* Content: centered 80% width with large space between sections */}
      {isLoading ? (
        <ContentAreaLoader label="Loading issues…" />
      ) : (
      <div className="flex-1 overflow-auto min-h-0">
        <div className={`w-[80%] max-w-full mx-auto pt-3 ${contentPad}`}>

      {/* Content card — spacing from space-y-16 above */}
      <div className="flex-1 min-h-0 bg-card border border-border rounded-lg flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-foreground">
            {archiveOn
              ? 'Archived'
              : activeTab === 'short_term'
              ? 'Short-Term'
              : activeTab === 'long_term'
                ? 'Long-Term'
                : 'Completed'}{' '}
            {currentList.length}
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5">
              <button
                type="button"
                disabled={!canUseFilters}
                onClick={() => {
                  setLayout('list');
                  if (meetingId && socket) socket.emit('issues_filter', { meetingId, layout: 'list' });
                }}
                className={`p-1.5 rounded transition-colors ${!canUseFilters ? 'cursor-not-allowed opacity-70 dark:bg-zinc-600/60 dark:text-zinc-300' : ''} ${
                  layout === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                }`}
                title="List view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={!canUseFilters}
                onClick={() => {
                  setLayout('column');
                  if (meetingId && socket) socket.emit('issues_filter', { meetingId, layout: 'column' });
                }}
                className={`p-1.5 rounded transition-colors ${!canUseFilters ? 'cursor-not-allowed opacity-70 dark:bg-zinc-600/60 dark:text-zinc-300' : ''} ${
                  layout === 'column' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                }`}
                title="2-column grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto flex-1 relative">
          {mergeMode && (
            <div className="mx-4 mt-3 mb-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
              <span className="font-medium">Merge mode:</span>{' '}
              Select a {mergeMode.targetTermType === 'long_term' ? 'Long-Term' : 'Short-Term'} turbulence row to merge{' '}
              <span className="font-semibold">"{mergeSourceIssue?.title ?? 'selected item'}"</span> into it.
              <button
                type="button"
                onClick={() => setMergeMode(null)}
                className="ml-3 text-primary hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
          {isLoading && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Loading" />
            </div>
          )}
          {layout === 'column' ? (
            <div className="grid grid-cols-2 gap-4 p-4">
              {pageItems.map((item) => (
                <IssueCard
                  key={item.id}
                  item={item}
                  onEdit={() => setSelectedIssueId(item.id)}
                  onRowOpen={() => setSelectedIssueId(item.id)}
                  onToggleResolved={(resolved) => setResolved(item.id, resolved)}
                  onPriorityChange={(priority) => updateIssue(item.id, { priority })}
                  onArchive={() => setResolved(item.id, !item.resolvedAt)}
                  onDelete={() => deleteIssue(item.id)}
                  onMakeLongTerm={activeTab === 'short_term' ? () => makeLongTerm(item.id) : undefined}
                  onOpenCreate={onOpenCreate}
                  onMergeIntoAnother={() => {
                    const targetTermType = item.termType === 'short_term' ? 'long_term' : 'short_term';
                    setMergeMode({
                      sourceIssueId: item.id,
                      sourceTermType: item.termType,
                      targetTermType,
                    });
                    setActiveTab(targetTermType);
                  }}
                  mergeModeActive={!!mergeMode}
                  onMergeSelectTarget={() => performMergeInto(item)}
                  isMergeTarget={
                    !!mergeMode &&
                    mergeMode.targetTermType === item.termType &&
                    mergeMode.sourceIssueId !== item.id
                  }
                />
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-10 px-4 py-2" />
                  <th className="text-left font-medium text-foreground px-4 py-2">Title</th>
                  <th className="text-left font-medium text-foreground px-4 py-2 w-16">#</th>
                  <th className="text-left font-medium text-foreground px-4 py-2 w-24">Created</th>
                  <th className="text-left font-medium text-foreground px-4 py-2 w-20">Owner</th>
                  <th className="text-right font-medium text-foreground px-4 py-2 w-14" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
                  <IssueRow
                    key={item.id}
                    item={item}
                    onEdit={() => setSelectedIssueId(item.id)}
                    onRowOpen={() => setSelectedIssueId(item.id)}
                    onToggleResolved={(resolved) => setResolved(item.id, resolved)}
                    onPriorityChange={(priority) => updateIssue(item.id, { priority })}
                    onArchive={() => setResolved(item.id, !item.resolvedAt)}
                    onDelete={() => deleteIssue(item.id)}
                    onMakeLongTerm={activeTab === 'short_term' ? () => makeLongTerm(item.id) : undefined}
                    onOpenCreate={onOpenCreate}
                    onMergeIntoAnother={() => {
                      const targetTermType = item.termType === 'short_term' ? 'long_term' : 'short_term';
                      setMergeMode({
                        sourceIssueId: item.id,
                        sourceTermType: item.termType,
                        targetTermType,
                      });
                      setActiveTab(targetTermType);
                    }}
                    mergeModeActive={!!mergeMode}
                    onMergeSelectTarget={() => performMergeInto(item)}
                    isMergeTarget={
                      !!mergeMode &&
                      mergeMode.targetTermType === item.termType &&
                      mergeMode.sourceIssueId !== item.id
                    }
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-3 border-t border-border flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={
              onOpenCreate
                ? () =>
                    onOpenCreate('issue', {
                      issueInterval: activeTab === 'long_term' ? 'long' : 'short',
                    })
                : onOpenCreateIssue
            }
            className="text-primary hover:underline text-sm font-medium hover:text-primary/90 transition-colors cursor-pointer"
          >
            + Add Turbulence
          </button>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              Items per page:
              <Select
                value={itemsPerPage}
                onChange={(v) => {
                  setItemsPerPage(v);
                  setPage(0);
                }}
                options={PAGE_SIZES.map((n) => ({ label: String(n), value: n }))}
                className="w-[70px]"
              />
            </span>
            <span>
              {totalItems === 0
                ? '0-0 of 0'
                : `${currentPage * itemsPerPage + 1}-${Math.min(
                    (currentPage + 1) * itemsPerPage,
                    totalItems
                  )} of ${totalItems}`}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setPage(0)}
                disabled={currentPage === 0}
                className="p-1.5 rounded hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                aria-label="First page"
              >
                |
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="p-1.5 rounded hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Previous"
              >
                &lt;
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="p-1.5 rounded hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Next"
              >
                &gt;
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages - 1)}
                disabled={currentPage >= totalPages - 1}
                className="p-1.5 rounded hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Last page"
              >
                |
              </button>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
      )}
      {selectedIssueId && (() => {
        const issue = allIssues.find((i) => i.id === selectedIssueId);
        return issue ? (
          <IssueDetailPanel
            issue={issue}
            teamName={teamName}
            organizationId={organizationId}
            teamId={contextTeamId}
            onClose={() => setSelectedIssueId(null)}
            onUpdate={(patch) => updateIssue(issue.id, patch)}
            onArchive={() => setResolved(issue.id, !issue.resolvedAt)}
            onDelete={() => {
              deleteIssue(issue.id);
              setSelectedIssueId(null);
            }}
            onMakeLongTerm={activeTab === 'short_term' ? () => makeLongTerm(issue.id) : undefined}
            onOpenCreate={onOpenCreate}
            onToggleResolved={(resolved) => setResolved(issue.id, resolved)}
            onMergeIntoAnother={() => {
              const targetTermType = issue.termType === 'short_term' ? 'long_term' : 'short_term';
              setMergeMode({
                sourceIssueId: issue.id,
                sourceTermType: issue.termType,
                targetTermType,
              });
              setActiveTab(targetTermType);
              setSelectedIssueId(null);
            }}
          />
        ) : null;
      })()}
    </div>
  );
}

function IssueCard({
  item,
  onEdit,
  onRowOpen,
  onToggleResolved,
  onPriorityChange,
  onArchive,
  onDelete,
  onMakeLongTerm,
  onOpenCreate,
  onMergeIntoAnother,
  mergeModeActive,
  onMergeSelectTarget,
  isMergeTarget,
}: {
  item: IssueItem;
  onEdit?: () => void;
  onRowOpen?: () => void;
  onToggleResolved: (resolved: boolean) => void;
  onPriorityChange: (priority: number) => void;
  onArchive: () => void;
  onDelete: () => void;
  onMakeLongTerm?: () => void;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; issueInterval?: 'short' | 'long'; linkedEntity?: { type: 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message'; id: string; title: string } }) => void;
  onMergeIntoAnother?: () => void;
  mergeModeActive?: boolean;
  onMergeSelectTarget?: () => void;
  isMergeTarget?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const resolved = !!item.resolvedAt;
  const openMenu = () => {
    if (buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect());
      setMenuOpen(true);
    }
  };
  return (
    <div
      className={`border border-border rounded-lg p-4 bg-card hover:bg-muted/5 transition-colors flex flex-col gap-3 cursor-pointer ${isMergeTarget ? 'bg-primary/5' : ''}`}
      onClick={mergeModeActive ? (isMergeTarget ? onMergeSelectTarget : undefined) : onRowOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onRowOpen) {
          e.preventDefault();
          onRowOpen();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleResolved(!resolved);
          }}
          className="rounded-full w-6 h-6 flex items-center justify-center hover:bg-muted/80 text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
          aria-label={resolved ? 'Mark unresolved' : 'Mark resolved'}
        >
          {resolved ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>
        <button
          ref={buttonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            menuOpen ? setMenuOpen(false) : openMenu();
          }}
          className="p-1.5 rounded-md hover:bg-muted/80 text-muted-foreground shrink-0"
          aria-label="More actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {onEdit ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
              className="font-medium text-foreground break-words text-left hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
            >
              {item.title}
            </button>
          ) : (
            <span className="font-medium text-foreground break-words">{item.title}</span>
          )}
          {(item.attachmentCount ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-muted-foreground text-xs">
              <Paperclip className="w-3 h-3" />
              {item.attachmentCount}
            </span>
          )}
        </div>
        {item.linkedEntityTitle && (
          <span className="text-xs text-muted-foreground">Linked to: {item.linkedEntityTitle}</span>
        )}
        {resolved && item.resolvedByName && (
          <span className="text-xs text-muted-foreground">Resolved by {item.resolvedByName}</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 mt-auto">
        <Select
          value={item.priority}
          onChange={onPriorityChange}
          onClick={(e) => e.stopPropagation()}
          options={[1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: n }))}
          className="w-[60px]"
        />
        <span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
        <div className="w-7 h-7 rounded-full bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
          {item.ownerInitials}
        </div>
      </div>
      {menuOpen && anchorRect && typeof document !== 'undefined' && (
        <IssueRowMenu
          anchorRect={anchorRect}
          item={item}
          onClose={() => {
            setMenuOpen(false);
            setAnchorRect(null);
          }}
          onArchive={onArchive}
          onDelete={onDelete}
          onMakeLongTerm={onMakeLongTerm}
          onOpenCreate={onOpenCreate}
          onMergeIntoAnother={onMergeIntoAnother}
        />
      )}
    </div>
  );
}

function IssueRow({
  item,
  onEdit,
  onRowOpen,
  onToggleResolved,
  onPriorityChange,
  onArchive,
  onDelete,
  onMakeLongTerm,
  onOpenCreate,
  onMergeIntoAnother,
  mergeModeActive,
  onMergeSelectTarget,
  isMergeTarget,
}: {
  item: IssueItem;
  onEdit?: () => void;
  onRowOpen?: () => void;
  onToggleResolved: (resolved: boolean) => void;
  onPriorityChange: (priority: number) => void;
  onArchive: () => void;
  onDelete: () => void;
  onMakeLongTerm?: () => void;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; issueInterval?: 'short' | 'long'; linkedEntity?: { type: 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message'; id: string; title: string } }) => void;
  onMergeIntoAnother?: () => void;
  mergeModeActive?: boolean;
  onMergeSelectTarget?: () => void;
  isMergeTarget?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const resolved = !!item.resolvedAt;

  const openMenu = () => {
    if (buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect());
      setMenuOpen(true);
    }
  };

  return (
    <>
      <tr
        className={`border-b border-border hover:bg-muted/10 cursor-pointer ${isMergeTarget ? 'bg-primary/5' : ''}`}
        onClick={mergeModeActive ? (isMergeTarget ? onMergeSelectTarget : undefined) : onRowOpen}
      >
        <td className="px-4 py-2 w-10 align-middle">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleResolved(!resolved);
            }}
            className="rounded-full w-6 h-6 flex items-center justify-center hover:bg-muted/80 text-muted-foreground hover:text-foreground"
            aria-label={resolved ? 'Mark unresolved' : 'Mark resolved'}
          >
            {resolved ? (
              <CheckCircle2 className="w-5 h-5 text-primary" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>
        </td>
        <td className="px-4 py-2 font-medium text-foreground align-middle">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              {onEdit ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.();
                  }}
                  className="text-left hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
                >
                  {item.title}
                </button>
              ) : (
                <span>{item.title}</span>
              )}
              {(item.attachmentCount ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 text-muted-foreground text-xs">
                  <Paperclip className="w-3 h-3" />
                  {item.attachmentCount}
                </span>
              )}
            </div>
            {item.linkedEntityTitle && (
              <span className="text-xs text-muted-foreground">Linked to: {item.linkedEntityTitle}</span>
            )}
            {resolved && item.resolvedByName && (
              <span className="text-xs text-muted-foreground">Resolved by {item.resolvedByName}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-2 align-middle">
          <Select
            value={item.priority}
            onChange={onPriorityChange}
            onClick={(e) => e.stopPropagation()}
            options={[1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: n }))}
            className="w-[60px]"
          />
        </td>
        <td className="px-4 py-2 text-muted-foreground align-middle">
          {formatDate(item.createdAt)}
        </td>
        <td className="px-4 py-2 align-middle">
          <div className="w-7 h-7 rounded-full bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-xs font-semibold text-primary">
            {item.ownerInitials}
          </div>
        </td>
        <td className="px-4 py-2 align-middle text-right">
          <button
            ref={buttonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              menuOpen ? setMenuOpen(false) : openMenu();
            }}
            className="p-2 rounded-md hover:bg-muted/80 text-muted-foreground"
            aria-label="More actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && anchorRect && typeof document !== 'undefined' && (
            <IssueRowMenu
              anchorRect={anchorRect}
              item={item}
              onClose={() => {
                setMenuOpen(false);
                setAnchorRect(null);
              }}
              onArchive={onArchive}
              onDelete={onDelete}
              onMakeLongTerm={onMakeLongTerm}
              onOpenCreate={onOpenCreate}
              onMergeIntoAnother={onMergeIntoAnother}
            />
          )}
        </td>
      </tr>
    </>
  );
}

function issueAssigneeInitials(name?: string | null, email?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

function IssueDetailPanel({
  issue,
  teamName,
  organizationId,
  teamId,
  onClose,
  onUpdate,
  onArchive,
  onDelete,
  onMakeLongTerm,
  onOpenCreate,
  onToggleResolved,
  onMergeIntoAnother,
}: {
  issue: IssueItem;
  teamName: string;
  organizationId?: string | null;
  teamId?: string | null;
  onClose: () => void;
  onUpdate: (patch: Partial<IssueItem>) => void;
  onArchive: () => void;
  onDelete: () => void;
  onMakeLongTerm?: () => void;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; issueInterval?: 'short' | 'long'; linkedEntity?: { type: 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message'; id: string; title: string } }) => void;
  onToggleResolved: (resolved: boolean) => void;
  onMergeIntoAnother: () => void;
}) {
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? '');
  const [priority, setPriority] = useState(issue.priority);
  const [createdById, setCreatedById] = useState(issue.createdById ?? '');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [organizationRole, setOrganizationRole] = useState<string | null>(null);
  const [confirmOwnerChangeOpen, setConfirmOwnerChangeOpen] = useState(false);
  const [pendingOwnerId, setPendingOwnerId] = useState<string | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [headerMenuRect, setHeaderMenuRect] = useState<DOMRect | null>(null);
  const headerMenuBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTitle(issue.title);
    setDescription(issue.description ?? '');
    setPriority(issue.priority);
    setCreatedById(issue.createdById ?? '');
  }, [issue.id, issue.title, issue.description, issue.priority, issue.createdById]);

  useEffect(() => {
    if (!organizationId || !teamId) {
      setTeamMembers([]);
      return;
    }
    Promise.allSettled([
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
  }, [organizationId, teamId, ownerPickerOpen]);

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

  const headerInitials = useMemo(() => {
    if (!createdById) return issue.ownerInitials;
    const m = teamMembers.find((x) => (x.user?.id ?? x.userId) === createdById);
    const u = m?.user;
    if (u) return issueAssigneeInitials(u.name, u.email);
    return issue.ownerInitials;
  }, [createdById, teamMembers, issue.ownerInitials]);

  const ownerName = useMemo(() => {
    if (!createdById) return 'No owner';
    const m = teamMembers.find((x) => (x.user?.id ?? x.userId) === createdById);
    return m?.user?.name || m?.user?.email || 'No owner';
  }, [createdById, teamMembers]);

  const ownerCandidates = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase();
    return teamMembers.filter((m) => {
      if (!q) return true;
      const label = `${m.user?.name ?? ''} ${m.user?.email ?? ''}`.toLowerCase();
      return label.includes(q);
    });
  }, [teamMembers, ownerSearch]);

  const isAdmin = organizationRole === 'ADMIN';
  const resolved = !!issue.resolvedAt;

  const openHeaderMenu = () => {
    if (!headerMenuBtnRef.current) return;
    setHeaderMenuRect(headerMenuBtnRef.current.getBoundingClientRect());
    setHeaderMenuOpen(true);
  };

  useEffect(() => {
    if (!headerMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHeaderMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [headerMenuOpen]);

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
    setCreatedById(nextOwnerId);
    onUpdate({
      createdById: nextOwnerId || null,
    });
    setOwnerPickerOpen(false);
    setOwnerSearch('');
    setConfirmOwnerChangeOpen(false);
    setPendingOwnerId(null);
  };

  const handleSave = (andClose = false) => {
    onUpdate({
      title,
      description: description || undefined,
      priority,
      createdById: createdById ? createdById : null,
    });
    if (andClose) onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 right-0 w-[42%] min-w-[380px] max-w-[620px] bg-card border-l border-border shadow-xl z-50 flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleResolved(!resolved)}
              className="rounded-full w-6 h-6 flex items-center justify-center hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              aria-label={resolved ? 'Mark unresolved' : 'Mark resolved'}
            >
              {resolved ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : (
                <Circle className="w-5 h-5" />
              )}
            </button>
            <h2 className="font-semibold text-foreground">Edit Turbulence</h2>
          </div>
          <div className="flex items-center gap-2 relative">
            <button
              ref={headerMenuBtnRef}
              type="button"
              onClick={() => (headerMenuOpen ? setHeaderMenuOpen(false) : openHeaderMenu())}
              className="p-2.5 rounded-md hover:bg-muted text-muted-foreground"
              aria-label="More options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {headerMenuOpen && headerMenuRect && typeof document !== 'undefined' && (
              <IssueRowMenu
                anchorRect={headerMenuRect}
                item={issue}
                onClose={() => setHeaderMenuOpen(false)}
                onArchive={onArchive}
                onDelete={() => {
                  setHeaderMenuOpen(false);
                  onDelete();
                }}
                onMakeLongTerm={onMakeLongTerm}
                onOpenCreate={onOpenCreate}
                showMoveActions={false}
                overlayZIndex={55}
                menuZIndex={56}
                onMergeIntoAnother={onMergeIntoAnother}
              />
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOwnerPickerOpen((v) => !v)}
                className="w-9 h-9 rounded-full bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-xs font-semibold text-primary hover:bg-primary/20"
                title={`Owner: ${ownerName}`}
                aria-label="Change owner"
              >
                {headerInitials}
              </button>
              {ownerPickerOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOwnerPickerOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full mt-2 z-20 w-[280px] bg-card border border-border rounded-lg shadow-xl p-2">
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
                        const initials = issueAssigneeInitials(m.user?.name, m.user?.email);
                        const isSelected = createdById === uid;
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
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground hidden">
              {headerInitials}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-md hover:bg-muted text-muted-foreground"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Description (optional)
            </label>
            <RichTextEditor
              value={description}
              onChange={(v) => setDescription(v)}
              className="min-h-[120px]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
              <Select
                value={priority}
                onChange={setPriority}
                options={[1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: n }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Who (optional)</label>
              <Select
                value={createdById || undefined}
                onChange={(v) => setCreatedById(v ?? '')}
                allowClear
                placeholder="No owner"
                disabled={!organizationId || !teamId}
                options={teamMembers.map((m) => ({
                  label: m.user?.name || m.user?.email || m.userId,
                  value: m.user?.id ?? m.userId,
                }))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optionally choose an owner from this flight crew.
              </p>
            </div>
          </div>
          <div className="border-t border-border" />
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Team</label>
            <Select
              options={[{ label: teamName, value: 'crew' }]}
              value="crew"
              disabled
              className="w-full"
            />
          </div>
          <div className="border-t border-border" />
          <section className="pt-6 mt-6 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-foreground">Linked Items {issue.linkedEntityTitle ? 1 : 0}</h4>
              <button type="button" className="text-sm text-primary hover:underline">
                Edit
              </button>
            </div>
            {issue.linkedEntityTitle ? (
              <div className="border border-border rounded-lg bg-muted/30 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Link2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                      {linkedEntityTypeLabel(issue.linkedEntityType)}
                    </p>
                    <p className="text-sm font-semibold text-foreground break-words">
                      {issue.linkedEntityTitle}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <button type="button" className="text-sm text-primary hover:underline">
                + Linked Item
              </button>
            )}
          </section>
          <section className="pt-6 mt-6 border-t border-border">
            <h4 className="font-medium text-foreground mb-3">Attachments 0</h4>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
              Drag and drop files to attach, or{' '}
              <button type="button" className="text-primary hover:underline">
                browse
              </button>
            </div>
          </section>
          <section className="pt-6 mt-6 border-t border-border">
            <h4 className="font-medium text-foreground mb-3">Comments 0</h4>
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-foreground shrink-0">
                {headerInitials}
              </div>
              <input
                type="text"
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2.5 border border-border rounded-md bg-background text-foreground text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground text-right mt-2">0/10000</p>
          </section>
        </div>
        <footer className="px-6 py-4 border-t border-border shrink-0 space-y-3">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-border bg-background text-foreground text-sm font-medium hover:bg-muted cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 cursor-pointer"
            >
              Save
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Created by {headerInitials} on {formatDate(issue.createdAt)} ·{' '}
            <span className="inline-flex items-center gap-1">
              ✔ Following <User className="w-3 h-3" />
            </span>
          </p>
        </footer>
      </div>
      {confirmOwnerChangeOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-[60]"
            onClick={() => {
              setConfirmOwnerChangeOpen(false);
              setPendingOwnerId(null);
            }}
            aria-hidden
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-full max-w-sm bg-card border border-border rounded-lg shadow-xl p-5">
            <h3 className="text-base font-semibold text-foreground mb-2">Change owner?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Only admins can change owner. Confirm this owner update.
            </p>
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
    </>
  );
}

function IssueRowMenu({
  anchorRect,
  item,
  onClose,
  onArchive,
  onDelete,
  onMakeLongTerm,
  onOpenCreate,
  showMoveActions = true,
  overlayZIndex = 40,
  menuZIndex = 50,
  onMergeIntoAnother,
}: {
  anchorRect: DOMRect;
  item: IssueItem;
  onClose: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onMakeLongTerm?: () => void;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; issueInterval?: 'short' | 'long'; linkedEntity?: { type: 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message'; id: string; title: string } }) => void;
  showMoveActions?: boolean;
  overlayZIndex?: number;
  menuZIndex?: number;
  onMergeIntoAnother?: () => void;
}) {
  const position = useMemo(() => {
    if (typeof window === 'undefined')
      return { top: anchorRect.top, left: anchorRect.right + MENU_GAP };
    const padding = 8;
    const maxLeft = window.innerWidth - MENU_WIDTH - padding;
    const leftWhenRight = anchorRect.right + MENU_GAP;
    const left =
      leftWhenRight > maxLeft
        ? anchorRect.left - MENU_WIDTH - MENU_GAP
        : leftWhenRight;
    const top = Math.min(
      anchorRect.top,
      Math.max(padding, window.innerHeight - 420)
    );
    return { top, left };
  }, [anchorRect]);

  const btn =
    'w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 rounded-md flex items-center gap-3 transition-colors';
  const icon = 'w-4 h-4 text-muted-foreground shrink-0';

  return createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex: overlayZIndex }} onClick={onClose} aria-hidden />
      <div
        className="fixed py-2 bg-card border border-border rounded-lg shadow-xl min-w-[240px]"
        style={{ top: position.top, left: position.left, zIndex: menuZIndex }}
        role="menu"
        aria-label="Row actions"
      >
        {showMoveActions && (
          <>
            <div className="px-2 py-1">
              <button type="button" className={btn} onClick={onClose} role="menuitem">
                <ChevronUp className={icon} />
                Top of List
              </button>
              <button type="button" className={btn} onClick={onClose} role="menuitem">
                <ChevronDown className={icon} />
                Bottom of List
              </button>
            </div>
            <div className="border-t border-border my-1" />
          </>
        )}
        <div className="px-2 py-1">
          <button type="button" className={btn} onClick={() => { onOpenCreate?.('rock', getLinkedCreateOptions(item, 'rock')); onClose(); }} role="menuitem">
            <Mountain className={icon} />
            Link Waypoint
          </button>
          <button type="button" className={btn} onClick={() => { onOpenCreate?.('todo', getLinkedCreateOptions(item, 'todo')); onClose(); }} role="menuitem">
            <CheckSquare className={icon} />
            Link Clearance
          </button>
          <button type="button" className={btn} onClick={() => { onOpenCreate?.('issue', getLinkedCreateOptions(item, 'issue')); onClose(); }} role="menuitem">
            <AlertCircle className={icon} />
            Link Turbulence
          </button>
          <button type="button" className={btn} onClick={() => { onOpenCreate?.('headline', getLinkedCreateOptions(item, 'headline')); onClose(); }} role="menuitem">
            <Megaphone className={icon} />
            Link Announcement
          </button>
        </div>
        <div className="border-t border-border my-1" />
        <div className="px-2 py-1">
          {onMergeIntoAnother && (
            <button
              type="button"
              className={btn}
              onClick={() => {
                onMergeIntoAnother();
                onClose();
              }}
              role="menuitem"
            >
              {item.termType === 'short_term'
                ? 'Merge into Long-Term Turbulence'
                : 'Merge into Short-Term Turbulence'}
            </button>
          )}
          {onMakeLongTerm && (
            <button
              type="button"
              className={btn}
              onClick={() => {
                onMakeLongTerm();
                onClose();
              }}
              role="menuitem"
            >
              Make Long-Term Turbulence
            </button>
          )}
        </div>
        <div className="border-t border-border my-1" />
        <div className="px-2 py-1">
          <button
            type="button"
            className={btn}
            onClick={() => {
              onArchive();
              onClose();
            }}
            role="menuitem"
          >
            <Archive className={icon} />
            {item.resolvedAt ? 'Unarchive' : 'Archive'}
          </button>
          <button type="button" className={btn} onClick={onClose} role="menuitem">
            <Link2 className={icon} />
            Copy Link
          </button>
        </div>
        <div className="border-t border-border my-1" />
        <div className="px-2 py-1">
          <button
            type="button"
            className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md flex items-center gap-3 transition-colors"
            onClick={() => {
              onDelete();
              onClose();
            }}
            role="menuitem"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            Delete
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
