import { getAdminIncidentsData } from '@/lib/queries';
import { IncidentsScreen } from '@/components/admin/incidents/IncidentsScreen';

export const dynamic = 'force-dynamic';

export default async function AdminIncidentsPage() {
  const initial = await getAdminIncidentsData();
  return <IncidentsScreen initial={initial} />;
}
