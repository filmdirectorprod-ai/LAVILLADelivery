// /driver/requests — Server Component. The "Demandes" pool: every still-active,
// unclaimed order any driver can accept (RLS-scoped board), rendered by the
// realtime client screen.
import { getMyDriver, getDriverBoard } from '@/lib/queries';
import { DriverRequestsScreen } from '@/components/driver/DriverRequestsScreen';

export default async function DriverRequestsPage() {
  const driver = await getMyDriver();
  const board = await getDriverBoard(driver?.branch_id);
  return <DriverRequestsScreen initialBoard={board} branchId={driver?.branch_id} />;
}
