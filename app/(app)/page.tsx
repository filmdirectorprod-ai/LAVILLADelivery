// Home (/) — Server Component. Fetches the catalog + delivery zones + the
// user's profile, saved addresses, and unread notification count, then renders
// the client HomeScreen. The header reflects the real avatar and the default
// delivery address (its zone drives the ETA/fee badge), staying in sync with
// the profile + addresses pages.
import { getProducts, getCategories, getZones, getMyNotifications, getMyProfile, getMyAddresses } from '@/lib/queries';
import { isNotificationEnabled } from '@/lib/notifications';
import { HomeScreen } from '@/components/screens/HomeScreen';

export default async function HomePage() {
  const [products, categories, zones, notifications, profile, addresses] = await Promise.all([
    getProducts(),
    getCategories(),
    getZones(),
    getMyNotifications(),
    getMyProfile(),
    getMyAddresses(),
  ]);

  // Default delivery address (query returns default-first) drives the header.
  const defaultAddress = addresses[0] ?? null;
  const zone = zones.find((z) => z.id === defaultAddress?.zone_id) ?? zones[0] ?? null;
  // Unread badge counts only kinds the user opted into (in sync with Paramètres).
  const unread = notifications.filter(
    (n) => !n.read && isNotificationEnabled(n.kind, profile?.settings),
  ).length;

  return (
    <HomeScreen
      products={products}
      categories={categories}
      zone={zone}
      unread={unread}
      profile={profile}
      defaultAddress={defaultAddress}
    />
  );
}
