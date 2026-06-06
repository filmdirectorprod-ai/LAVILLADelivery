// Admin (gérant) section — staff gate. Auth is already enforced by middleware;
// here we additionally require profiles.is_staff (checked via getMyStaff()).
// Non-staff get AdminGate. Lives in its own segment so it never inherits the
// customer TabBar or the driver chrome.
import type { ReactNode } from 'react';
import { getMyStaff } from '@/lib/queries';
import { AdminGate } from '@/components/admin/AdminGate';
import { AdminChrome } from '@/components/admin/AdminChrome';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await getMyStaff();
  if (!staff) return <AdminGate />;
  return <AdminChrome managerName={staff.full_name || 'Gérant'}>{children}</AdminChrome>;
}
