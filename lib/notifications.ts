// Notification preference gating — keeps the notification feed, the unread
// badge, and the live inserts consistent with the toggles the user set on the
// Paramètres screen (profiles.settings). A missing preference defaults to ON,
// matching the SettingsScreen defaults.
import type { Notification, ProfileSettings } from '@/lib/types';

/**
 * Whether a notification of the given kind should be surfaced, given the user's
 * settings. `order` notifications follow `notify_orders`; promotional ones
 * (`promo`, `loyalty`) follow `notify_promos`. Anything else is always shown.
 */
export function isNotificationEnabled(kind: string, settings: ProfileSettings | null | undefined): boolean {
  const s = settings ?? {};
  if (kind === 'order') return s.notify_orders ?? true;
  if (kind === 'promo' || kind === 'loyalty') return s.notify_promos ?? true;
  return true;
}

/** Filter a notification list down to the kinds the user opted into. */
export function filterNotifications(
  list: Notification[],
  settings: ProfileSettings | null | undefined,
): Notification[] {
  return list.filter((n) => isNotificationEnabled(n.kind, settings));
}
