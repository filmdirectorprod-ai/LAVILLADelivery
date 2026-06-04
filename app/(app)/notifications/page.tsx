// /notifications — Server Component. Fetches the user's notifications (newest
// first) and renders the live NotificationsScreen.
import { getMyNotifications } from '@/lib/queries';
import { NotificationsScreen } from '@/components/screens/NotificationsScreen';

export default async function NotificationsPage() {
  const notifications = await getMyNotifications();
  return <NotificationsScreen notifications={notifications} />;
}
