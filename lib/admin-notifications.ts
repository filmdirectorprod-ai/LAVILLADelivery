// Pure, side-effect-free helpers for the admin notification bell. The bell
// (components/admin/NotificationBell.tsx) subscribes to realtime INSERTs on orders
// and incidents and turns each raw row into a uniform AdminNotification, keeps a
// capped, de-duplicated list (newest first), and formats the unread badge and the
// relative timestamp shown in the dropdown. No React, no I/O — unit testable.

export type AdminNotificationKind = 'order' | 'incident';

export interface AdminNotification {
  /** Stable key `${kind}:${rowId}` so a re-delivered realtime event can dedupe. */
  id: string;
  kind: AdminNotificationKind;
  /** Human label, e.g. "Nouvelle commande LV-001". */
  title: string;
  /** Admin screen to open when the entry is clicked. */
  href: string;
  /** ISO timestamp of the source row. */
  at: string;
}

const MAX_NOTIFICATIONS = 30;

/** Build a notification from a freshly inserted order row. */
export function orderNotification(row: {
  id: string;
  code: string | null;
  placed_at?: string | null;
}): AdminNotification {
  return {
    id: `order:${row.id}`,
    kind: 'order',
    title: `Nouvelle commande ${row.code ?? ''}`.trim(),
    href: '/admin/orders',
    at: row.placed_at ?? new Date().toISOString(),
  };
}

/** Build a notification from a freshly inserted incident row. */
export function incidentNotification(row: {
  id: string;
  title: string | null;
  created_at?: string | null;
}): AdminNotification {
  const label = (row.title ?? '').trim() || 'Incident';
  return {
    id: `incident:${row.id}`,
    kind: 'incident',
    title: `Nouvel incident · ${label}`,
    href: '/admin/incidents',
    at: row.created_at ?? new Date().toISOString(),
  };
}

/** Prepend a notification, drop any existing entry with the same id (so a
 *  re-delivered realtime event moves to the front without duplicating), and cap
 *  the list length. */
export function prependNotification(
  list: AdminNotification[],
  next: AdminNotification,
  max: number = MAX_NOTIFICATIONS,
): AdminNotification[] {
  const deduped = list.filter((n) => n.id !== next.id);
  return [next, ...deduped].slice(0, max);
}

/** Badge text for the unread count: '' hides the badge, capped at '9+'. */
export function unreadBadge(count: number): string {
  if (count <= 0) return '';
  return count > 9 ? '9+' : String(count);
}

/** Short French relative time for a notification timestamp. */
export function relativeTime(at: string, now: number = Date.now()): string {
  const then = Date.parse(at);
  if (Number.isNaN(then)) return '';
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 60) return "à l'instant";
  const min = Math.round(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}
