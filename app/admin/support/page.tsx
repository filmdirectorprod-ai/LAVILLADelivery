import { getAdminSupportData } from '@/lib/queries';
import { SupportScreen } from '@/components/admin/support/SupportScreen';

export const dynamic = 'force-dynamic';

export default async function AdminSupportPage() {
  const initial = await getAdminSupportData();
  return <SupportScreen initial={initial} />;
}
