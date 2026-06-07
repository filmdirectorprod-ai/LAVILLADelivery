import { getAdminPlanningData } from '@/lib/queries';
import { PlanningScreen } from '@/components/admin/planning/PlanningScreen';

export const dynamic = 'force-dynamic';

export default async function AdminPlanningPage() {
  const initial = await getAdminPlanningData();
  return <PlanningScreen initial={initial} />;
}
