// Admin (gérant) section — staff gate. Auth is already enforced by middleware;
// here we additionally require profiles.is_staff (checked via getMyStaff()).
// Non-staff get AdminGate. Lives in its own segment so it never inherits the
// customer TabBar or the driver chrome.
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { getMyStaff } from '@/lib/queries';
import { AdminGate } from '@/components/admin/AdminGate';
import { AdminChrome } from '@/components/admin/AdminChrome';

// Admin PWA identity (overrides the customer default from the root layout).
export const metadata: Metadata = {
  applicationName: 'La Villa Admin',
  title: 'La Villa Admin',
  manifest: '/manifest.admin.webmanifest',
  appleWebApp: { capable: true, title: 'La Villa Admin', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/icons/admin-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/admin-180.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = { themeColor: '#1c2a37' };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await getMyStaff();
  if (!staff) return <AdminGate />;
  return <AdminChrome managerName={staff.full_name || 'Gérant'}>{children}</AdminChrome>;
}
