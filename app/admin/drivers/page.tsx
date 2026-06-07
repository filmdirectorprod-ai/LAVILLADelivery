import { getAdminDriversData } from '@/lib/queries';
import { DriversScreen } from '@/components/admin/drivers/DriversScreen';

export const dynamic = 'force-dynamic';

export default async function AdminDriversPage() {
  const initial = await getAdminDriversData();
  return <DriversScreen initial={initial} />;
}
