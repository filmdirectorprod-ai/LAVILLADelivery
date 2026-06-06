// /driver/earnings — Server Component. Earnings are derived from the driver's
// completed deliveries (driver_deliveries RPC, migration 0010): the screen sums
// delivery_fee_dh into today / week / total.
import { getDriverDeliveries } from '@/lib/queries';
import { DriverEarningsScreen } from '@/components/driver/DriverEarningsScreen';

export default async function DriverEarningsPage() {
  const deliveries = await getDriverDeliveries();
  return <DriverEarningsScreen deliveries={deliveries} />;
}
