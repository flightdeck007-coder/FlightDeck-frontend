'use client';

const spinnerClass = 'animate-spin rounded-full border-2 border-primary border-t-transparent';

/** 1. Full-screen loader — circling spinner overlay */
export function FullScreenLoader() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80">
      <div className={`w-10 h-10 ${spinnerClass}`} />
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
