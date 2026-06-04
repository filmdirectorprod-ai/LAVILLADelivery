// /product/[slug] — Server Component. Resolves the product by slug; 404s when
// missing. The client ProductScreen handles customization + add-to-cart.
import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/lib/queries';
import { ProductScreen } from '@/components/screens/ProductScreen';

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProductBySlug(params.slug);
  if (!product) notFound();

  return <ProductScreen product={product} />;
}
