// /cart — Server Component. Fetches the catalog (to resolve cart lines) + the
// delivery zone; the client CartScreen reads quantities from the cart store.
import { getProducts, getZones } from '@/lib/queries';
import { CartScreen } from '@/components/screens/CartScreen';

export default async function CartPage() {
  const [products, zones] = await Promise.all([getProducts(), getZones()]);
  return <CartScreen products={products} zone={zones[0] ?? null} />;
}
