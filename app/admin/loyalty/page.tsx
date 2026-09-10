// /admin/loyalty — Server Component. Loyalty overview + manual point adjustments.
import { getAdminLoyaltyMembers } from '@/lib/queries';
import { LoyaltyAdminScreen } from '@/components/admin/loyalty/LoyaltyAdminScreen';

export default async function LoyaltyPage() {
  const members = await getAdminLoyaltyMembers();
  return <LoyaltyAdminScreen members={members} />;
}
