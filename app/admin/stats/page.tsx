// /admin/stats — Server Component. Loads the aggregated report for the default
// range (admin_stats_snapshot, 0051 — scoped to the caller's agency) plus the
// branch list, and renders the Statistiques screen. Changing the range refetches
// the aggregate; no raw order rows ever reach the browser.
import { getAdminStatsData } from '@/lib/queries';
import { StatsScreen } from '@/components/admin/stats/StatsScreen';

export default async function StatsPage() {
  const data = await getAdminStatsData();
  return <StatsScreen snapshot={data.snapshot} branches={data.branches} />;
}
