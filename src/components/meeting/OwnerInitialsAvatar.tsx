'use client';

const SIZE_CLASS: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-[11px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-9 h-9 text-xs',
};

/** Consistent “crew owner” chip: ring + tint so initials never look like plain text. */
export function OwnerInitialsAvatar({
  initials,
  size = 'sm',
  className = '',
  title: titleProp,
}: {
  initials?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  /** Optional tooltip / accessible name */
  title?: string;
}) {
  const text = (initials?.trim() || '?').slice(0, 2).toUpperCase();
  const title = titleProp ?? (text !== '?' ? `Owner: ${text}` : 'No owner');
  return (
    <div
      className={`${SIZE_CLASS[size]} rounded-full bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center font-semibold text-primary shrink-0 ${className}`}
      title={title}
    >
      {text}
    </div>
  );
}
