// /driver/profile — Server Component. Loads the signed-in driver plus their
// lifetime delivery count and total earnings (delivery fees) for the header
// stats, then renders the client profile screen.
import { getMyDriver, getDriverDeliveries } from '@/lib/queries';
import { DriverProfileScreen } from '@/components/driver/DriverProfileScreen';

export default async function DriverProfilePage() {
  const [driver, deliveries] = await Promise.all([getMyDriver(), getDriverDeliveries()]);
  if (!driver) return null;
  const totalEarnings = deliveries.reduce((sum, d) => sum + (d.delivery_fee_dh ?? 0), 0);
  return (
    <DriverProfileScreen driver={driver} totalDeliveries={deliveries.length} totalEarnings={totalEarnings} />
  );
}
