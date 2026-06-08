// components/admin/support/SupportScreen.tsx
// Live container for the admin Support screen: a two-pane thread view. The left
// pane lists EVERY driver (avatar + presence dot + last-message preview, unread
// drivers first), the right shows the selected conversation (avatar + matricule
// header, name/time-stamped bubbles) with a reply box. Subscribes to
// postgres_changes on support_messages and refetches via lib/admin-support.ts.
// Replies insert a 'staff' message; opening a thread marks the driver's messages
// read (support_messages staff RLS, 0018), so the driver app sees replies in real
// time and the unread badge clears.
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { buildSupportThreads, driverInitials, threadPreview, type SupportDriver } from '@/lib/admin-support';
import type { AdminSupportData } from '@/lib/queries';
import type { RawSupportDriver } from '@/lib/admin-support';
import type { SupportMessage } from '@/lib/types';
import { Icon } from '@/components/ui/Icon';

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function todayLabel(): string {
  const s = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function Avatar({ driver, size }: { driver: SupportDriver; size: number }) {
  const dot = size >= 44 ? 13 : 11;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          overflow: 'hidden',
          background: 'var(--soft)',
          border: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--ui-font)',
          fontWeight: 700,
          fontSize: size * 0.36,
          color: 'var(--brand)',
        }}
      >
        {driver.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={driver.avatarUrl} alt={driver.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          driverInitials(driver.name)
        )}
      </div>
      <span
        title={driver.isOnline ? 'En ligne' : 'Hors ligne'}
        style={{
          position: 'absolute',
          right: -1,
          bottom: -1,
          width: dot,
          height: dot,
          borderRadius: 999,
          background: driver.isOnline ? '#23b26d' : '#e0564a',
          border: '2px solid #fff',
        }}
      />
    </div>
  );
}

export function SupportScreen({ initial }: { initial: AdminSupportData }) {
  const [threads, setThreads] = useState<AdminSupportData['threads']>(initial.threads);
  const [selected, setSelected] = useState<string | null>(initial.threads[0]?.driver.id ?? null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const drivers = useRef<RawSupportDriver[]>(initial.threads.map((t) => ({ id: t.driver.id, name: t.driver.name })));

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const [messagesRes, driversRes] = await Promise.all([
      supabase.from('support_messages').select('*').order('created_at'),
      supabase.from('drivers').select('id, name, avatar_url, is_online').order('name'),
    ]);
    drivers.current = (driversRes.data ?? []) as RawSupportDriver[];
    setThreads(buildSupportThreads((messagesRes.data ?? []) as SupportMessage[], drivers.current));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-support')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const markRead = useCallback(async (driverId: string) => {
    const supabase = createClient();
    await supabase
      .from('support_messages')
      .update({ read_by_staff: true })
      .eq('driver_id', driverId)
      .eq('sender', 'driver')
      .eq('read_by_staff', false);
  }, []);

  const openThread = useCallback(
    (driverId: string) => {
      setSelected(driverId);
      markRead(driverId).then(refetch);
    },
    [markRead, refetch],
  );

  const sendReply = useCallback(async () => {
    if (selected === null || reply.trim() === '') return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from('support_messages').insert({
      driver_id: selected,
      sender: 'staff',
      body: reply.trim(),
      read_by_staff: true,
    });
    setReply('');
    setBusy(false);
    refetch();
  }, [selected, reply, refetch]);

  const totalUnread = useMemo(() => threads.reduce((sum, t) => sum + t.unread, 0), [threads]);
  const active = useMemo(() => threads.find((t) => t.driver.id === selected) ?? null, [threads, selected]);
  const canSend = !busy && reply.trim() !== '';

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18, height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Support livreurs</h1>
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
            {todayLabel()} · Fès
            {totalUnread > 0 ? ` · ${totalUnread} non lu${totalUnread > 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 999, padding: '7px 14px', fontFamily: 'var(--ui-font)', fontSize: 13, fontWeight: 600, color: 'var(--brand)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: '#23b26d' }} />
          Temps réel
        </span>
      </div>

      {threads.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: '40px 22px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
          Aucun livreur.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) minmax(0, 1fr)', gap: 18, flex: 1, minHeight: 0 }}>
          {/* Thread list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', paddingRight: 2 }}>
            {threads.map((t) => {
              const isActive = t.driver.id === selected;
              return (
                <button
                  key={t.driver.id}
                  type="button"
                  onClick={() => openThread(t.driver.id)}
                  style={{
                    textAlign: 'left',
                    background: '#fff',
                    border: `1.5px solid ${isActive ? 'var(--brand)' : 'var(--line)'}`,
                    borderRadius: 16,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: isActive ? '0 6px 18px -14px rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  <Avatar driver={t.driver} size={44} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.driver.name}</span>
                      {t.unread > 0 && (
                        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--brand)', borderRadius: 999, padding: '1px 7px', flexShrink: 0 }}>{t.unread}</span>
                      )}
                    </span>
                    <span style={{ display: 'block', fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                      {threadPreview(t)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Conversation */}
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {active === null ? (
              <div style={{ margin: 'auto', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>Sélectionnez une conversation.</div>
            ) : (
              <>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar driver={active.driver} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{active.driver.name}</div>
                    <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                      Matricule {active.driver.matricule} · {active.driver.isOnline ? 'En ligne' : 'Hors ligne'}
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {active.messages.length === 0 ? (
                    <div style={{ margin: 'auto', fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>
                      Aucun message pour le moment. Démarrez la conversation.
                    </div>
                  ) : (
                    active.messages.map((m) => {
                      const staff = m.sender === 'staff';
                      return (
                        <div key={m.id} style={{ alignSelf: staff ? 'flex-end' : 'flex-start', maxWidth: '76%' }}>
                          <div style={{ background: staff ? 'var(--brand)' : 'var(--soft)', color: staff ? '#fff' : 'var(--ink)', borderRadius: 16, padding: '10px 14px', fontFamily: 'var(--ui-font)', fontSize: 13.5, lineHeight: 1.45 }}>
                            {m.body}
                          </div>
                          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)', marginTop: 4, textAlign: staff ? 'right' : 'left' }}>
                            {staff ? 'Gérant' : firstName(active.driver.name)} · {timeLabel(m.created_at)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--line)', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    value={reply}
                    disabled={busy}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    placeholder={`Message à ${firstName(active.driver.name)}…`}
                    style={{ flex: 1, fontFamily: 'var(--ui-font)', fontSize: 13.5, padding: '11px 16px', border: '1px solid var(--line)', borderRadius: 999, color: 'var(--ink)', outline: 'none' }}
                  />
                  <button
                    type="button"
                    aria-label="Envoyer"
                    disabled={!canSend}
                    onClick={sendReply}
                    style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 999, border: 'none', cursor: canSend ? 'pointer' : 'default', background: 'var(--brand)', opacity: canSend ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="right" size={20} color="#fff" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
