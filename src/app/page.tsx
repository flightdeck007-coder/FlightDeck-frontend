'use client';

import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { Hero } from '@/components/landing/Hero';
import { About } from '@/components/landing/About';
import { FAQ } from '@/components/landing/FAQ';
import { CTA } from '@/components/landing/CTA';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <Hero />
      <About />
      <FAQ />
      <CTA />
    </div>
  );
}
