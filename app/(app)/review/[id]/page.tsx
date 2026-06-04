// /review/[id] — Server Component. Loads the order + its items (for the recap)
// and the catalog (for thumbnails), then renders the ReviewScreen which posts to
// /api/reviews (submit_review RPC awards the +50 bonus server-side).
import { notFound } from 'next/navigation';
import { getOrderDetail, getProducts } from '@/lib/queries';
import { ReviewScreen } from '@/components/screens/ReviewScreen';

export default async function ReviewPage({ params }: { params: { id: string } }) {
  const [detail, products] = await Promise.all([getOrderDetail(params.id), getProducts()]);
  if (!detail) notFound();
  return <ReviewScreen order={detail.order} items={detail.items} products={products} />;
}
