// /tracking/[id] — Server Component. Loads the order (with items + tracking row)
// and the assigned driver, then renders the client TrackingScreen which
// subscribes to order_tracking UPDATEs via Supabase Realtime.
import { notFound } from 'next/navigation';
import { getOrderDetail, getDriverById } from '@/lib/queries';
import { TrackingScreen } from '@/components/screens/TrackingScreen';

export default async function TrackingPage({ params }: { params: { id: string } }) {
  const detail = await getOrderDetail(params.id);
  if (!detail) notFound();
  const driver = await getDriverById(detail.tracking?.driver_id ?? null);
  return (
    <TrackingScreen
      order={detail.order}
      items={detail.items}
      tracking={detail.tracking}
      driver={driver}
    />
  );
}
