// Driver ("livreur") section — role gate. Authentication is already enforced by
// middleware (every non-public route requires a session); here we additionally
// require the signed-in user to be a registered driver (a `drivers` row linked
// via user_id, see migration 0008). Non-drivers get a friendly dead-end instead
// of the dashboard. The route group lives outside (app) so it never inherits the
// customer TabBar / floating cart chrome.
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { getMyDriver } from '@/lib/queries';
import { DriverGate } from '@/components/driver/DriverGate';
import { DriverChrome } from '@/components/driver/DriverChrome';

// Driver PWA identity (overrides the customer default from the root layout).
export const metadata: Metadata = {
  applicationName: 'La Villa Livreur',
  title: 'La Villa Livreur',
  manifest: '/manifest.driver.webmanifest',
  appleWebApp: { capable: true, title: 'La Villa Livreur', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/icons/driver-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/driver-180.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = { themeColor: '#1f7a49' };

export default async function DriverLayout({ children }: { children: ReactNode }) {
  const driver = await getMyDriver();
  if (!driver) return <DriverGate />;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--soft)' }}>
      <DriverChrome>{children}</DriverChrome>
    </div>
  );
}
