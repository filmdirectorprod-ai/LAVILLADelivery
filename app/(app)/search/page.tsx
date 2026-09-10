// /search — Server Component. Fetches the full catalog + categories, then
// renders the client SearchScreen (filter/sort/search are client-side).
// Rendered per request, not prerendered: the catalogue query no longer reads
// cookies (it is served from the shared cache), which would otherwise make this
// page statically prerenderable and force the BUILD to reach Supabase. The cache
// still does its job — the rows are shared across requests, not refetched here.
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { getProducts, getCategories } from '@/lib/queries';
import { SearchScreen } from '@/components/screens/SearchScreen';

export default async function SearchPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  return (
    <Suspense fallback={null}>
      <SearchScreen products={products} categories={categories} />
    </Suspense>
  );
}
