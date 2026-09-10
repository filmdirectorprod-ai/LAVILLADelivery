import { createServerClient } from '@supabase/ssr';

/**
 * Anonymous server client — NO request cookies, so it never sees a session.
 *
 * Use it only for tables whose SELECT policy is `using (true)` (products,
 * categories, delivery_zones, product_branch): the rows are identical for every
 * visitor, which is what makes them safe to hold in a shared server cache. For
 * anything owner-scoped, use createServerSupabase() instead — caching a
 * cookie-bound read would leak one user's rows to another.
 */
export function createPublicSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}
