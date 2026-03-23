'use client';

import { Select, Input } from 'antd';
import { CheckCircle2, Circle, Plus, User } from 'lucide-react';
import { InstrumentsSegmentView } from './InstrumentsSegmentView';
import { RocksSegmentView } from './RocksSegmentView';
import { HeadlinesSegmentView } from './HeadlinesSegmentView';
import { TodosSegmentView } from './TodosSegmentView';
import { IssuesSegmentView } from './IssuesSegmentView';
import { ConcludeSegmentView } from './ConcludeSegmentView';
import { formatDateOrPass } from '@/lib/formatDate';

export type CreatePopupType = 'issue' | 'rock' | 'todo' | 'headline' | 'cascading_message' | 'measurable';

interface MeetingContentProps {
  sectionId: string;
  sectionTitle: string;
  onOpenCreateIssue?: () => void;
  onOpenCreate?: (type: CreatePopupType, options?: { title?: string; description?: string; linkedEntity?: { type: 'rock' | 'todo' | 'issue' | 'headline' | 'cascading_message' | 'measurable' | 'rock_milestone'; id: string; title: string } }) => void;
  onFinishMeeting?: () => Promise<void>;
  finishLoading?: boolean;
  meetingId?: string;
  organizationId?: string;
  isFacilitator?: boolean;
  /** Facilitator or scribe: can use filters and create todos, issues, rocks, headlines */
  canRecord?: boolean;
  facilitatorId?: string | null;
  currentUserId?: string | null;
  meetingAttendances?: Array<{
    id: string;
    present: boolean;
    user: { id: string; name?: string | null; email: string };
  }>;
  /** When true, meeting has not started yet (scheduled in future); scorecard shows read-only grey UI */
  isMeetingInFuture?: boolean;
  /** Meeting's team name (from meeting.team.name); used for todos, headlines, issues segments */
  teamName?: string;
  /** Meeting's team id; used for edit-todo team dropdown */
  teamId?: string | null;
  /** All teams for edit-todo team dropdown (meeting and dashboard) */
  teams?: Array<{ id: string; name: string }>;
}

// Demo data for different sections (L10-style; flight wording in UI)
const demoData: Record<string, any> = {
  segue: {
    type: 'prompt',
    content: 'Share Your Good News',
    empty: true, // component details row is empty for this section
  },
  scorecard: {
    type: 'metrics',
    items: [
      { name: 'Revenue', value: '$125K', trend: '+12%', status: 'good' },
      { name: 'New Customers', value: '24', trend: '+8%', status: 'good' },
      { name: 'Support Tickets', value: '18', trend: '-5%', status: 'good' },
      { name: 'Team Satisfaction', value: '8.5/10', trend: '+0.5', status: 'good' },
    ],
  },
  headlines: {
    type: 'prompt',
    content: 'Flight Announcements',
    empty: true,
  },
  rocks: {
    type: 'list',
    items: [
      { id: '1', title: 'Launch Q4 Marketing Campaign', owner: 'Sarah', status: 'on_track', dueDate: '2024-12-31' },
      { id: '2', title: 'Complete Product Redesign', owner: 'Mike', status: 'on_track', dueDate: '2024-11-15' },
      { id: '3', title: 'Hire 3 New Engineers', owner: 'Lisa', status: 'off_track', dueDate: '2024-10-30' },
    ],
  },
  todos: {
    type: 'list',
    items: [
      { id: '1', title: 'Update resources page', assignee: 'John', status: 'open', created: 'Jul 16' },
      { id: '2', title: 'Client Calls', assignee: 'Sarah', status: 'open', created: 'Sep 13' },
      { id: '3', title: 'Review roles and responsibilities', assignee: 'Mike', status: 'done', created: 'Sep 24' },
      { id: '4', title: 'Website Updates', assignee: 'Lisa', status: 'open', created: 'Oct 1' },
    ],
  },
  issues: {
    type: 'list',
    items: [
      { id: '1', title: 'Update resources page', priority: 5, owner: 'John', created: 'Jul 16', status: 'open' },
      { id: '2', title: 'Client Calls', priority: 3, owner: 'Sarah', created: 'Sep 13', status: 'open' },
      { id: '3', title: 'Review roles and responsibilities', priority: 2, owner: 'Mike', created: 'Sep 24', status: 'resolved' },
      { id: '4', title: 'Website Updates', priority: 4, owner: 'Lisa', created: 'Oct 1', status: 'open' },
    ],
  },
  conclude: {
    type: 'text',
    content: 'Debrief complete. All clearances and action items have been assigned and documented.',
  },
};

