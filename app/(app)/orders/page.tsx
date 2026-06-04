// /orders — Server Component. Fetches the user's orders (with line items) plus
// the catalog (for thumbnails / reorder), then renders the client OrdersScreen.
import { getMyOrdersWithItems, getProducts } from '@/lib/queries';
import { OrdersScreen } from '@/components/screens/OrdersScreen';

export default async function OrdersPage() {
  const [orders, products] = await Promise.all([getMyOrdersWithItems(), getProducts()]);
  return <OrdersScreen orders={orders} products={products} />;
}
