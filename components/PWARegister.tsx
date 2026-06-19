'use client';
// Registers the PWA service worker once on the client. Mounted in the root layout
// so it runs for the customer, driver and admin apps alike. Renders nothing.
import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* registration failed — app still works, just not installable/offline */
      });
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
