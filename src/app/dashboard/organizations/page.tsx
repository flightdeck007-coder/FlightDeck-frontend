'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { organizationsService, Organization } from '@/lib/api/organizations.service';
import { Building2, Star, Copy, Check, Share2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/constants/routes';
import Link from 'next/link';

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [addingToOrgId, setAddingToOrgId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const storedOrgId = typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null;
    if (storedOrgId) {
      setCurrentOrgId(storedOrgId);
    }
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setIsLoading(true);
      const data = await organizationsService.list();
      setOrganizations(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetCurrent = (org: Organization) => {
    setCurrentOrgId(org.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('organizationId', org.id);
      localStorage.setItem('organizationName', org.name);
      if (user) {
        const membership = org.members.find((m) => m.user.id === user.id);
        if (membership) {
          localStorage.setItem('organizationRole', membership.role);
        }
      }
    }
  };

  const handleAddMember = async (orgId: string) => {
    if (!inviteEmail.trim()) return;
    try {
      setError('');
      setAddingToOrgId(orgId);
      await organizationsService.addMember(orgId, { email: inviteEmail.trim(), role: 'MEMBER' });
      setInviteEmail('');
      await loadOrganizations();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add member');
    } finally {
      setAddingToOrgId(null);
    }
  };

  const copyInviteCode = (code: string) => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const copyInviteLink = (code: string) => {
    if (typeof window !== 'undefined') {
      const link = `${window.location.origin}${ROUTES.SIGNUP}?invite=${code}`;
      navigator.clipboard.writeText(link);
      setCopiedCode(`link-${code}`);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Fleet
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-3 border border-red-200 bg-red-50 text-sm text-red-700 rounded">
            {error}
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-foreground/70">Loading fleet...</p>
          </div>
        ) : organizations.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-foreground/70">
              You have no fleet yet. Create one during signup to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl">
            {organizations.map((org) => {
              const isCurrent = currentOrgId === org.id;
              const inviteLink = typeof window !== 'undefined' 
                ? `${window.location.origin}${ROUTES.SIGNUP}?invite=${org.inviteCode}`
                : '';
              
              return (
                <div
                  key={org.id}
                  className="bg-card border border-border rounded-lg p-6"
                >
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-xl font-semibold text-foreground">{org.name}</h2>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          <Star className="w-3 h-3" />
                          Current
                        </span>
                      )}
                    </div>
                      <p className="text-sm text-foreground/60">
                        Flight crews: {org.teams.length} · Crew: {org.members.length}
                      </p>
                  </div>

                  {/* Invite Code Section */}
                  {isCurrent && (
                    <div className="mt-6 p-4 bg-accent/50 rounded-lg border border-border">
                      <h3 className="text-sm font-semibold text-foreground mb-3">
                        Invite Crew Members
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-foreground/70 mb-1">
                            Invite Code
                          </label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm font-mono text-foreground">
                              {org.inviteCode}
                            </code>
                            <button
                              onClick={() => copyInviteCode(org.inviteCode)}
                              className="p-2 border border-border rounded-md hover:bg-background transition-colors"
                              title="Copy code"
                            >
                              {copiedCode === org.inviteCode ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4 text-foreground/70" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-foreground/70 mb-1">
                            Invite Link
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={inviteLink}
                              className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
                            />
                            <button
                              onClick={() => copyInviteLink(org.inviteCode)}
                              className="p-2 border border-border rounded-md hover:bg-background transition-colors"
                              title="Copy link"
                            >
                              {copiedCode === `link-${org.inviteCode}` ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Share2 className="w-4 h-4 text-foreground/70" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* View Members Link */}
                  {isCurrent && (
                    <div className="mt-4">
                      <Link
                        href={ROUTES.ORGANIZATIONS_MEMBERS}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        View all crew →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

