'use client';
// Support — le fil direct du livreur avec le gérant (support_messages, 0018).
// Ses messages partent en sender='driver' et s'affichent à droite ; les
// réponses du staff arrivent à gauche, en direct. Ouvrir l'écran marque le fil
// comme lu (SUPPORT_SEEN_KEY), ce qui éteint la pastille de l'accueil.
//
// Style de l'admin ; l'échec d'envoi est signalé au lieu d'être silencieux.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { useBeep } from '@/lib/use-beep';
import { SUPPORT_SEEN_KEY } from '@/lib/driver-support';
import type { Driver, SupportMessage } from '@/lib/types';
import { Panel, fieldStyle, text } from '@/components/driver/ui/DriverUI';

const QUICK = ['Bonjour 👋', 'Problème avec une course', 'Je suis en retard', 'Merci !'];

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function markSeen() {
  try {
    localStorage.setItem(SUPPORT_SEEN_KEY, new Date().toISOString());
  } catch {
    /* stockage indisponible */
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
  const toast = useToast((s) => s.show);
  const [messages, setMessages] = useState<SupportMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const { beep } = useBeep();

  // Voir le fil vaut l'avoir lu — on marque à l'ouverture et à chaque message
  // reçu pendant que l'écran est ouvert.
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
          if (msg.sender === 'staff') beep(); // le gérant vient de répondre
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

  const send = async (textToSend: string) => {
    const body = textToSend.trim();
    if (!body) return;
    setDraft('');
    const { error } = await createClient().from('support_messages').insert({ driver_id: driver.id, sender: 'driver', body });
    if (error) {
      setDraft(body);
      toast("Message non envoyé. Vérifiez votre connexion.");
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* en-tête */}
      <div style={{ padding: `${SAFE_TOP + 10}px 16px 12px`, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--a-glass-line)' }}>
        <button
          onClick={() => router.push('/driver')}
          aria-label="Retour"
          style={{ width: 42, height: 42, borderRadius: 999, border: '1px solid var(--a-glass-line)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Icon name="left" size={20} color="var(--a-text)" />
        </button>
        <div style={{ width: 42, height: 42, borderRadius: 999, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="message" size={20} color="var(--a-text)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...text, fontWeight: 600, fontSize: 16, color: 'var(--a-text)' }}>Support La Villa</div>
          <div style={{ ...text, fontSize: 12, color: 'var(--a-muted)' }}>Le gérant vous répond ici</div>
        </div>
      </div>

      {/* messages */}
      <div ref={scroller} style={{ flex: 1, overflow: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 ? (
          <Panel style={{ textAlign: 'center', padding: '22px 16px' }}>
            <span style={{ ...text, fontSize: 13.5, color: 'var(--muted)' }}>
              Aucun message. Écrivez au gérant, il vous répond ici.
            </span>
          </Panel>
        ) : (
          messages.map((m) => {
            const me = m.sender === 'driver';
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '78%' }}>
                  <div
                    style={{
                      ...text,
                      padding: '11px 14px',
                      borderRadius: me ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
                      background: me ? '#ffffff' : 'var(--a-card)',
                      color: me ? 'var(--a-on-white)' : 'var(--ink)',
                      border: me ? 'none' : '1px solid var(--a-glass-line)',
                      fontSize: 14.5,
                      lineHeight: 1.45,
                    }}
                  >
                    {m.body}
                  </div>
                  <div style={{ ...text, fontSize: 11, color: 'var(--a-muted)', marginTop: 3, textAlign: me ? 'right' : 'left' }}>
                    {me ? 'Vous' : 'Gérant'} · {timeLabel(m.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* réponses rapides */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 16px 10px', scrollbarWidth: 'none' }}>
        {QUICK.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            style={{ ...text, flexShrink: 0, padding: '9px 15px', borderRadius: 999, border: '1px solid var(--a-glass-line)', background: 'transparent', color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* saisie */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--a-glass-line)', background: 'rgba(0,0,0,0.35)', padding: `10px 16px ${SAFE_BOTTOM + 10}px`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(draft)}
          placeholder="Votre message au gérant…"
          aria-label="Message au gérant"
          style={{ ...fieldStyle, flex: 1, borderRadius: 999 }}
        />
        <button
          onClick={() => send(draft)}
          aria-label="Envoyer"
          disabled={draft.trim() === ''}
          style={{ width: 48, height: 48, borderRadius: 999, background: '#ffffff', border: 'none', cursor: draft.trim() ? 'pointer' : 'default', opacity: draft.trim() ? 1 : 0.45, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Icon name="right" size={21} color="var(--a-on-white)" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
