// /search — Server Component. Fetches the full catalog + categories, then
// renders the client SearchScreen (filter/sort/search are client-side).
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
