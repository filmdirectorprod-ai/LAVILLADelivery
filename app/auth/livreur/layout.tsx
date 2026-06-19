// The driver login is the install entry point for the "La Villa Livreur" PWA, so it
// carries the driver manifest + apple identity (the page itself is a client form).
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  applicationName: 'La Villa Livreur',
  title: 'La Villa Livreur — Connexion',
  manifest: '/manifest.driver.webmanifest',
  appleWebApp: { capable: true, title: 'La Villa Livreur', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/icons/driver-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/driver-180.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = { themeColor: '#1f7a49' };

export default function DriverAuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
