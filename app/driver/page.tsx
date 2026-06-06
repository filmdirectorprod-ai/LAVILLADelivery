// Driver dashboard (/driver) — Server Component. Loads the signed-in driver and
// the active-order board (available pool + their own deliveries, RLS-scoped),
// then renders the client dashboard which subscribes to Realtime for live
// updates. The layout already guaranteed a driver, but we re-fetch to pass the
// row (and to satisfy the typed prop) — getMyDriver is a single indexed lookup.
import { getMyDriver, getDriverBoard } from '@/lib/queries';
import { DriverDashboard } from '@/components/driver/DriverDashboard';

export default async function DriverHomePage() {
  const [driver, board] = await Promise.all([getMyDriver(), getDriverBoard()]);
  // driver is non-null here (layout gate), but guard for type-safety.
  if (!driver) return null;

  return <DriverDashboard driver={driver} initialBoard={board} />;
}
