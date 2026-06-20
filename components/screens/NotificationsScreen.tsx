'use client';
// CENTRE DE NOTIFICATIONS — ported from the prototype (screens-account.jsx
// Notifications). Live: subscribes to notifications INSERTs via Supabase
// Realtime. Order notifications deep-link to tracking and are marked read on tap.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Notification, ProfileSettings } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { isNotificationEnabled, isKindVisibleTo } from '@/lib/notifications';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';

export interface NotificationsScreenProps {
  notifications: Notification[];
  /** User's notification preferences (from Paramètres) — gate the feed. */
  settings?: ProfileSettings | null;
}

function iconFor(kind: string): string {
  if (kind === 'loyalty') return 'gift';
  if (kind === 'promo') return 'percent';
  if (kind === 'order') return 'receipt';
  return 'bell';
}
function tint(kind: string): string {
  return kind === 'promo' || kind === 'loyalty' ? 'var(--gold)' : 'var(--brand)';
}
function bg(kind: string): string {
  return kind === 'promo' || kind === 'loyalty' ? 'rgba(168,151,35,0.12)' : 'rgba(19,124,139,0.1)';
}
function whenLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function NotificationsScreen({ notifications, settings }: NotificationsScreenProps) {
  const router = useRouter();
  // Honour the user's notification preferences from Paramètres: hide muted kinds.
  const [list, setList] = useState<Notification[]>(() =>
    notifications.filter((n) => isNotificationEnabled(n.kind, settings) && isKindVisibleTo(n.kind, 'client')),
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('notifications-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new as Notification;
        if (!isNotificationEnabled(n.kind, settings) || !isKindVisibleTo(n.kind, 'client')) return; // muted / not for client
        setList((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [settings]);

  const open = async (n: Notification) => {
    if (!n.read) {
      setList((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      const supabase = createClient();
      await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    }
    if (n.kind === 'order' && n.order_id) router.push(`/tracking/${n.order_id}`);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: `${SAFE_TOP + 4}px 16px 12px`, background: '#fff', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)' }}>
        <button onClick={() => router.push('/')} style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid var(--line)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="left" size={20} color="var(--ink)" />
        </button>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 19, color: 'var(--ink)', margin: 0, flex: 1 }}>Notifications</h1>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--ui-font)', fontSize: 11.5, fontWeight: 600, color: 'var(--brand)' }}>
          <span className="lv-livedot" style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--brand)' }} /> en direct
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '70px 30px', color: 'var(--muted)', fontFamily: 'var(--ui-font)', fontSize: 14 }}>
            Aucune notification pour le moment.
          </div>
        )}
        {list.map((n) => {
          const tappable = n.kind === 'order' && !!n.order_id;
          return (
            <button
              key={n.id}
              onClick={() => open(n)}
              style={{
                display: 'flex',
                gap: 12,
                textAlign: 'left',
                width: '100%',
                cursor: tappable ? 'pointer' : 'default',
                background: n.read ? '#fff' : 'var(--soft)',
                border: '1px solid var(--line)',
                borderRadius: 16,
                padding: '13px 14px',
                position: 'relative',
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: bg(n.kind), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={iconFor(n.kind)} size={21} color={tint(n.kind)} fill={n.kind === 'loyalty'} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{n.title}</span>
                  <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{whenLabel(n.created_at)}</span>
                </div>
                <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>
              </div>
              {!n.read && <span style={{ position: 'absolute', top: 14, right: 12, width: 8, height: 8, borderRadius: 999, background: 'var(--brand)' }} />}
            </button>
          );
        })}
        <div style={{ height: SAFE_BOTTOM + 8 }} />
      </div>
    </div>
  );
}
