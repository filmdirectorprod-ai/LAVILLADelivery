// /ramadan — Server Component. Fetches the catalog and narrows it to the
// 'ramadan' category for the curated Ftour selection.
// Per request, not prerendered — see /search: the cached catalogue reads no
// cookies, and prerendering would make the build depend on a live Supabase.
export const dynamic = 'force-dynamic';

import { getProducts } from '@/lib/queries';
import { RamadanScreen } from '@/components/screens/RamadanScreen';

export default async function RamadanPage() {
  const products = await getProducts();
  const ramadan = products.filter((p) => p.category === 'ramadan');
  return <RamadanScreen products={ramadan} />;
}
