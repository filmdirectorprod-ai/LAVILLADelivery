// components/admin/support/SupportScreen.tsx
// Live container for the admin Support screen, in the language of the Vue
// d'ensemble: headline figures (unread, awaiting a reply, drivers online,
// conversations), then a two-pane view. The left pane lists EVERY driver (avatar +
// presence dot + last-message preview, unread first) with a search and an "À
// répondre" chip; the right shows the selected conversation with quick replies and
// a reply box. Subscribes to postgres_changes on support_messages and refetches via
// lib/admin-support.ts. Replies insert a 'staff' message; opening a thread marks
// the driver's messages read (support_messages staff RLS, 0018), so the driver app
// sees replies in real time and the unread badge clears.
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { QUICK_REPLIES, buildSupportThreads, driverInitials, filterThreads, supportTotals, threadPreview, type SupportDriver } from '@/lib/admin-support';
import type { AdminSupportData } from '@/lib/queries';
import type { RawSupportDriver } from '@/lib/admin-support';
import type { SupportMessage } from '@/lib/types';
import { useBeep } from '@/lib/use-beep';
import { Icon } from '@/components/ui/Icon';
import { useRealtime, type RealtimeChangePayload } from '@/lib/use-realtime';
import { HeroStat } from '@/components/admin/overview/HeroStat';
import { Chip, EmptyState, GlassPanel, LiveBadge, PageHeader, SearchField, fieldStyle } from '@/components/admin/ui/Glass';

const text = { fontFamily: 'var(--ui-font)' } as const;

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' });
}

function todayLabel(): string {
  const s = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Casablanca' });
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
          position: 'relative', // <Image fill> anchors to this box
          width: size,
          height: size,
          borderRadius: 999,
          overflow: 'hidden',
          background: 'var(--soft)',
          border: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...text,
          fontWeight: 600,
          fontSize: size * 0.36,
          color: 'var(--ink)',
        }}
      >
        {driver.avatarUrl ? <Image src={driver.avatarUrl} alt={driver.name} fill sizes="44px" style={{ objectFit: 'cover' }} /> : driverInitials(driver.name)}
      </div>
      <span
        title={driver.isOnline ? 'En ligne' : 'Hors ligne'}
        style={{ position: 'absolute', right: -1, bottom: -1, width: dot, height: dot, borderRadius: 999, background: driver.isOnline ? '#ffffff' : 'rgba(0, 0, 0, 0.6)', border: `2px solid ${driver.isOnline ? 'var(--a-ground)' : 'rgba(255, 255, 255, 0.45)'}` }}
      />
    </div>
  );
}

