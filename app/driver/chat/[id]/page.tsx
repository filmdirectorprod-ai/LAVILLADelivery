// /driver/chat/[id] — Server Component. Loads the order, the customer contact
// (driver_order_contact RPC), and the existing messages, then renders the
// realtime driver chat. Driver chat access is granted by migration 0012.
import { notFound } from 'next/navigation';
import { getOrderDetail, getDriverOrderContact, getChatMessages } from '@/lib/queries';
import { DriverChatScreen } from '@/components/driver/DriverChatScreen';

export default async function DriverChatPage({ params }: { params: { id: string } }) {
  const detail = await getOrderDetail(params.id);
  if (!detail) notFound();
  const [contact, messages] = await Promise.all([
    getDriverOrderContact(params.id),
    getChatMessages(params.id),
  ]);
  return <DriverChatScreen order={detail.order} contact={contact} initialMessages={messages} />;
}
