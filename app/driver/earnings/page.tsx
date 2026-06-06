// /driver/earnings — Server Component. The "Tournée" stats screen: earnings are
// derived from completed deliveries (driver_deliveries RPC, 0010) and client
// ratings from driver_reviews (0011).
import { getMyDriver, getDriverDeliveries, getDriverReviews } from '@/lib/queries';
import { DriverEarningsScreen } from '@/components/driver/DriverEarningsScreen';

export default async function DriverEarningsPage() {
  const [driver, deliveries, reviews] = await Promise.all([
    getMyDriver(),
    getDriverDeliveries(),
    getDriverReviews(),
  ]);
  return (
    <DriverEarningsScreen driverName={driver?.name ?? 'Livreur'} deliveries={deliveries} reviews={reviews} />
  );
}
