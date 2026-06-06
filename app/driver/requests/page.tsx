// /driver/requests — Server Component. The "Demandes" pool: every still-active,
// unclaimed order any driver can accept (RLS-scoped board), rendered by the
// realtime client screen.
import { getDriverBoard } from '@/lib/queries';
import { DriverRequestsScreen } from '@/components/driver/DriverRequestsScreen';

export default async function DriverRequestsPage() {
  const board = await getDriverBoard();
  return <DriverRequestsScreen initialBoard={board} />;
}
