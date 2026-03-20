import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardAnalyticsContent } from '@/components/dashboard/DashboardAnalyticsContent';

export default function OverviewPage() {
  return (
    <DashboardLayout>
      <DashboardAnalyticsContent />
    </DashboardLayout>
  );
}
