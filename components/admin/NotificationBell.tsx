'use client';
// Admin notification bell. Subscribes to realtime INSERTs on `orders` and
// `incidents`, shows an unread badge, and lists recent events in a dropdown (each
// links to its screen). Once the manager clicks "Activer son + alertes" we get a
// user gesture, so we can create the AudioContext (autoplay policy) and ask for the
// browser Notification permission; subsequent events then fire a desktop
// notification and a short beep. All formatting is in lib/admin-notifications.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/ui/Icon';
import {
  orderNotification,
  incidentNotification,
  prependNotification,
  unreadBadge,
  relativeTime,
  type AdminNotification,
} from '@/lib/admin-notifications';

export function NotificationBell() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const openRef = useRef(false);
  const pushRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const beep = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
    } catch {
      /* audio not available — ignore */
    }
  }, []);

  const notify = useCallback(
    (n: AdminNotification) => {
      setItems((prev) => prependNotification(prev, n));
      if (!openRef.current) setUnread((u) => u + 1);
      if (pushRef.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(n.title, {
            body: n.kind === 'order' ? 'Nouvelle commande reçue' : 'Incident signalé',
            tag: n.id,
          });
        } catch {
          /* notification blocked — ignore */
        }
        beep();
      }
    },
    [beep],
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new as { id: string; code: string | null; placed_at: string | null };
        notify(orderNotification(row));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, (payload) => {
        const row = payload.new as { id: string; title: string | null; created_at: string | null };
        notify(incidentNotification(row));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [notify]);

  const enablePush = useCallback(async () => {
    // Runs inside a click → allowed to create/resume the AudioContext and prompt.
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx && !audioRef.current) audioRef.current = new Ctx();
      await audioRef.current?.resume?.();
    } catch {
      /* ignore */
    }
    if (typeof Notification !== 'undefined') {
      try {
        const perm =
          Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
        if (perm === 'granted') {
          pushRef.current = true;
          setPushOn(true);
          beep();
        }
      } catch {
        /* ignore */
      }
    }
  }, [beep]);

  const toggle = useCallback(() => {
    setOpen((o) => {
      const next = !o;
      if (next) setUnread(0);
      return next;
    });
  }, []);

  const badge = unreadBadge(unread);

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          borderRadius: 12,
          border: '1px solid var(--line)',
          background: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="bell" size={20} color="var(--ink)" />
        {badge && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              background: 'var(--brand)',
              color: '#fff',
              fontFamily: 'var(--ui-font)',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 48,
              width: 320,
              maxHeight: 420,
              overflow: 'auto',
              background: '#fff',
              border: '1px solid var(--line)',
              borderRadius: 16,
              boxShadow: '0 12px 30px -12px rgba(0,0,0,0.35)',
              zIndex: 50,
              padding: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px 10px' }}>
              <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
                Notifications
              </span>
              {pushOn ? (
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--brand)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="check" size={14} color="var(--brand)" /> Activées
                </span>
              ) : (
                <button
                  type="button"
                  onClick={enablePush}
                  style={{ border: 'none', background: 'var(--brand)', color: '#fff', borderRadius: 999, padding: '5px 10px', fontFamily: 'var(--ui-font)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  Activer son + alertes
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>
                Aucune notification
              </div>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 10, borderRadius: 10, textDecoration: 'none' }}
                >
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      flexShrink: 0,
                      borderRadius: 8,
                      background: n.kind === 'order' ? 'rgba(19,124,139,0.12)' : 'rgba(168,151,35,0.16)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={n.kind === 'order' ? 'bag' : 'info'} size={16} color={n.kind === 'order' ? 'var(--brand)' : 'var(--gold)'} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: 'var(--ui-font)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      {n.title}
                    </span>
                    <span style={{ display: 'block', fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                      {relativeTime(n.at)}
                    </span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
