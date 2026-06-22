'use client';
// Registers the PWA service worker AND keeps the installed apps up to date:
//  - reloads once when a new service worker takes control (a fresh deploy), so the
//    customer/driver/admin apps always run the latest code without a manual reload;
//  - checks for a new version whenever the app returns to the foreground.
// First-install is excluded from the reload (only genuine updates trigger it).
import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // Was the page already controlled by a SW when it loaded? If so, a later
    // controllerchange means a NEW version activated → reload. On the very first
    // install there's no controller yet, so we don't reload.
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    let reg: ServiceWorkerRegistration | undefined;
    const register = async () => {
      try {
        reg = await navigator.serviceWorker.register('/sw.js');
      } catch {
        /* registration failed — app still works, just not installable/offline */
      }
    };
    const onLoad = () => {
      void register();
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });

    // Pick up new deploys when the installed app comes back to the foreground.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && reg) reg.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('load', onLoad);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}
