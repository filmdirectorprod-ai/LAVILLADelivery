// /admin/customers — Server Component. Customer directory, aggregated in
// Postgres and scoped to the caller's agency (admin_customer_rows, 0051), then
// rendered by the client CRM screen — which loads a customer's order history on
// demand rather than receiving every order up front.
import { getAdminCrmData } from '@/lib/queries';
import { CrmScreen } from '@/components/admin/crm/CrmScreen';

export default async function CustomersPage() {
  const { rows } = await getAdminCrmData();
  return <CrmScreen rows={rows} />;
}
