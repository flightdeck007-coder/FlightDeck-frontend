'use client';

import { type ReactNode } from 'react';

export interface SimpleTableColumn {
  key: string;
  label: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

interface SimpleTableProps {
  columns: SimpleTableColumn[];
  children: ReactNode;
  /** Optional class for the table wrapper (e.g. for border, rounded). */
  className?: string;
  /** Optional class for thead row (e.g. bg-muted/30). */
  headerRowClassName?: string;
  /** Optional class for th (e.g. text-muted-foreground). */
  headerCellClassName?: string;
}

/**
 * Reusable table: renders a <table> with thead from columns and tbody from children.
 * Use for consistent table layout; parent supplies tbody rows.
 */
export function SimpleTable({
  columns,
  children,
  className = '',
  headerRowClassName = '',
  headerCellClassName = 'text-xs font-medium text-muted-foreground uppercase tracking-wider',
}: SimpleTableProps) {
  return (
    <table className={`w-full text-left ${className}`}>
      <thead>
        <tr className={headerRowClassName}>
          {columns.map((col) => (
            <th
              key={col.key}
              className={`px-4 py-3 ${col.className ?? ''} ${headerCellClassName}`}
              style={{ textAlign: col.align ?? 'left' }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
