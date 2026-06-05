// /notifications — Server Component. Fetches the user's notifications (newest
// first) + their notification preferences, then renders the live screen which
// respects those preferences (in sync with Paramètres).
import { getMyNotifications, getMyProfile } from '@/lib/queries';
import { NotificationsScreen } from '@/components/screens/NotificationsScreen';

export default async function NotificationsPage() {
  const [notifications, profile] = await Promise.all([getMyNotifications(), getMyProfile()]);
  return <NotificationsScreen notifications={notifications} settings={profile?.settings ?? null} />;
}
