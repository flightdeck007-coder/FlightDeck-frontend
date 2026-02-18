'use client';

import Link from 'next/link';
import { ROUTES } from '@/lib/constants/routes';
import { ArrowRight } from 'lucide-react';

export function CTA() {
  return (
    <section className="py-20 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-card border-2 border-primary rounded-lg p-12 text-center">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Ready to Elevate Your Operations?
          </h2>
          <p className="text-xl text-foreground/70 mb-8 max-w-2xl mx-auto">
            Join teams that are already operating at altitude with FlightDeck. Start your free
            trial today and experience the power of Level 10 Meetings™.
          </p>
          <Link
            href={ROUTES.SIGNUP}
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-lg font-medium"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
