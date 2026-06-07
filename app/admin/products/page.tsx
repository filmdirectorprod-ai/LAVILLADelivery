import { getAdminProductsData } from '@/lib/queries';
import { ProductsScreen } from '@/components/admin/products/ProductsScreen';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const initial = await getAdminProductsData();
  return <ProductsScreen initial={initial} />;
}
