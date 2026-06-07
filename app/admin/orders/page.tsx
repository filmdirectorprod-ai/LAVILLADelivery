import { getAdminOrdersData } from '@/lib/queries';
import { OrdersAdminScreen } from '@/components/admin/orders/OrdersAdminScreen';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  const initial = await getAdminOrdersData();
  return <OrdersAdminScreen initial={initial} />;
}
