'use client';

import Link from 'next/link';
import { ROUTES } from '@/lib/constants/routes';
import { Plane, ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center bg-gradient-to-b from-background via-accent/20 to-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-primary/10 rounded-full">
              <Plane className="w-16 h-16 text-primary" />
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
            Operate from <span className="text-primary">Altitude</span>
          </h1>
          <p className="text-xl md:text-2xl text-foreground/70 mb-4 max-w-3xl mx-auto">
            Your high-trust operations dashboard for strategic business management.
          </p>
          <p className="text-lg text-foreground/60 mb-8 max-w-2xl mx-auto">
            Navigate complexity with clarity and confidence using Weekly Flight Reviews
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={ROUTES.SIGNUP}
              className="px-8 py-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2 text-lg font-medium"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="#about"
              className="px-8 py-4 border border-border text-foreground rounded-md hover:bg-accent transition-colors text-lg"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
