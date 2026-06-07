// Vue d'ensemble — live admin dashboard. Server component fetches the first-paint
// snapshot under staff RLS; OverviewScreen takes over with realtime updates.
import { getAdminOverviewData } from '@/lib/queries';
import { OverviewScreen } from '@/components/admin/overview/OverviewScreen';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const initial = await getAdminOverviewData();
  return <OverviewScreen initial={initial} mapsKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} />;
}
