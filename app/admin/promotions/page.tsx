// /admin/promotions — Server Component. Lists promo codes (RLS-scoped: a branch
// gérant sees only their agency's, the super-admin sees all), the branches for
// the editor, and the latest 500 redemptions with the order each one paid for —
// enough for the headline figures and the recent-uses feed at La Villa's scale.
import { createServerSupabase } from '@/lib/supabase/server';
import { PromotionsScreen } from '@/components/admin/promotions/PromotionsScreen';
import { REDEMPTIONS_SELECT, toRedemptions } from '@/lib/admin-promotions';
import type { Branch, Promotion } from '@/lib/types';

export default async function PromotionsPage() {
  const supabase = await createServerSupabase();
  const [{ data: promos }, { data: branches }, { data: reds }] = await Promise.all([
    supabase.from('promotions').select('*').order('created_at', { ascending: false }),
    supabase.from('branches').select('*').eq('is_active', true).order('slug'),
    supabase.from('promo_redemptions').select(REDEMPTIONS_SELECT).order('created_at', { ascending: false }).limit(500),
  ]);

  return (
    <PromotionsScreen
      initial={(promos ?? []) as Promotion[]}
      branches={(branches ?? []) as Branch[]}
      redemptions={toRedemptions(reds)}
    />
  );
}
