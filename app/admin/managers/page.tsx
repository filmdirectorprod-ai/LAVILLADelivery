// /admin/managers — Server Component. Super-admin only (staff with no branch).
// Lists the branches + existing branch gérants, and renders the creation form.
import { createServerSupabase } from '@/lib/supabase/server';
import { ManagersScreen } from '@/components/admin/managers/ManagersScreen';
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

  const [{ data: branches }, { data: managers }] = await Promise.all([
    supabase.from('branches').select('*').eq('is_active', true).order('slug'),
    supabase
      .from('profiles')
      .select('id, full_name, branch_id')
      .eq('is_staff', true)
      .not('branch_id', 'is', null),
  ]);

  return (
    <ManagersScreen
      branches={(branches ?? []) as Branch[]}
      managers={(managers ?? []) as { id: string; full_name: string | null; branch_id: string | null }[]}
    />
  );
}
