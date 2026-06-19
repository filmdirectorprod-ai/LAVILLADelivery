// The admin login is the install entry point for the "La Villa Admin" PWA, so it
// carries the admin manifest + apple identity (the page itself is a client form).
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  applicationName: 'La Villa Admin',
  title: 'La Villa Admin — Connexion',
  manifest: '/manifest.admin.webmanifest',
  appleWebApp: { capable: true, title: 'La Villa Admin', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/icons/admin-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/admin-180.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = { themeColor: '#1c2a37' };

export default function AdminAuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
