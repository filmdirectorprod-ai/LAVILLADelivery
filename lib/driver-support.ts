// Pure helper for the driver Support badge. The driver app has no per-message
// read flag for the driver side (support_messages only tracks read_by_staff), so
// "unread" is computed device-locally: count staff replies that arrived after the
// last time this device opened the Support thread. No React, no I/O.

import type { SupportMessage } from '@/lib/types';

/** localStorage key holding the ISO timestamp this device last opened the driver
 *  Support thread. Shared by the dashboard badge and the Support screen. */
export const SUPPORT_SEEN_KEY = 'lv-driver-support-seen';

/** Number of staff replies newer than `lastSeenIso` (the ISO timestamp this
 *  device last opened Support). A null/blank/invalid lastSeen treats every staff
 *  message as unread. Driver-authored messages never count. */
export function unreadFromStaff(messages: SupportMessage[], lastSeenIso: string | null): number {
  const since = lastSeenIso ? Date.parse(lastSeenIso) : NaN;
  return messages.reduce((n, m) => {
    if (m.sender !== 'staff') return n;
    if (Number.isNaN(since)) return n + 1;
    const at = Date.parse(m.created_at);
    return !Number.isNaN(at) && at > since ? n + 1 : n;
  }, 0);
}
