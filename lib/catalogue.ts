// Cached reads of the public catalogue.
//
// The catalogue is the same for everyone and changes a few times a day, but it
// was re-queried on every render of every page (all 20 admin pages are
// force-dynamic and the customer pages are cookie-bound, so nothing was ever
// reused). These wrap the public-read tables in unstable_cache, keyed by the
// serving agency, with a `catalogue` tag the admin screens invalidate through
// /api/revalidate the moment a product, category or zone changes.
import { unstable_cache } from 'next/cache';
import { createPublicSupabase } from '@/lib/supabase/public';
import type { Category, Product, Zone } from '@/lib/types';

/** Cache tag invalidated whenever staff edit the catalogue. */
export const CATALOGUE_TAG = 'catalogue';

/** Fallback TTL, so a missed invalidation self-heals within five minutes. */
const TTL = 300;

export const getCachedCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const supabase = createPublicSupabase();
    const { data } = await supabase.from('categories').select('*').order('sort');
    return (data ?? []) as Category[];
  },
  ['catalogue:categories'],
  { tags: [CATALOGUE_TAG], revalidate: TTL },
);

export const getCachedZones = unstable_cache(
  async (): Promise<Zone[]> => {
    const supabase = createPublicSupabase();
    const { data } = await supabase.from('delivery_zones').select('*').order('fee_dh');
    return (data ?? []) as Zone[];
  },
  ['catalogue:zones'],
  { tags: [CATALOGUE_TAG], revalidate: TTL },
);

/**
 * Active products, with the serving agency's stock overrides applied in the same
 * query (0035). Cached per branch id — `none` when no agency is known.
 */
export const getCachedProducts = unstable_cache(
  async (branchId?: string | null): Promise<Product[]> => {
    const supabase = createPublicSupabase();
    if (!branchId) {
      const { data } = await supabase.from('products').select('*').eq('active', true).order('created_at');
      return (data ?? []) as Product[];
    }
    const { data } = await supabase
      .from('products')
      .select('*, product_branch(in_stock)')
      .eq('active', true)
      .eq('product_branch.branch_id', branchId)
      .order('created_at');
    return (data ?? []).map((row) => {
      const { product_branch, ...product } = row as Product & { product_branch: { in_stock: boolean }[] | null };
      const override = Array.isArray(product_branch) ? product_branch[0] : product_branch;
      return (override ? { ...product, in_stock: override.in_stock } : product) as Product;
    });
  },
  ['catalogue:products'],
  { tags: [CATALOGUE_TAG], revalidate: TTL },
);
