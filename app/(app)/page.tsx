// Home (/) — Server Component. Fetches the catalog + delivery zone + unread
// notification count, then renders the client HomeScreen.
import { getProducts, getCategories, getZones, getMyNotifications } from '@/lib/queries';
import { HomeScreen } from '@/components/screens/HomeScreen';

export default async function HomePage() {
  const [products, categories, zones, notifications] = await Promise.all([
    getProducts(),
    getCategories(),
    getZones(),
    getMyNotifications(),
  ]);

  const zone = zones[0] ?? null;
  const unread = notifications.filter((n) => !n.read).length;

  return <HomeScreen products={products} categories={categories} zone={zone} unread={unread} />;
}
