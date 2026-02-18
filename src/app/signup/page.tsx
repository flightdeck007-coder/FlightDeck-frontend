'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { SignupForm } from '@/components/auth/SignupForm';
import { ROUTES } from '@/lib/constants/routes';

function SignupFormWrapper() {
  return <SignupForm />;
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-semibold text-foreground mb-2">FlightDeck</h1>
            <p className="text-foreground/70">Create your account</p>
          </div>
          
          <Suspense fallback={<div className="text-foreground/70">Loading...</div>}>
            <SignupFormWrapper />
          </Suspense>
          
          <div className="mt-6 text-center text-sm text-foreground/70">
            Already have an account?{' '}
            <Link href={ROUTES.LOGIN} className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
