'use client';
// Floating "Activer les notifications" prompt. Shows only when: the browser
// supports Web Push, a user is signed in, and permission hasn't been decided yet.
// Tapping it (a required user gesture, esp. on iOS PWAs) requests permission,
// subscribes via PushManager, and stores the subscription through the
// save_push_subscription RPC. Self-mounts once in the root layout.
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function EnablePush() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === 'undefined') return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
      if (Notification.permission !== 'default') return; // granted or denied → don't nag
      if (sessionStorage.getItem('lv-push-dismissed') === '1') return;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled && user) setShow(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setShow(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const res = await fetch('/api/push/public-key');
      const { publicKey } = await res.json();
      if (!publicKey) throw new Error('no key');
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(publicKey) as BufferSource,
        });
      }
      const json = sub.toJSON();
      const supabase = createClient();
      await supabase.rpc('save_push_subscription', {
        p_endpoint: sub.endpoint,
        p_p256dh: json.keys?.p256dh ?? '',
        p_auth: json.keys?.auth ?? '',
      });
      setShow(false);
    } catch {
      /* user can retry later from the same prompt next session */
    } finally {
      setBusy(false);
    }
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
        transform: 'translateX(-50%)',
        zIndex: 200,
        width: 'min(380px, calc(100vw - 28px))',
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 16,
        boxShadow: '0 18px 44px -16px rgba(0,0,0,0.45)',
        padding: '13px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: 'var(--ui-font)',
      }}
    >
      <div style={{ fontSize: 22, lineHeight: 1 }}>🔔</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>Activer les notifications</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Commandes, messages et appels, même app fermée.</div>
      </div>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem('lv-push-dismissed', '1');
          setShow(false);
        }}
        aria-label="Plus tard"
        style={{ border: 'none', background: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer', padding: '0 2px' }}
      >
        ×
      </button>
      <button
        type="button"
        onClick={enable}
        disabled={busy}
        style={{
          border: 'none',
          background: 'var(--brand)',
          color: '#fff',
          borderRadius: 999,
          padding: '8px 14px',
          fontSize: 12.5,
          fontWeight: 700,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.7 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {busy ? '…' : 'Activer'}
      </button>
    </div>
  );
}
