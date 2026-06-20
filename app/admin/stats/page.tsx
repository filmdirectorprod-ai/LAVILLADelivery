// /admin/stats — Server Component. Loads the last-90-days orders + items + branches
// (RLS-scoped to the caller's agency) and renders the Statistiques screen, which
// filters by the chosen range and aggregates client-side.
import { getAdminStatsData } from '@/lib/queries';
import { StatsScreen } from '@/components/admin/stats/StatsScreen';

export default async function StatsPage() {
  const data = await getAdminStatsData();
  return <StatsScreen orders={data.orders} items={data.items} branches={data.branches} />;
}
