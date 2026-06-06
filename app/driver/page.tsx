// Driver dashboard (/driver) — Server Component. Loads the signed-in driver, the
// active-order board (available pool + their own deliveries, RLS-scoped) and the
// driver's completed-delivery stats (count + total earnings) for the header
// tiles, then renders the client dashboard which subscribes to Realtime.
import { getMyDriver, getDriverBoard, getDriverDeliveries } from '@/lib/queries';
import { DriverDashboard } from '@/components/driver/DriverDashboard';

export default async function DriverHomePage() {
  const [driver, board, deliveries] = await Promise.all([
    getMyDriver(),
    getDriverBoard(),
    getDriverDeliveries(),
  ]);
  // driver is non-null here (layout gate), but guard for type-safety.
  if (!driver) return null;

  const totalEarnings = deliveries.reduce((sum, d) => sum + (d.delivery_fee_dh ?? 0), 0);

  return (
    <DriverDashboard
      driver={driver}
      initialBoard={board}
      deliveriesCount={deliveries.length}
      totalEarnings={totalEarnings}
    />
  );
}
