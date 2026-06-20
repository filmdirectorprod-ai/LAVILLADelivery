// /admin/promotions — Server Component. Lists promo codes (RLS-scoped: a branch
// gérant sees only their agency's, the super-admin sees all) + the branches for the
// editor, then renders the client management screen.
import { createServerSupabase } from '@/lib/supabase/server';
import { PromotionsScreen } from '@/components/admin/promotions/PromotionsScreen';
import type { Branch, Promotion } from '@/lib/types';

export default async function PromotionsPage() {
  const supabase = await createServerSupabase();
  const [{ data: promos }, { data: branches }, { data: reds }] = await Promise.all([
    supabase.from('promotions').select('*').order('created_at', { ascending: false }),
    supabase.from('branches').select('*').eq('is_active', true).order('slug'),
    supabase.from('promo_redemptions').select('promotion_id'),
  ]);

  // Usage count per promo, for the "N utilisations" + auto status.
  const uses: Record<string, number> = {};
  for (const r of reds ?? []) {
    const id = (r as { promotion_id: string }).promotion_id;
    uses[id] = (uses[id] ?? 0) + 1;
  }

  return (
    <PromotionsScreen
      initial={(promos ?? []) as Promotion[]}
      branches={(branches ?? []) as Branch[]}
      uses={uses}
    />
  );
}
