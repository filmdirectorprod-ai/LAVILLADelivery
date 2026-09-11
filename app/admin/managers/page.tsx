// /admin/managers — Server Component. Super-admin only (staff with no branch).
// Loads the branches, the branch gérants with their email and last sign-in (auth
// admin API, service role — server only) and today's orders per agency, then
// renders the Gérants screen.
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase/server';
import { ManagersScreen, type ManagerRow } from '@/components/admin/managers/ManagersScreen';
import { startOfTodayISO } from '@/lib/admin-overview';
import { branchActivity } from '@/lib/admin-managers';
import type { Branch } from '@/lib/types';

export default async function ManagersPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = user
    ? await supabase.from('profiles').select('is_staff, branch_id').eq('id', user.id).maybeSingle()
    : { data: null };

  const isSuperAdmin = !!me?.is_staff && !me?.branch_id;
  if (!isSuperAdmin) {
    return (
      <div style={{ padding: '40px 32px', fontFamily: 'var(--ui-font)', color: 'var(--muted)' }}>
        <h1 style={{ fontSize: 22, color: 'var(--ink)', fontWeight: 700, margin: '0 0 8px' }}>Gérants</h1>
        Cette section est réservée au super-admin.
      </div>
    );
  }

  const [{ data: branches }, { data: managers }, { data: todayOrders }] = await Promise.all([
    supabase.from('branches').select('*').eq('is_active', true).order('slug'),
    supabase.from('profiles').select('id, full_name, branch_id').eq('is_staff', true).not('branch_id', 'is', null),
    supabase.from('orders').select('branch_id, status, total_dh').gte('placed_at', startOfTodayISO()),
  ]);

  // Email + last sign-in live in auth.users, readable only with the service role.
  // Without it (missing key) the screen still works, just without those two lines.
  const auth = new Map<string, { email: string | null; last: string | null }>();
  try {
    const { data } = await createServiceSupabase().auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) auth.set(u.id, { email: u.email ?? null, last: u.last_sign_in_at ?? null });
  } catch {
    // leave emails / last sign-in empty
  }

  const rows: ManagerRow[] = ((managers ?? []) as { id: string; full_name: string | null; branch_id: string | null }[]).map((m) => ({
    ...m,
    email: auth.get(m.id)?.email ?? null,
    last_sign_in_at: auth.get(m.id)?.last ?? null,
  }));

  return (
    <ManagersScreen
      branches={(branches ?? []) as Branch[]}
      managers={rows}
      activity={branchActivity((todayOrders ?? []) as { branch_id: string | null; status: string; total_dh: number }[])}
    />
  );
}
