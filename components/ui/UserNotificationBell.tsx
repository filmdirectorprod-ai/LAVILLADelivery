// components/ui/UserNotificationBell.tsx
// Live notification bell for the customer + driver apps. Reads the signed-in user's
// rows from `notifications`, subscribes to realtime INSERTs (RLS-scoped to them),
// shows an unread badge, opens a dropdown list, and plays a short beep on each new
// notification. Audio is unlocked on the first bell tap (autoplay policy). Opening
// the dropdown marks everything read.
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/ui/Icon';
import type { Notification } from '@/lib/types';

function relative(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

export function UserNotificationBell({ color = 'var(--ink)' }: { color?: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
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
      gain.gain.value = 0.001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.26);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    const list = (data ?? []) as Notification[];
    setItems(list);
    setUnread(list.filter((n) => !n.read).length);
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      channel = supabase
        .channel('user-notify')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const n = payload.new as Notification;
            setItems((prev) => [n, ...prev].slice(0, 20));
            if (!openRef.current) setUnread((u) => u + 1);
            beep();
          },
        )
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [load, beep]);

  async function toggle() {
    if (!audioRef.current) {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioRef.current = new Ctx();
      } catch {
        /* no audio */
      }
    }
    audioRef.current?.resume().catch(() => {});
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        style={{ position: 'relative', width: 42, height: 42, borderRadius: 999, background: 'rgba(0,0,0,0.04)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="bell" size={21} color={color} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 6, right: 6, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: '#e0483d', color: '#fff', fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--ui-font)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 320, maxHeight: 420, overflow: 'auto', zIndex: 90, background: '#fff', border: '1px solid var(--line)', borderRadius: 16, boxShadow: '0 20px 50px -20px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Notifications</div>
            {items.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>Aucune notification.</div>
            ) : (
              items.map((n) => (
                <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--soft)', background: n.read ? '#fff' : 'rgba(19,124,139,0.05)' }}>
                  <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{n.title}</div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{relative(n.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
