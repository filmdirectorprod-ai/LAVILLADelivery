import { getKitchenBoard } from '@/lib/queries';
import { KitchenScreen } from '@/components/admin/kitchen/KitchenScreen';

export const dynamic = 'force-dynamic';

export default async function AdminKitchenPage() {
  const initial = await getKitchenBoard();
  return <KitchenScreen initial={initial} />;
}
