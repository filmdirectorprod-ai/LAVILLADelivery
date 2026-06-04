// /call/[id] — Server Component. Loads the order + assigned driver, then renders
// the CallScreen (visual mock; no real telephony, deferred per scope).
import { notFound } from 'next/navigation';
import { getOrderDetail, getDriverById } from '@/lib/queries';
import { CallScreen } from '@/components/screens/CallScreen';

export default async function CallPage({ params }: { params: { id: string } }) {
  const detail = await getOrderDetail(params.id);
  if (!detail) notFound();
  const driver = await getDriverById(detail.tracking?.driver_id ?? null);
  return <CallScreen order={detail.order} driver={driver} />;
}
