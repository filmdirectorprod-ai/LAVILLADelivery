// /admin/promotions — Server Component. Lists promo codes (RLS-scoped: a branch
// gérant sees only their agency's, the super-admin sees all) + the branches for the
// editor, then renders the client management screen.
import { createServerSupabase } from '@/lib/supabase/server';
import { PromotionsScreen } from '@/components/admin/promotions/PromotionsScreen';
import type { Branch, Promotion } from '@/lib/types';

export default async function PromotionsPage() {
  const supabase = await createServerSupabase();
  const [{ data: promos }, { data: branches }] = await Promise.all([
    supabase.from('promotions').select('*').order('created_at', { ascending: false }),
    supabase.from('branches').select('*').eq('is_active', true).order('slug'),
  ]);

  return (
    <PromotionsScreen
      initial={(promos ?? []) as Promotion[]}
      branches={(branches ?? []) as Branch[]}
    />
  );
}
