// /chat/[id] — Server Component. Loads the order (for code + assigned driver)
// and the existing chat history, then renders the Realtime ChatScreen.
import { notFound } from 'next/navigation';
import { getOrderDetail, getDriverById, getChatMessages } from '@/lib/queries';
import { ChatScreen } from '@/components/screens/ChatScreen';

export default async function ChatPage({ params }: { params: { id: string } }) {
  const detail = await getOrderDetail(params.id);
  if (!detail) notFound();
  const [driver, messages] = await Promise.all([
    getDriverById(detail.tracking?.driver_id ?? null),
    getChatMessages(params.id),
  ]);
  return <ChatScreen order={detail.order} driver={driver} initialMessages={messages} />;
}
