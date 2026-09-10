// Pure, testable helpers for the admin Gérants screen: each agency's activity
// today, a readable "last sign-in" and the credentials text a super-admin hands
// to a gérant. No React, no I/O.

export interface BranchActivity {
  /** Non-cancelled orders. */
  orders: number;
  /** Revenue of those orders, DH. */
  revenue: number;
}

/** Today's activity per branch id ('none' for orders with no agency).
 *  Cancelled orders count for neither figure. */
export function branchActivity(orders: { branch_id: string | null; status: string; total_dh: number }[]): Record<string, BranchActivity> {
  const out: Record<string, BranchActivity> = {};
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    const key = o.branch_id ?? 'none';
    const cur = out[key] ?? { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number(o.total_dh) || 0;
    out[key] = cur;
  }
  return out;
}

/** "Jamais connecté", "À l'instant", "Il y a 5 min" … then a date in the
 *  agency timezone past a week. */
export function lastSeenLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return 'Jamais connecté';
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return 'Jamais connecté';
  const mins = Math.floor((now.getTime() - at) / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days} j`;
  return `le ${new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Casablanca' })}`;
}

/** The two lines a super-admin sends to a gérant. */
export function credentialsText(email: string, password: string): string {
  return `Identifiant : ${email}\nMot de passe : ${password}`;
}
