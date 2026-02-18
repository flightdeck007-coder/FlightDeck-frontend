'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { organizationsService, OrganizationMember } from '@/lib/api/organizations.service';
import { Users, Shield, UserCheck, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function MembersPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationRole, setOrganizationRole] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  useEffect(() => {
    const storedOrgId = typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null;
    const storedRole = typeof window !== 'undefined' ? localStorage.getItem('organizationRole') : null;
    if (storedOrgId) {
      setOrganizationId(storedOrgId);
      setOrganizationRole(storedRole);
      loadMembers(storedOrgId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadMembers = async (orgId: string) => {
    try {
      setIsLoading(true);
      setError('');
      const data = await organizationsService.getMembers(orgId);
      setMembers(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'ADMIN' | 'MANAGER' | 'MEMBER') => {
    if (!organizationId) return;
    try {
      setUpdatingRole(memberId);
      setError('');
      await organizationsService.updateMemberRole(organizationId, memberId, newRole);
      await loadMembers(organizationId);
      
      // If updating current user's role, update localStorage and refresh UI
      if (memberId === user?.id && typeof window !== 'undefined') {
        localStorage.setItem('organizationRole', newRole);
        setOrganizationRole(newRole);
        // Trigger custom event to update sidebar
        window.dispatchEvent(new CustomEvent('organizationRoleChanged', { detail: { role: newRole } }));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update role');
    } finally {
      setUpdatingRole(null);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Shield className="w-4 h-4 text-primary" />;
      case 'MANAGER':
        return <UserCheck className="w-4 h-4 text-blue-500" />;
      default:
        return <User className="w-4 h-4 text-foreground/50" />;
    }
  };

  const isAdmin = organizationRole === 'ADMIN';

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Organization Members
          </h1>
          <p className="text-sm text-foreground/70 mt-1">
            Manage roles and permissions for your organization members
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 border border-red-200 bg-red-50 text-sm text-red-700 rounded">
            {error}
          </div>
        )}

        {!organizationId ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-foreground/70">
              Please select an organization first from the Organizations page.
            </p>
          </div>
        ) : isLoading ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-foreground/70">Loading members...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-foreground/70">No members found.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-accent/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
                      Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
                      Role
                    </th>
                    {isAdmin && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((member) => {
                    const isCurrentUser = member.user.id === user?.id;
                    return (
                      <tr key={member.id} className="hover:bg-accent/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              {member.user.name || member.user.email}
                            </div>
                            <div className="text-sm text-foreground/60">{member.user.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getRoleIcon(member.role)}
                            <span className="text-sm text-foreground">{member.role}</span>
                            {isCurrentUser && (
                              <span className="text-xs text-foreground/50">(You)</span>
                            )}
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {!isCurrentUser ? (
                              <select
                                value={member.role}
                                onChange={(e) =>
                                  handleRoleChange(
                                    member.user.id,
                                    e.target.value as 'ADMIN' | 'MANAGER' | 'MEMBER',
                                  )
                                }
                                disabled={updatingRole === member.user.id}
                                className="px-3 py-1.5 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                <option value="MEMBER">Member</option>
                                <option value="MANAGER">Manager</option>
                                <option value="ADMIN">Admin</option>
                              </select>
                            ) : (
                              <span className="text-sm text-foreground/50">Cannot change own role</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
