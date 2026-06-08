// Pure, side-effect-free helpers for the admin Support screen. Flat support
// messages are folded into one thread PER DRIVER (including drivers with no
// messages, shown after those who wrote in) so the manager sees the whole roster.
// Each thread carries the driver's presence + avatar + a display matricule, the
// staff-unread count, and its messages oldest-first. The same logic serves the
// server first-paint and the client realtime refetch, and stays unit testable.
// No React, no I/O.

import type { SupportMessage } from '@/lib/types';

export interface SupportDriver {
  id: string;
  name: string;
  avatarUrl: string | null;
  isOnline: boolean;
  /** Display label derived from the roster position, e.g. "LV-01". */
  matricule: string;
}

export interface SupportThread {
  driver: SupportDriver;
  /** This driver's messages, oldest first (empty for drivers who never wrote). */
  messages: SupportMessage[];
  /** Driver messages not yet read by staff. */
  unread: number;
}

export interface RawSupportDriver {
  id: string;
  name: string;
  avatar_url?: string | null;
  is_online?: boolean | null;
}

/** Initials for the avatar fallback, e.g. "Karim Benali" → "KB". */
export function driverInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** One-line preview of a thread for the list: last message (with a "Vous : "
 *  prefix for staff replies), or "Aucun message" when the driver never wrote. */
export function threadPreview(thread: SupportThread): string {
  const last = thread.messages[thread.messages.length - 1];
  if (!last) return 'Aucun message';
  return last.sender === 'staff' ? `Vous : ${last.body}` : last.body;
}

/** Build one thread per driver. Threads are ordered: unread first, then drivers
 *  with messages by most-recent, then drivers with no messages (online first,
 *  then alphabetical). Messages within a thread are oldest-first. The display
 *  matricule LV-NN is derived from each driver's position in the input roster. */
export function buildSupportThreads(
  messages: SupportMessage[],
  drivers: RawSupportDriver[],
): SupportThread[] {
  const byDriver = new Map<string, SupportMessage[]>();
  for (const m of messages) {
    const cur = byDriver.get(m.driver_id);
    if (cur) cur.push(m);
    else byDriver.set(m.driver_id, [m]);
  }

  const threads: SupportThread[] = drivers.map((d, i) => {
    const msgs = (byDriver.get(d.id) ?? [])
      .slice()
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const unread = msgs.filter((m) => m.sender === 'driver' && !m.read_by_staff).length;
    return {
      driver: {
        id: d.id,
        name: d.name,
        avatarUrl: d.avatar_url ?? null,
        isOnline: d.is_online ?? false,
        matricule: `LV-${String(i + 1).padStart(2, '0')}`,
      },
      messages: msgs,
      unread,
    };
  });

  threads.sort((a, b) => {
    const ua = a.unread > 0 ? 1 : 0;
    const ub = b.unread > 0 ? 1 : 0;
    if (ua !== ub) return ub - ua;

    const lastA = a.messages[a.messages.length - 1]?.created_at;
    const lastB = b.messages[b.messages.length - 1]?.created_at;
    if (lastA && lastB) return Date.parse(lastB) - Date.parse(lastA);
    if (lastA) return -1; // a has messages, b doesn't → a first
    if (lastB) return 1; // b has messages, a doesn't → b first

    // both empty → online first, then alphabetical
    const oa = a.driver.isOnline ? 1 : 0;
    const ob = b.driver.isOnline ? 1 : 0;
    if (oa !== ob) return ob - oa;
    return a.driver.name.localeCompare(b.driver.name);
  });
  return threads;
}
