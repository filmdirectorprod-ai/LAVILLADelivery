// Driver order detail (/driver/order/[id]) — Server Component. Loads the order
// (RLS lets a driver read it while it is available or assigned to them), and the
// customer contact when this driver has already claimed it. Renders the client
// screen that handles accept / stage actions / live GPS streaming.
import { notFound } from 'next/navigation';
import { getMyDriver, getOrderDetail, getDriverOrderContact } from '@/lib/queries';
import { DriverOrderScreen } from '@/components/driver/DriverOrderScreen';

export default async function DriverOrderPage({ params }: { params: { id: string } }) {
  const driver = await getMyDriver();
  if (!driver) return null; // layout gate already handles this

  const detail = await getOrderDetail(params.id);
  if (!detail) notFound();

  const isMine = detail.tracking?.driver_id === driver.id && !!detail.tracking?.manual;
  const contact = isMine ? await getDriverOrderContact(params.id) : null;

  return <DriverOrderScreen driverId={driver.id} detail={detail} initialContact={contact} />;
}
