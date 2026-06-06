// /driver/history — Server Component. Loads the current driver's completed
// deliveries (driver_deliveries RPC, migration 0010) and renders the list.
import { getDriverDeliveries } from '@/lib/queries';
import { DriverHistoryScreen } from '@/components/driver/DriverHistoryScreen';

export default async function DriverHistoryPage() {
  const deliveries = await getDriverDeliveries();
  return <DriverHistoryScreen deliveries={deliveries} />;
}