export function MeetingContent({ sectionId, sectionTitle, onOpenCreateIssue, onOpenCreate, onFinishMeeting, finishLoading, meetingId, organizationId, isFacilitator, canRecord, facilitatorId, currentUserId, meetingAttendances, isMeetingInFuture, teamName: meetingTeamName, teamId: meetingTeamId, teams: meetingTeams = [] }: MeetingContentProps) {
  const canRecordOrFacilitator = canRecord ?? isFacilitator;
  const data = demoData[sectionId.toLowerCase()] || demoData.segue;
  const isMinimalPrompt = data.type === 'prompt' && data.empty; // Segue, Headlines: prompt + empty only
  const hasFilterBar = ['scorecard', 'rocks', 'headlines', 'todos', 'issues', 'conclude'].includes(sectionId);

  return (
    <div className="h-full flex flex-col">
      {/* Section-specific header/action bar: only when not a minimal prompt and not scorecard/rocks (they use dedicated segment views) */}
      {!isMinimalPrompt && sectionId !== 'scorecard' && sectionId !== 'rocks' && sectionId !== 'headlines' && sectionId !== 'todos' && sectionId !== 'issues' && sectionId !== 'conclude' && (
        <div className="p-6 border-b border-border bg-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">{sectionTitle}</h2>
            <div className="flex items-center gap-2">
              <Select
                value={meetingTeamName ?? 'No team found'}
                options={[{ label: meetingTeamName ?? 'No team found', value: meetingTeamName ?? 'No team found' }]}
                className="min-w-[140px]"
              />
              <label className="flex items-center gap-2 text-sm text-foreground/70">
                <input type="checkbox" className="rounded" />
                Archive
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 border border-border rounded-md hover:bg-accent transition-colors" type="button">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button className="p-2 border border-border rounded-md hover:bg-accent transition-colors" type="button">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <Input
              placeholder={`Search ${sectionTitle}...`}
              className="flex-1"
            />
            <button className="px-4 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm" type="button">
              Create
            </button>
          </div>
        </div>
      )}

      {/* Content: for Segue = prompt line + empty; others = existing UI. Issues: no section spacing so filters/tabs sit flush. */}
      <div className={`flex-1 overflow-y-auto ${
        sectionId === 'issues' ? 'pt-0 pb-0 px-6' : hasFilterBar ? 'pt-0 px-6 pb-6' : 'p-6'
      }`}>
        {isMinimalPrompt && sectionId !== 'headlines' && (
          <>
            <p className="text-lg text-foreground font-medium">{data.content}</p>
            <div className="flex-1 min-h-[200px]" aria-hidden />
          </>
        )}
        {sectionId === 'scorecard' && (
          <InstrumentsSegmentView embedded teamName={meetingTeamName ?? 'No team found'} meetingId={meetingId} organizationId={organizationId} isFacilitator={isFacilitator} canRecord={canRecordOrFacilitator} isMeetingInFuture={isMeetingInFuture} onOpenCreate={onOpenCreate} onOpenCreateIssue={onOpenCreateIssue} meetingAttendances={meetingAttendances} />
        )}
        {sectionId === 'rocks' && (
          <RocksSegmentView
            embedded
            sectionTitle={sectionTitle}
            meetingId={meetingId}
            organizationId={organizationId}
            teamId={meetingTeamId}
            teamName={meetingTeamName ?? 'No team found'}
            isFacilitator={isFacilitator}
            canRecord={canRecordOrFacilitator}
            onOpenCreate={onOpenCreate}
          />
        )}
        {sectionId === 'headlines' && (
          <HeadlinesSegmentView embedded teamName={meetingTeamName ?? 'No team found'} meetingId={meetingId} isFacilitator={isFacilitator} canRecord={canRecordOrFacilitator} onOpenCreate={onOpenCreate} />
        )}
        {sectionId === 'todos' && (
          <TodosSegmentView
            embedded
            teamName={meetingTeamName ?? 'No team found'}
            teamId={meetingTeamId}
            teams={meetingTeams}
            organizationId={organizationId}
            meetingId={meetingId}
            isFacilitator={isFacilitator}
            canRecord={canRecordOrFacilitator}
            onOpenCreate={onOpenCreate}
          />
        )}
        {sectionId === 'issues' && (
          <IssuesSegmentView
            embedded
            teamName={meetingTeamName ?? 'No team found'}
            meetingId={meetingId}
            isFacilitator={isFacilitator}
            canRecord={canRecordOrFacilitator}
            onOpenCreate={onOpenCreate}
            onOpenCreateIssue={onOpenCreateIssue}
          />
        )}
        {sectionId === 'conclude' && (
          <ConcludeSegmentView
            embedded
            teamName={meetingTeamName ?? 'No team found'}
            teamId={meetingTeamId}
            teams={meetingTeams}
            organizationId={organizationId}
            onFinishMeeting={onFinishMeeting}
            finishLoading={finishLoading}
            meetingId={meetingId}
            isFacilitator={isFacilitator}
            facilitatorId={facilitatorId}
            currentUserId={currentUserId}
            attendances={meetingAttendances}
          />
        )}
        {data.type === 'text' && !data.empty && sectionId !== 'conclude' && (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-foreground/80">{data.content}</p>
          </div>
        )}
        {data.type === 'metrics' && sectionId !== 'scorecard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.items.map((item: any, index: number) => (
              <div key={index} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-foreground">{item.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded ${
                    item.status === 'good' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {item.trend}
                  </span>
                </div>
                <p className="text-2xl font-bold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {data.type === 'list' && sectionId !== 'rocks' && sectionId !== 'headlines' && sectionId !== 'todos' && sectionId !== 'issues' && (
          <div>
            {/* Tabs for Turbulence (Issues) — flight term */}
            {sectionId === 'issues' && (
              <div className="flex gap-2 mb-4 border-b border-border">
                <button className="px-4 py-2 text-sm font-medium text-primary border-b-2 border-primary">
                  Short-Term
                </button>
                <button className="px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground">
                  Long-Term
                </button>
              </div>
            )}

            {/* List Items */}
            <div className="space-y-2">
              {data.items.map((item: any) => (
                <div
                  key={item.id}
                  className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <div className="pt-1">
                      {item.status === 'done' || item.status === 'resolved' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-foreground/30" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-foreground">{item.id}. {item.title}</h3>
                        {item.priority && (
                          <span className="text-sm text-foreground/70">{item.priority}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-foreground/60">
                        {item.owner && (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{item.owner}</span>
                          </div>
                        )}
                        {item.assignee && (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{item.assignee}</span>
                          </div>
                        )}
                        {item.created && <span>Created: {formatDateOrPass(item.created)}</span>}
                        {item.dueDate && <span>Due: {item.dueDate}</span>}
                        {item.status && (
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            item.status === 'on_track' ? 'bg-green-100 text-green-700' :
                            item.status === 'off_track' ? 'bg-red-100 text-red-700' :
                            item.status === 'done' || item.status === 'resolved' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.status.replace('_', ' ').toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Button */}
            <button className="mt-4 flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-foreground/70 hover:text-foreground hover:border-primary/50 transition-colors">
              <Plus className="w-4 h-4" />
              {sectionId === 'issues' ? 'Add Turbulence' : sectionId === 'todos' ? 'Add Clearance' : 'Add Waypoint'}
            </button>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between text-sm text-foreground/70">
              <div className="flex items-center gap-2">
                <span>Items per page:</span>
                <Select
                  value={50}
                  options={[{ label: '50', value: 50 }]}
                  className="min-w-[80px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span>1-{data.items.length} of {data.items.length}</span>
                <button className="p-1 hover:bg-accent rounded">←</button>
                <button className="p-1 hover:bg-accent rounded">→</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
