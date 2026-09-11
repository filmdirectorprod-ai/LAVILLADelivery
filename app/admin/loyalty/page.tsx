// /admin/loyalty — Server Component. Loyalty overview: members, the points ledger
// feed and 30-day flow (0053 RPCs — staff only, since loyalty_ledger is owner-only
// under RLS), the rewards catalogue, and whether the caller may edit that shared
// catalogue (super-admin: staff with no agency).
import { createServerSupabase } from '@/lib/supabase/server';
import { getAdminLoyaltyMembers } from '@/lib/queries';
import { toFlow, toLedgerEntries } from '@/lib/admin-loyalty';
import { LoyaltyAdminScreen } from '@/components/admin/loyalty/LoyaltyAdminScreen';
import type { Reward } from '@/lib/types';

export default async function LoyaltyPage() {
  const supabase = await createServerSupabase();
  const [members, activityRes, flowRes, rewardsRes, branchRes] = await Promise.all([
    getAdminLoyaltyMembers(),
    supabase.rpc('admin_loyalty_activity', { p_limit: 30 }),
    supabase.rpc('admin_loyalty_flow', { p_days: 30 }),
    supabase.from('rewards').select('id, title, cost_pts, image_url, active').order('cost_pts'),
    supabase.rpc('lv_staff_branch'),
  ]);

  return (
    <LoyaltyAdminScreen
      members={members}
      activity={toLedgerEntries(activityRes.data)}
      flow={toFlow(flowRes.data)}
      rewards={(rewardsRes.data ?? []) as Reward[]}
      ledgerReady={!activityRes.error && !flowRes.error}
      canEditRewards={!branchRes.error && !branchRes.data}
    />
  );
}
