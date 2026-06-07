// components/admin/support/SupportScreen.tsx
// Live container for the admin Support screen: a two-pane thread view. The left
// pane lists per-driver threads (unread-first, badge), the right shows the selected
// conversation with a reply box. Subscribes to postgres_changes on support_messages
// and refetches via lib/admin-support.ts. Replies insert a 'staff' message; opening
// a thread marks the driver's messages read (support_messages staff RLS, 0018), so
// the driver app sees replies in real time and the unread badge clears.
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { buildSupportThreads } from '@/lib/admin-support';
import type { AdminSupportData } from '@/lib/queries';
import type { SupportMessage } from '@/lib/types';

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function SupportScreen({ initial }: { initial: AdminSupportData }) {
  const [threads, setThreads] = useState<AdminSupportData['threads']>(initial.threads);
  const [selected, setSelected] = useState<string | null>(initial.threads[0]?.driver.id ?? null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const drivers = useRef(initial.threads.map((t) => t.driver));

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const [messagesRes, driversRes] = await Promise.all([
      supabase.from('support_messages').select('*').order('created_at'),
      supabase.from('drivers').select('id, name').order('name'),
    ]);
    drivers.current = (driversRes.data ?? []) as { id: string; name: string }[];
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

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18, height: '100%', boxSizing: 'border-box' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Support livreurs</h1>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
          {threads.length} conversation{threads.length > 1 ? 's' : ''}
          {totalUnread > 0 ? ` · ${totalUnread} non lu${totalUnread > 1 ? 's' : ''}` : ''}
        </p>
      </div>

      {threads.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: '40px 22px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
          Aucun message de support.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)', gap: 18, flex: 1, minHeight: 0 }}>
          {/* Thread list */}
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {threads.map((t) => {
              const isActive = t.driver.id === selected;
              const last = t.messages[t.messages.length - 1];
              return (
                <button
                  key={t.driver.id}
                  type="button"
                  onClick={() => openThread(t.driver.id)}
                  style={{ textAlign: 'left', border: 'none', borderBottom: '1px solid var(--line)', padding: '14px 16px', cursor: 'pointer', background: isActive ? 'var(--soft)' : '#fff', display: 'flex', flexDirection: 'column', gap: 4 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{t.driver.name}</span>
                    {t.unread > 0 && (
                      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--brand)', borderRadius: 999, padding: '1px 7px' }}>{t.unread}</span>
                    )}
                  </div>
                  {last && (
                    <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {last.sender === 'staff' ? 'Vous : ' : ''}{last.body}
                    </span>
                  )}
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
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
                  {active.driver.name}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {active.messages.map((m) => {
                    const staff = m.sender === 'staff';
                    return (
                      <div key={m.id} style={{ alignSelf: staff ? 'flex-end' : 'flex-start', maxWidth: '76%' }}>
                        <div style={{ background: staff ? 'var(--brand)' : 'var(--soft)', color: staff ? '#fff' : 'var(--ink)', borderRadius: 14, padding: '9px 13px', fontFamily: 'var(--ui-font)', fontSize: 13.5, lineHeight: 1.45 }}>
                          {m.body}
                        </div>
                        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)', marginTop: 3, textAlign: staff ? 'right' : 'left' }}>{timeLabel(m.created_at)}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ borderTop: '1px solid var(--line)', padding: '12px 14px', display: 'flex', gap: 10 }}>
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
                    placeholder="Répondre au livreur…"
                    style={{ flex: 1, fontFamily: 'var(--ui-font)', fontSize: 13.5, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)' }}
                  />
                  <button
                    type="button"
                    disabled={busy || reply.trim() === ''}
                    onClick={sendReply}
                    style={{ border: 'none', borderRadius: 10, padding: '9px 18px', cursor: busy || reply.trim() === '' ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: '#fff', background: 'var(--brand)', opacity: busy || reply.trim() === '' ? 0.5 : 1 }}
                  >
                    Envoyer
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