export function SupportScreen({ initial }: { initial: AdminSupportData }) {
  const toast = useToast((t) => t.show);
  const [threads, setThreads] = useState<AdminSupportData['threads']>(initial.threads);
  const [selected, setSelected] = useState<string | null>(initial.threads[0]?.driver.id ?? null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyAwaiting, setOnlyAwaiting] = useState(false);
  const { beep } = useBeep();
  const drivers = useRef<RawSupportDriver[]>(initial.threads.map((t) => ({ id: t.driver.id, name: t.driver.name })));
  const scroller = useRef<HTMLDivElement | null>(null);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const [messagesRes, driversRes] = await Promise.all([
      supabase.from('support_messages').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('drivers').select('id, name, avatar_url, is_online').order('name'),
    ]);
    drivers.current = (driversRes.data ?? []) as RawSupportDriver[];
    setThreads(buildSupportThreads((messagesRes.data ?? []) as SupportMessage[], drivers.current));
  }, []);

  // Immediate (no debounce): the beep must fire on the message that triggered it.
  // `drivers` keeps the online/offline dots live.
  useRealtime(
    'admin-support',
    [{ table: 'support_messages' }, { table: 'drivers' }],
    useCallback(
      (payload: RealtimeChangePayload) => {
        if (payload.table === 'support_messages' && payload.eventType === 'INSERT' && (payload.new as unknown as SupportMessage)?.sender === 'driver') {
          beep();
        }
        refetch();
      },
      [beep, refetch],
    ),
    { debounceMs: 0 },
  );

  const markRead = useCallback(async (driverId: string) => {
    await createClient().from('support_messages').update({ read_by_staff: true }).eq('driver_id', driverId).eq('sender', 'driver').eq('read_by_staff', false);
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
    // L'erreur était ignorée : la réponse du gérant disparaissait en silence et
    // le livreur attendait une aide qui n'arriverait jamais.
    const body = reply.trim();
    const { error } = await createClient()
      .from('support_messages')
      .insert({ driver_id: selected, sender: 'staff', body, read_by_staff: true });
    setBusy(false);
    if (error) {
      setReply(body); // on rend le texte plutôt que de le perdre
      toast('Réponse non envoyée. Vérifiez votre connexion.', 'alert');
      return;
    }
    setReply('');
    refetch();
  }, [selected, reply, refetch, toast]);

  const totals = useMemo(() => supportTotals(threads), [threads]);
  const list = useMemo(() => filterThreads(threads, query, onlyAwaiting), [threads, query, onlyAwaiting]);
  const active = useMemo(() => threads.find((t) => t.driver.id === selected) ?? null, [threads, selected]);
  const canSend = !busy && reply.trim() !== '';

  // Keep the newest message in view.
  const lastId = active?.messages[active.messages.length - 1]?.id;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selected, lastId]);

  return (
    <div style={{ padding: '30px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader title="Support livreurs" subtitle={todayLabel()} actions={<LiveBadge />} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 56px' }}>
        <HeroStat label="Messages non lus" value={String(totals.unread)} />
        <HeroStat label="À répondre" value={String(totals.awaiting)} />
        <HeroStat label="Livreurs en ligne" value={String(totals.online)} />
        <HeroStat label="Livreurs" value={String(totals.drivers)} />
      </div>

      {threads.length === 0 ? (
        <GlassPanel>
          <EmptyState title="Aucun livreur." />
        </GlassPanel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 320px) minmax(0, 1fr)', gap: 22, alignItems: 'stretch' }}>
          <GlassPanel padding={0} style={{ display: 'flex', flexDirection: 'column', height: '66vh', minHeight: 460, overflow: 'hidden' }}>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid var(--line)' }}>
              <SearchField value={query} onChange={setQuery} label="Rechercher un livreur" style={{ flex: 'none', width: '100%' }} />
              <div>
                <Chip on={onlyAwaiting} onClick={() => setOnlyAwaiting((v) => !v)} count={totals.awaiting}>
                  À répondre
                </Chip>
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {list.length === 0 ? (
                <EmptyState title="Aucune conversation." />
              ) : (
                list.map((t) => {
                  const isActive = t.driver.id === selected;
                  return (
                    <button
                      key={t.driver.id}
                      type="button"
                      onClick={() => openThread(t.driver.id)}
                      aria-current={isActive ? 'true' : undefined}
                      style={{ textAlign: 'left', width: '100%', border: 'none', borderBottom: '1px solid var(--line)', borderLeft: `3px solid ${isActive ? '#ffffff' : 'transparent'}`, background: isActive ? 'var(--soft)' : 'transparent', padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      <Avatar driver={t.driver} size={44} />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ ...text, fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.driver.name}</span>
                          {t.unread > 0 && <span style={{ ...text, fontSize: 11, fontWeight: 600, color: 'var(--a-on-white)', background: '#ffffff', borderRadius: 999, padding: '1px 7px', flexShrink: 0 }}>{t.unread}</span>}
                        </span>
                        <span style={{ ...text, display: 'block', fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{threadPreview(t)}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </GlassPanel>

          <GlassPanel padding={0} style={{ display: 'flex', flexDirection: 'column', height: '66vh', minHeight: 460, overflow: 'hidden' }}>
            {active === null ? (
              <div style={{ margin: 'auto' }}>
                <EmptyState title="Sélectionnez une conversation." />
              </div>
            ) : (
              <>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar driver={active.driver} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ ...text, margin: 0, fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>{active.driver.name}</h2>
                    <div style={{ ...text, fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                      Matricule {active.driver.matricule} · {active.driver.isOnline ? 'En ligne' : 'Hors ligne'}
                    </div>
                  </div>
                </div>

                <div ref={scroller} style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {active.messages.length === 0 ? (
                    <div style={{ margin: 'auto' }}>
                      <EmptyState title="Aucun message pour le moment." hint="Démarrez la conversation." />
                    </div>
                  ) : (
                    active.messages.map((m) => {
                      const staff = m.sender === 'staff';
                      return (
                        <div key={m.id} style={{ alignSelf: staff ? 'flex-end' : 'flex-start', maxWidth: '76%' }}>
                          <div style={{ ...text, background: staff ? '#ffffff' : 'var(--soft)', color: staff ? 'var(--a-on-white)' : 'var(--ink)', border: staff ? 'none' : '1px solid var(--line)', borderRadius: 18, borderBottomRightRadius: staff ? 6 : 18, borderBottomLeftRadius: staff ? 18 : 6, padding: '10px 14px', fontSize: 14, lineHeight: 1.45 }}>
                            {m.body}
                          </div>
                          <div style={{ ...text, fontSize: 11, color: 'var(--muted)', marginTop: 4, textAlign: staff ? 'right' : 'left' }}>
                            {staff ? 'Gérant' : firstName(active.driver.name)} · {timeLabel(m.created_at)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--line)', padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div role="group" aria-label="Réponses rapides" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {QUICK_REPLIES.map((q) => (
                      <Chip key={q} on={reply === q} onClick={() => setReply(q)}>
                        {q}
                      </Chip>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      value={reply}
                      disabled={busy}
                      aria-label={`Message à ${firstName(active.driver.name)}`}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                      placeholder={`Message à ${firstName(active.driver.name)}…`}
                      style={{ ...fieldStyle, flex: 1, width: 'auto', borderRadius: 999, padding: '11px 16px' }}
                    />
                    <button
                      type="button"
                      aria-label="Envoyer"
                      disabled={!canSend}
                      onClick={sendReply}
                      style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 999, border: 'none', cursor: canSend ? 'pointer' : 'default', background: '#ffffff', opacity: canSend ? 1 : 0.45, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icon name="right" size={20} color="var(--a-on-white)" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </GlassPanel>
        </div>
      )}
    </div>
  );
}
