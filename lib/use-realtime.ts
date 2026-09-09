'use client';
// Shared Realtime subscription helper.
//
// Every live screen used to open its own channel with `event: '*'` and NO
// filter, then run a full refetch on each event — so one order placed anywhere
// in the city re-pulled the whole board on every connected driver and admin
// device. Two fixes live here:
//   • `filter` is passed through to postgres_changes, so the server only sends
//     rows the screen actually cares about (per-agency, per-driver, per-order);
//   • callbacks are debounced, so a burst (an order row + its tracking row +
//     its items landing together) collapses into a single refetch.
//
// Channel topics are suffixed per hook instance: two mounted copies of the same
// screen would otherwise share a topic and the second `subscribe()` would be a
// no-op.
import { useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface RealtimeSub {
  table: string;
  /** Defaults to '*' (INSERT + UPDATE + DELETE). */
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  /** PostgREST filter, e.g. `branch_id=eq.<uuid>`. Omit only when the screen
   *  genuinely needs every row it is allowed to see. */
  filter?: string;
}

type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>;

let seq = 0;

/**
 * Subscribe to postgres_changes and call `handler` when something matches.
 *
 * @param name       channel topic prefix (a per-instance suffix is added)
 * @param subs       tables/filters to listen on; a `null` entry is skipped,
 *                   which keeps call sites tidy when a filter value is not
 *                   known yet (the hook then subscribes to the rest)
 * @param handler    called with the change payload
 * @param debounceMs 0 fires immediately (use when the payload matters, e.g. a
 *                   toast per INSERT); >0 collapses bursts and passes only the
 *                   last payload (use for refetch-the-list handlers)
 * @param enabled    set false to skip subscribing entirely
 */
export function useRealtime(
  name: string,
  subs: (RealtimeSub | null | false)[],
  handler: (payload: Payload) => void,
  { debounceMs = 250, enabled = true }: { debounceMs?: number; enabled?: boolean } = {},
): void {
  // Keep the latest handler without resubscribing on every render.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const active = subs.filter((s): s is RealtimeSub => Boolean(s));
  // Resubscribe only when the tables/filters really change.
  const key = JSON.stringify(active);
  const list = useMemo(() => JSON.parse(key) as RealtimeSub[], [key]);

  useEffect(() => {
    if (!enabled || list.length === 0) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fire = (payload: Payload) => {
      if (debounceMs <= 0) {
        handlerRef.current(payload);
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        handlerRef.current(payload);
      }, debounceMs);
    };

    seq += 1;
    let channel = supabase.channel(`${name}-${seq}`);
    for (const sub of list) {
      channel = channel.on(
        'postgres_changes',
        { event: sub.event ?? '*', schema: 'public', table: sub.table, ...(sub.filter ? { filter: sub.filter } : {}) } as never,
        fire,
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [name, list, debounceMs, enabled]);
}
