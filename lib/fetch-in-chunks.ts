// Fetch every row matching a set of ids, in chunks.
//
// Supabase caps an API response at "Max rows" (Settings → API, 1000 by default),
// and it does it SILENTLY: the query succeeds and simply returns fewer rows. A
// `.in('order_id', ids)` over 200 orders crosses that line as soon as those
// orders average five line items — the screen then renders orders with missing
// items and nothing anywhere reports a problem.
//
// Chunking keeps each request comfortably under the cap and makes the total
// bounded by the id list instead of by a server setting.
import type { SupabaseClient } from '@supabase/supabase-js';

/** Ids per request. 60 × ~8 rows each stays well under a 1000-row cap. */
const CHUNK = 60;

export async function fetchAllIn<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  column: string,
  ids: string[],
  chunk = CHUNK,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += chunk) batches.push(ids.slice(i, i + chunk));
  const results = await Promise.all(
    batches.map((batch) => supabase.from(table).select(columns).in(column, batch)),
  );
  return results.flatMap((r) => (r.data ?? []) as T[]);
}
