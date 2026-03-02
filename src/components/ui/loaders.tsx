'use client';

import { Loader2 } from 'lucide-react';

const spinnerClass = 'animate-spin rounded-full border-2 border-primary border-t-transparent';

/** 1. Full-screen loader — circling spinner overlay */
export function FullScreenLoader() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80">
      <div className={`w-10 h-10 ${spinnerClass}`} />
    </div>
  );
}

/** Full-screen loader with message (e.g. "Setting up meeting") */
export function FullScreenLoaderWithText({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95" aria-busy="true" aria-live="polite">
      <Loader2 className="w-12 h-12 text-primary animate-spin shrink-0" aria-hidden />
      <p className="mt-4 text-sm font-medium text-foreground">{text}</p>
    </div>
  );
}

/**
 * Fills its container (use in a flex child with flex-1 min-h-0).
 * Use for recap panel or segment content area so the loader occupies the same space as content—no fixed height or scroll glitch.
 */
export function ContentAreaLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center bg-card rounded-lg" aria-busy="true" aria-live="polite">
      <Loader2 className="w-10 h-10 text-primary animate-spin shrink-0" aria-hidden />
      <p className="mt-3 text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

/** 2. Button loader — inline spinner for buttons */
export function ButtonLoader({ className }: { className?: string }) {
  return (
    <span className={`inline-block w-4 h-4 shrink-0 ${spinnerClass} ${className ?? ''}`} aria-hidden />
  );
}

/** 3. Section loader — centered in a block (e.g. card/content area) */
export function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className={`w-8 h-8 ${spinnerClass}`} />
    </div>
  );
}

/** 4. Section loader with text below */
export function SectionLoaderWithText({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className={`w-8 h-8 ${spinnerClass}`} />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export default { FullScreenLoader, ButtonLoader, SectionLoader, SectionLoaderWithText };
