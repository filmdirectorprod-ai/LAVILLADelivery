// /admin/customers — Server Component. Customer directory (RLS-scoped to the
// caller's agency via the orders read), rendered by the client CRM screen.
import { getAdminCrmData } from '@/lib/queries';
import { CrmScreen } from '@/components/admin/crm/CrmScreen';

export default async function CustomersPage() {
  const { rows, orders } = await getAdminCrmData();
  return <CrmScreen rows={rows} orders={orders} />;
}
