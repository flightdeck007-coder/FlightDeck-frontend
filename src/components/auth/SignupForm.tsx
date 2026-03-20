'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROUTES } from '@/lib/constants/routes';
import { Building2, Users, Copy, Check } from 'lucide-react';
import { authService } from '@/lib/api/auth.service';

export function SignupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [orgChoice, setOrgChoice] = useState<'create' | 'join'>('create');
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [orgInfo, setOrgInfo] = useState<{ name: string } | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validatingInvite, setValidatingInvite] = useState(false);
  const { register } = useAuth();

  useEffect(() => {
    const invite = searchParams?.get('invite');
    if (invite) {
      setInviteCode(invite);
      setOrgChoice('join');
      validateInviteCode(invite);
    }
  }, [searchParams]);

  const validateInviteCode = async (code: string) => {
    if (!code.trim()) return;
    try {
      setValidatingInvite(true);
      setError('');
      const org = await authService.validateInviteCode(code);
      setOrgInfo({ name: org.name });
    } catch (err: any) {
      setError('Invalid invite code');
      setOrgInfo(null);
    } finally {
      setValidatingInvite(false);
    }
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setStep(2);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (orgChoice === 'create' && !orgName.trim()) {
      setError('Organization name is required');
      return;
    }

    if (orgChoice === 'join' && !inviteCode.trim()) {
      setError('Invite code is required');
      return;
    }

    setIsLoading(true);

    try {
      await register(
        email,
        password,
        name || undefined,
        orgChoice === 'join' ? inviteCode : undefined,
        orgChoice === 'create' ? orgName : undefined,
      );
      router.push(ROUTES.OVERVIEW);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 1) {
    return (
      <form onSubmit={handleStep1Submit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
            Name (optional)
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="John Doe"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
        >
          Continue
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleStep2Submit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
          {error}
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm text-foreground/70 mb-4">
          Step 2 of 2: Choose your organization
        </p>
      </div>

      {/* Organization Choice */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => {
            setOrgChoice('create');
            setInviteCode('');
            setOrgInfo(null);
            setError('');
          }}
          className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
            orgChoice === 'create'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-primary" />
            <div>
              <div className="font-semibold text-foreground">Create New Organization</div>
              <div className="text-sm text-foreground/70">
                Start fresh and become the admin
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setOrgChoice('join');
            setOrgName('');
            setError('');
          }}
          className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
            orgChoice === 'join'
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <div className="font-semibold text-foreground">Join Existing Organization</div>
              <div className="text-sm text-foreground/70">
                Enter an invite code to join a team
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Create Organization Form */}
      {orgChoice === 'create' && (
        <div className="mt-4">
          <label htmlFor="orgName" className="block text-sm font-medium text-foreground mb-1">
            Organization Name
          </label>
          <input
            id="orgName"
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Acme Corporation"
          />
        </div>
      )}

      {/* Join Organization Form */}
      {orgChoice === 'join' && (
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="inviteCode" className="block text-sm font-medium text-foreground mb-1">
              Invite Code
            </label>
            <input
              id="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value);
                if (e.target.value.trim()) {
                  validateInviteCode(e.target.value);
                } else {
                  setOrgInfo(null);
                }
              }}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="ABC12345"
            />
            {validatingInvite && (
              <p className="text-xs text-foreground/60 mt-1">Validating...</p>
            )}
            {orgInfo && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded text-sm">
                <div className="flex items-center gap-2 text-green-700">
                  <Check className="w-4 h-4" />
                  <span>You'll join: <strong>{orgInfo.name}</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="flex-1 py-2 px-4 border border-border rounded-md text-foreground hover:bg-accent transition-colors"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isLoading || (orgChoice === 'join' && !orgInfo)}
          className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Creating account...' : 'Sign Up'}
        </button>
      </div>
    </form>
  );
}
