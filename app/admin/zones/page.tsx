import { getAdminZonesData } from '@/lib/queries';
import { ZonesScreen } from '@/components/admin/zones/ZonesScreen';

export const dynamic = 'force-dynamic';

export default async function AdminZonesPage() {
  const initial = await getAdminZonesData();
  return <ZonesScreen initial={initial} />;
}
