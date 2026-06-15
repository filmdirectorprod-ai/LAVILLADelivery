// /driver/support — Server Component. Loads the signed-in driver and their
// support thread with the gérant (support_messages, RLS-scoped), then renders the
// chat which subscribes to Realtime for live staff replies.
import { getMyDriver, getMySupportMessages } from '@/lib/queries';
import { DriverSupportScreen } from '@/components/driver/DriverSupportScreen';

export default async function DriverSupportPage() {
  const driver = await getMyDriver();
  // driver is non-null here (layout gate), but guard for type-safety.
  if (!driver) return null;
  const messages = await getMySupportMessages();
  return <DriverSupportScreen driver={driver} initialMessages={messages} />;
}
