'use client';
// Driver "Support" — the livreur's direct thread with the gérant. Mirror of the
// order chat (DriverChatScreen) but against support_messages (0018): the driver's
// own messages go in as sender='driver' (support_driver_insert RLS) and render on
// the right; staff replies render on the left and arrive live via a Realtime
// INSERT subscription. Opening the screen stamps SUPPORT_SEEN_KEY so the home
// badge clears.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { useBeep } from '@/lib/use-beep';
import { SUPPORT_SEEN_KEY } from '@/lib/driver-support';
import type { Driver, SupportMessage } from '@/lib/types';

const QUICK = ['Bonjour 👋', 'Problème avec une course', "Je suis en retard", 'Merci !'];

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function markSeen() {
  try {
    localStorage.setItem(SUPPORT_SEEN_KEY, new Date().toISOString());
  } catch {
    /* storage unavailable */
  }
}

export function DriverSupportScreen({
  driver,
  initialMessages,
}: {
  driver: Driver;
  initialMessages: SupportMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<SupportMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const { beep } = useBeep();

  // Viewing the thread counts as reading it — stamp on open and whenever a new
  // message lands while the screen is open.
  useEffect(() => {
    markSeen();
  }, [messages.length]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`driver-support-${driver.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `driver_id=eq.${driver.id}` },
        (payload) => {
          const msg = payload.new as SupportMessage;
          if (msg.sender === 'staff') beep(); // the gérant just replied
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [driver.id, beep]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages.length]);

  const send = async (text: string) => {
    const body = text.trim();
    if (!body) return;
    setDraft('');
    const supabase = createClient();
    await supabase.from('support_messages').insert({ driver_id: driver.id, sender: 'driver', body });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--soft)' }}>
      {/* header */}
      <div
        style={{
          padding: `${SAFE_TOP + 4}px 14px 12px`,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <button
          onClick={() => router.push('/driver')}
          aria-label="Retour"
          style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: 'var(--soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Icon name="left" size={20} color="var(--ink)" />
        </button>
        <div style={{ width: 42, height: 42, borderRadius: 999, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="message" size={20} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
            Support La Villa
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--brand)' }}>
            <span className="lv-livedot" style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--brand)' }} /> Le gérant vous répond ici
          </div>
        </div>
      </div>

      {/* messages */}
      <div ref={scroller} style={{ flex: 1, overflow: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', margin: '2px 0 6px' }}>
          Une question ? Écrivez au gérant.
        </div>
        {messages.length === 0 ? (
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', background: '#fff', border: '1px dashed var(--line)', borderRadius: 16, padding: '18px 16px', textAlign: 'center', marginTop: 4 }}>
            Aucun message pour l&apos;instant. Envoyez votre premier message ci-dessous.
          </div>
        ) : (
          messages.map((m) => {
            const me = m.sender === 'driver';
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '76%' }}>
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: me ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: me ? 'var(--brand)' : '#fff',
                      color: me ? '#fff' : 'var(--ink)',
                      fontFamily: 'var(--ui-font)',
                      fontSize: 14,
                      lineHeight: 1.45,
                      border: me ? 'none' : '1px solid var(--line)',
                      boxShadow: '0 2px 8px -4px rgba(0,0,0,0.12)',
                    }}
                  >
                    {m.body}
                  </div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 10.5, color: 'var(--muted)', marginTop: 3, textAlign: me ? 'right' : 'left' }}>
                    {me ? 'Vous' : 'Gérant'} · {timeLabel(m.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* quick replies */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 16px 10px', scrollbarWidth: 'none' }}>
        {QUICK.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 999, border: '1.5px solid var(--brand)', background: '#fff', color: 'var(--brand)', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* input bar */}
      <div style={{ flexShrink: 0, background: '#fff', borderTop: '1px solid var(--line)', padding: `10px 14px ${SAFE_BOTTOM + 10}px`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--soft)', borderRadius: 999, padding: '11px 16px' }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(draft)}
            placeholder="Votre message au gérant…"
            style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)' }}
          />
        </div>
        <button
          onClick={() => send(draft)}
          aria-label="Envoyer"
          style={{ width: 46, height: 46, borderRadius: 999, background: 'var(--brand)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 14px -6px var(--brand)' }}
        >
          <Icon name="right" size={21} color="#fff" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
