'use client';
// Wraps the driver section so the bottom DriverTabBar appears on the top-level
// screens (Accueil / Historique / Gains / Profil) but not on the deeper flows
// (order detail, settings) which render their own back-button headers and want
// the full viewport height.
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { DriverTabBar } from '@/components/driver/DriverTabBar';
import { DriverPresence } from '@/components/driver/DriverPresence';
import { DriverGeoStream } from '@/components/driver/DriverGeoStream';

const TAB_ROUTES = ['/driver', '/driver/requests', '/driver/history', '/driver/earnings', '/driver/profile'];

export function DriverChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showTabs = TAB_ROUTES.includes(pathname);

  return (
    <>
      <DriverPresence />
      <DriverGeoStream />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      {showTabs && <DriverTabBar />}
    </>
  );
}
