// /checkout — Server Component. Fetches the catalog (to build the order items),
// the delivery zone, and the signed-in profile (loyalty balance). The client
// CheckoutScreen posts to /api/orders, which runs the place_order RPC.
import { getProducts, getZones, getMyProfile } from '@/lib/queries';
import { CheckoutScreen } from '@/components/screens/CheckoutScreen';

export default async function CheckoutPage() {
  const [products, zones, profile] = await Promise.all([getProducts(), getZones(), getMyProfile()]);
  return <CheckoutScreen products={products} zone={zones[0] ?? null} profile={profile} />;
}
