import Link from 'next/link';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { ROUTES } from '@/lib/constants/routes';

function LoginFormWrapper() {
  return <LoginForm />;
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-semibold text-foreground mb-2">FlightDeck</h1>
            <p className="text-foreground/70">Sign in to your account</p>
          </div>
          
          <Suspense fallback={<div className="text-foreground/70">Loading...</div>}>
            <LoginFormWrapper />
          </Suspense>
          
          <div className="mt-6 text-center text-sm text-foreground/70">
            Don't have an account?{' '}
            <Link href={ROUTES.SIGNUP} className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
