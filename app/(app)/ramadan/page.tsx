// /ramadan — Server Component. Fetches the catalog and narrows it to the
// 'ramadan' category for the curated Ftour selection.
import { getProducts } from '@/lib/queries';
import { RamadanScreen } from '@/components/screens/RamadanScreen';

export default async function RamadanPage() {
  const products = await getProducts();
  const ramadan = products.filter((p) => p.category === 'ramadan');
  return <RamadanScreen products={ramadan} />;
}
