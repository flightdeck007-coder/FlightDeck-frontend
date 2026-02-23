'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { teamsService, Team } from '@/lib/api/teams.service';
import { Users, Edit2, Trash2, Check, UserPlus, UserMinus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function TeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState('');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationRole, setOrganizationRole] = useState<string | null>(null);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [memberEmailByTeam, setMemberEmailByTeam] = useState<Record<string, string>>({});
  const [addingMemberTeamId, setAddingMemberTeamId] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null); // "teamId-userId"

  const isAdminOrManager = organizationRole === 'ADMIN' || organizationRole === 'MANAGER';

  useEffect(() => {
    const storedOrgId = typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null;
    const storedRole = typeof window !== 'undefined' ? localStorage.getItem('organizationRole') : null;
    const storedTeamId = typeof window !== 'undefined' ? localStorage.getItem('currentTeamId') : null;
    
    if (storedOrgId) {
      setOrganizationId(storedOrgId);
      setOrganizationRole(storedRole);
      if (storedTeamId) {
        setCurrentTeamId(storedTeamId);
      }
      void loadTeams(storedOrgId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadTeams = async (orgId: string) => {
    try {
      setIsLoading(true);
      setError('');
      const data = await teamsService.list(orgId);
      setTeams(data);
      
      // If MEMBER and has teams, auto-select first team
      if (organizationRole === 'MEMBER' && data.length > 0 && !currentTeamId) {
        const teamId = data[0].id;
        setCurrentTeamId(teamId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('currentTeamId', teamId);
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load teams');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !organizationId) return;

    try {
      setCreating(true);
      setError('');
      const team = await teamsService.create({ organizationId, name: name.trim() });
      setTeams((prev) => [...prev, team]);
      setName('');
      await loadTeams(organizationId);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (team: Team) => {
    setEditingTeamId(team.id);
    setEditingName(team.name);
  };

  const handleCancelEdit = () => {
    setEditingTeamId(null);
    setEditingName('');
  };

  const handleUpdate = async (teamId: string) => {
    if (!editingName.trim()) return;
    try {
      setUpdating(true);
      setError('');
      await teamsService.update(teamId, { name: editingName.trim() });
      await loadTeams(organizationId!);
      handleCancelEdit();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update team');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;
    try {
      setDeleting(teamId);
      setError('');
      await teamsService.delete(teamId);
      await loadTeams(organizationId!);
      // Clear current team if it was deleted
      if (currentTeamId === teamId) {
        setCurrentTeamId(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('currentTeamId');
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete team');
    } finally {
      setDeleting(null);
    }
  };

  const handleTeamSelect = (teamId: string) => {
    setCurrentTeamId(teamId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentTeamId', teamId);
    }
  };

  const handleAddTeamMember = async (teamId: string) => {
    const email = (memberEmailByTeam[teamId] || '').trim();
    if (!email) return;
    try {
      setError('');
      setAddingMemberTeamId(teamId);
      await teamsService.addMember(teamId, { email });
      setMemberEmailByTeam((prev) => ({ ...prev, [teamId]: '' }));
      if (organizationId) await loadTeams(organizationId);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add team member');
    } finally {
      setAddingMemberTeamId(null);
    }
  };

  const handleRemoveTeamMember = async (teamId: string, targetUserId: string) => {
    if (!confirm('Remove this member from the team?')) return;
    try {
      setError('');
      setRemovingMember(`${teamId}-${targetUserId}`);
      await teamsService.removeMember(teamId, targetUserId);
      if (organizationId) await loadTeams(organizationId);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to remove member');
    } finally {
      setRemovingMember(null);
    }
  };

  if (!organizationId) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-foreground/70">
              No fleet selected. Please sign up or join a fleet first.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Flight Crews
          </h1>
        </div>

        {/* Current Team Selector (for ADMIN/MANAGER) */}
        {isAdminOrManager && teams.length > 0 && (
          <div className="mb-6 p-4 bg-accent/50 rounded-lg border border-border">
            <label className="block text-sm font-medium text-foreground mb-2">
              Current Flight Crew (for flight reviews)
            </label>
            <select
              value={currentTeamId || ''}
              onChange={(e) => handleTeamSelect(e.target.value)}
              className="px-3 py-2 border border-border rounded-md bg-background text-foreground max-w-xs"
            >
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            {currentTeamId && (
              <p className="text-xs text-foreground/60 mt-2">
                Flight reviews will be shown for: <strong>{teams.find((t) => t.id === currentTeamId)?.name}</strong>
              </p>
            )}
          </div>
        )}

        {/* Create form (ADMIN/MANAGER only) */}
        {isAdminOrManager && (
          <form onSubmit={handleCreate} className="mb-6 flex flex-col md:flex-row gap-3 max-w-xl">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New team name"
              className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? 'Creating...' : 'Create team'}
            </button>
          </form>
        )}

        {error && (
          <div className="mb-4 p-3 border border-red-200 bg-red-50 text-sm text-red-700 rounded">
            {error}
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-foreground/70">Loading teams...</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-foreground/70">
              {organizationRole === 'MEMBER' || !isAdminOrManager
                ? "You're not added to any flight crew yet. Contact your admin or manager to be added."
                : 'No flight crews yet. Create one above.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {teams.map((team) => (
              <div
                key={team.id}
                className="bg-card border border-border rounded-lg p-4"
              >
                {editingTeamId === team.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground"
                      autoFocus
                    />
                    <button
                      onClick={() => void handleUpdate(team.id)}
                      disabled={updating}
                      className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-2 text-foreground/60 hover:bg-accent rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-medium text-foreground">{team.name}</h2>
                        <p className="text-sm text-foreground/60 mt-1">Team ID: {team.id}</p>
                      </div>
                      {isAdminOrManager && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStartEdit(team)}
                            className="p-2 text-foreground/60 hover:bg-accent rounded transition-colors"
                            title="Edit team"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => void handleDelete(team.id)}
                            disabled={deleting === team.id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="Delete team"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Team members list + add member (ADMIN/MANAGER only) */}
                    {team.members && team.members.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs font-medium text-foreground/70 mb-2">Crew</p>
                        <ul className="space-y-1">
                          {team.members.map((tm) => (
                            <li
                              key={tm.userId}
                              className="flex items-center justify-between text-sm text-foreground/80"
                            >
                              <span>{tm.user.name || tm.user.email}</span>
                              {isAdminOrManager && tm.userId !== user?.id && (
                                <button
                                  onClick={() => void handleRemoveTeamMember(team.id, tm.userId)}
                                  disabled={removingMember === `${team.id}-${tm.userId}`}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                  title="Remove from team"
                                >
                                  <UserMinus className="w-4 h-4" />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {isAdminOrManager && (
                      <div className="mt-3 flex flex-col sm:flex-row gap-2">
                        <input
                          type="email"
                          value={memberEmailByTeam[team.id] || ''}
                          onChange={(e) =>
                            setMemberEmailByTeam((prev) => ({ ...prev, [team.id]: e.target.value }))
                          }
                          placeholder="Add member by email"
                          className="flex-1 min-w-0 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
                        />
                        <button
                          onClick={() => void handleAddTeamMember(team.id)}
                          disabled={addingMemberTeamId === team.id}
                          className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                        >
                          <UserPlus className="w-4 h-4" />
                          {addingMemberTeamId === team.id ? 'Adding...' : 'Add member'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
