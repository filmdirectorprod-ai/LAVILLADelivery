// /checkout — Server Component. Fetches the catalog (to build the order items),
// the delivery zones, the user's saved addresses, and the signed-in profile
// (loyalty balance). The client CheckoutScreen lets the user pick a saved
// delivery address (its zone drives the fee) and posts to /api/orders, which
// runs the place_order RPC.
import { getProducts, getZones, getMyProfile, getMyAddresses } from '@/lib/queries';
import { CheckoutScreen } from '@/components/screens/CheckoutScreen';

export default async function CheckoutPage() {
  const [products, zones, profile, addresses] = await Promise.all([
    getProducts(),
    getZones(),
    getMyProfile(),
    getMyAddresses(),
  ]);
  return <CheckoutScreen products={products} zones={zones} addresses={addresses} profile={profile} />;
}
