// Pure, side-effect-free helpers for the admin Support screen. Flat support
// messages are folded into per-driver threads (oldest message first, with the
// staff-unread count) here so the same logic serves the server first-paint and the
// client realtime refetch, and stays unit testable. No React, no I/O.

import type { SupportMessage } from '@/lib/types';

export interface SupportThread {
  driver: { id: string; name: string };
  /** This driver's messages, oldest first. */
  messages: SupportMessage[];
  /** Driver messages not yet read by staff. */
  unread: number;
}

/** One thread per driver that has any message. Threads are ordered unread-first,
 *  then by most recent message. Messages within a thread are oldest-first. */
export function buildSupportThreads(
  messages: SupportMessage[],
  drivers: { id: string; name: string }[],
): SupportThread[] {
  const nameByDriver = new Map(drivers.map((d) => [d.id, d.name]));
  const byDriver = new Map<string, SupportMessage[]>();
  for (const m of messages) {
    const cur = byDriver.get(m.driver_id);
    if (cur) cur.push(m);
    else byDriver.set(m.driver_id, [m]);
  }

  const threads: SupportThread[] = Array.from(byDriver.entries()).map(([driverId, msgs]) => {
    const sorted = msgs.slice().sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const unread = sorted.filter((m) => m.sender === 'driver' && !m.read_by_staff).length;
    return {
      driver: { id: driverId, name: nameByDriver.get(driverId) ?? 'Livreur' },
      messages: sorted,
      unread,
    };
  });

  threads.sort((a, b) => {
    if ((a.unread > 0 ? 1 : 0) !== (b.unread > 0 ? 1 : 0)) return b.unread - a.unread;
    const lastA = a.messages[a.messages.length - 1]?.created_at ?? '';
    const lastB = b.messages[b.messages.length - 1]?.created_at ?? '';
    return Date.parse(lastB) - Date.parse(lastA);
  });
  return threads;
}
