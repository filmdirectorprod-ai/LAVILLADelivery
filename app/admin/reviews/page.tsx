import { getAdminReviewsData } from '@/lib/queries';
import { ReviewsScreen } from '@/components/admin/reviews/ReviewsScreen';

export const dynamic = 'force-dynamic';

export default async function AdminReviewsPage() {
  const initial = await getAdminReviewsData();
  return <ReviewsScreen initial={initial} />;
}
