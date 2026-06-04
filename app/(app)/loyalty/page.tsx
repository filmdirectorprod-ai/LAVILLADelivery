// /loyalty — Server Component. Fetches the profile (balance + tier), the rewards
// catalog, the loyalty ledger (history), and the latest delivered order (so the
// "leave a review" CTA can deep-link). Renders the client LoyaltyScreen.
import { getMyProfile, getRewards, getMyLoyaltyLedger, getMyOrders } from '@/lib/queries';
import { LoyaltyScreen } from '@/components/screens/LoyaltyScreen';

export default async function LoyaltyPage() {
  const [profile, rewards, ledger, orders] = await Promise.all([
    getMyProfile(),
    getRewards(),
    getMyLoyaltyLedger(),
    getMyOrders(),
  ]);
  const reviewOrderId = orders.find((o) => o.status === 'delivered')?.id ?? null;
  return <LoyaltyScreen profile={profile} rewards={rewards} ledger={ledger} reviewOrderId={reviewOrderId} />;
}
