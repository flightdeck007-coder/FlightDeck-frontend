'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/constants/routes';

export function SignupForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
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

    setIsLoading(true);

    try {
      await register(email, password, name || undefined);
      router.push(ROUTES.DASHBOARD);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Creating account...' : 'Sign Up'}
      </button>
    </form>
  );
}
