'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FLIGHT_TERMS } from '@/lib/constants/flightTerminology';
import { ROUTES } from '@/lib/constants/routes';

const NAV_LINKS = [
  { href: ROUTES.MEETINGS_UPCOMING, label: 'Upcoming' },
  { href: ROUTES.MEETINGS_PAST, label: 'Past Meetings' },
  { href: ROUTES.MEETINGS_AGENDAS, label: 'Agendas' },
] as const;

/** True when we're on an agenda edit page (e.g. /dashboard/meetings/agendas/abc-123). */
function isAgendaEditPath(pathname: string): boolean {
  const base = ROUTES.MEETINGS_AGENDAS + '/';
  return pathname.startsWith(base) && pathname.length > base.length;
}

export default function MeetingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAgendaEdit = isAgendaEditPath(pathname);

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-0 flex-1">
        {!isAgendaEdit && (
          <div className="bg-card border-b border-border shrink-0 px-6 pt-4 pb-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">{FLIGHT_TERMS.MEETINGS}</h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Improve alignment and transparency across your organization.
                </p>
              </div>
            </div>
            <nav className="mt-4 flex gap-6" aria-label="Meeting sections">
              {NAV_LINKS.map(({ href, label }) => {
                const isActive = pathname === href || (href === ROUTES.MEETINGS_AGENDAS && pathname.startsWith(ROUTES.MEETINGS_AGENDAS + '/'));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                      isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
        <div className={`flex-1 overflow-auto ${isAgendaEdit ? '' : 'p-6 px-8'}`}>{children}</div>
      </div>
    </DashboardLayout>
  );
}
