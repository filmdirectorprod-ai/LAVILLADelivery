// /cart — Server Component. Fetches the catalog (to resolve cart lines), the
// delivery zones and the user's saved addresses: the fee preview must use the
// zone of the address the order will actually go to, not the first zone in the
// table (0054 — the cart used to announce the same fee to every neighbourhood).
// Per request, not prerendered — see /search: the cached catalogue reads no
// cookies, and prerendering would make the build depend on a live Supabase.
export const dynamic = 'force-dynamic';

import { getProducts, getZones, getMyAddresses } from '@/lib/queries';
import { CartScreen } from '@/components/screens/CartScreen';

export default async function CartPage() {
  const [products, zones, addresses] = await Promise.all([getProducts(), getZones(), getMyAddresses()]);
  // Addresses come default-first; its zone drives the fee shown in the cart.
  const defaultAddress = addresses[0] ?? null;
  const zone = zones.find((z) => z.id === defaultAddress?.zone_id) ?? zones[0] ?? null;
  return <CartScreen products={products} zone={zone} addressLabel={defaultAddress?.line1 ?? null} />;
}
