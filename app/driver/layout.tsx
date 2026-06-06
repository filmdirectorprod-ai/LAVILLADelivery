// Driver ("livreur") section — role gate. Authentication is already enforced by
// middleware (every non-public route requires a session); here we additionally
// require the signed-in user to be a registered driver (a `drivers` row linked
// via user_id, see migration 0008). Non-drivers get a friendly dead-end instead
// of the dashboard. The route group lives outside (app) so it never inherits the
// customer TabBar / floating cart chrome.
import type { ReactNode } from 'react';
import { getMyDriver } from '@/lib/queries';
import { DriverGate } from '@/components/driver/DriverGate';

export default async function DriverLayout({ children }: { children: ReactNode }) {
  const driver = await getMyDriver();
  if (!driver) return <DriverGate />;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--soft)' }}>
      {children}
    </div>
  );
}
