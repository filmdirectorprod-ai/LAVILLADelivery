'use client';
// Chat de course — la vue du livreur sur la conversation avec le client. Ses
// messages partent en sender='driver' (RLS chat_driver_insert, 0012) et
// s'affichent à droite ; ceux du client à gauche. Abonnement temps réel aux
// INSERT pour que les deux côtés restent vivants.
//
// Style de l'admin : fond turquoise foncé, bulles blanches à texte turquoise
// pour le livreur, bulles de verre pour le client. L'échec d'envoi est
// désormais signalé au lieu de disparaître en silence.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { mergeMessages } from '@/lib/merge-messages';
import { useToast } from '@/lib/toast-store';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import type { ChatMessage, Order } from '@/lib/types';
import type { DriverContact } from '@/lib/queries';
import { Panel, fieldStyle, text } from '@/components/driver/ui/DriverUI';

const QUICK = ["J'arrive dans 5 min 🛵", 'Je suis devant chez vous', "J'ai récupéré votre commande", 'Merci !'];

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function DriverChatScreen({
  order,
  contact,
  initialMessages,
}: {
  order: Order;
  contact: DriverContact | null;
  initialMessages: ChatMessage[];
}) {
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  // Même traitement que l'écran du client : envoi, temps réel, et relecture de
  // sécurité toutes les 5 s. Les doublons sont écartés par identifiant.
  const relire = useCallback(async () => {
    const { data } = await createClient()
      .from('chat_messages')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setMessages((prev) => mergeMessages(prev, (data as ChatMessage[]).slice().reverse()));
  }, [order.id]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`driver-chat-${order.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `order_id=eq.${order.id}` },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => mergeMessages(prev, [msg]));
        },
      )
      .subscribe();

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') relire();
    }, 5000);

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [order.id, relire]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages.length]);

  const send = async (textToSend: string) => {
    const body = textToSend.trim();
    if (!body) return;
    setDraft('');
    const { data, error } = await createClient()
      .from('chat_messages')
      .insert({ order_id: order.id, sender: 'driver', body })
      .select()
      .single();
    if (error) {
      setDraft(body); // on rend le texte au livreur plutôt que de le perdre
      toast('Message non envoyé. Vérifiez votre connexion.', 'alert');
      return;
    }
    if (data) setMessages((prev) => mergeMessages(prev, [data as ChatMessage]));
  };

  const customerName = contact?.full_name || 'Client';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* en-tête */}
      <div style={{ padding: `${SAFE_TOP + 10}px 16px 12px`, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--a-glass-line)' }}>
        <button
          onClick={() => router.push(`/driver/order/${order.id}`)}
          aria-label="Retour"
          style={{ width: 42, height: 42, borderRadius: 999, border: '1px solid var(--a-glass-line)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Icon name="left" size={20} color="var(--a-text)" />
        </button>
        <PhotoSlot label={customerName} style={{ width: 42, height: 42, borderRadius: 999, flexShrink: 0 }} dim />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...text, fontWeight: 600, fontSize: 16, color: 'var(--a-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {customerName}
          </div>
          <div style={{ ...text, fontSize: 12, color: 'var(--a-muted)' }}>Commande {order.code}</div>
        </div>
        {contact?.phone && (
          <a
            href={`tel:${contact.phone}`}
            aria-label="Appeler"
            style={{ width: 42, height: 42, borderRadius: 999, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}
          >
            <Icon name="phone" size={19} color="var(--a-on-white)" fill />
          </a>
        )}
      </div>

      {/* rappel de la course */}
      <button
        onClick={() => router.push(`/driver/order/${order.id}`)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 16px 0', background: 'var(--a-card)', border: '1px solid var(--a-glass-line)', borderRadius: 16, padding: '12px 14px', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="scooter" size={18} color="var(--ink)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...text, fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
            {order.mode === 'livraison' ? 'À livrer' : 'Retrait'} · {order.code}
          </div>
          <div style={{ ...text, fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {order.address ?? 'Voir la course'}
          </div>
        </div>
        <Icon name="right" size={18} color="var(--muted)" />
      </button>

      {/* messages */}
      <div ref={scroller} style={{ flex: 1, overflow: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <Panel style={{ textAlign: 'center', padding: '20px 16px' }}>
            <span style={{ ...text, fontSize: 13.5, color: 'var(--muted)' }}>
              Aucun message. Prévenez le client de votre arrivée.
            </span>
          </Panel>
        )}
        {messages.map((m) => {
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
                  {timeLabel(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
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
          placeholder="Votre message…"
          aria-label={`Message à ${customerName}`}
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
