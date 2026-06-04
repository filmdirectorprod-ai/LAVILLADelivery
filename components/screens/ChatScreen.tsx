'use client';
// MESSAGERIE LIVREUR — order chat. Ported from the prototype
// (screens-order.jsx DriverChat), adapted to real persistence: messages live in
// `chat_messages` (sender 'customer' | 'driver'); we subscribe to INSERTs via
// Supabase Realtime and insert the customer's outgoing messages via the browser
// client (RLS: chat_customer_insert — sender='customer' + order owned by user).
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ChatMessage, Driver, Order } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { PhotoSlot } from '@/components/ui/PhotoSlot';

export interface ChatScreenProps {
  order: Order;
  driver: Driver | null;
  initialMessages: ChatMessage[];
}

const QUICK = ['Oui, code 4582 B', 'Laissez à la porte', "J'arrive en bas", 'Merci !'];

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function ChatScreen({ order, driver, initialMessages }: ChatScreenProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-${order.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `order_id=eq.${order.id}` },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [order.id]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages.length]);

  const send = async (text: string) => {
    const body = text.trim();
    if (!body) return;
    setDraft('');
    const supabase = createClient();
    await supabase.from('chat_messages').insert({ order_id: order.id, sender: 'customer', body });
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
          onClick={() => router.push(`/tracking/${order.id}`)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: 'none',
            background: 'var(--soft)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="left" size={20} color="var(--ink)" />
        </button>
        <PhotoSlot label={driver?.name ?? 'livreur'} src={driver?.avatar_url} style={{ width: 42, height: 42, borderRadius: 999, flexShrink: 0 }} dim />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
            {driver?.name ?? 'Votre livreur'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--brand)' }}>
            <span className="lv-livedot" style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--brand)' }} /> En ligne · votre livreur
          </div>
        </div>
        <button
          onClick={() => router.push(`/call/${order.id}`)}
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            background: 'var(--brand)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="phone" size={19} color="#fff" fill />
        </button>
      </div>

      {/* messages */}
      <div ref={scroller} style={{ flex: 1, overflow: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', margin: '2px 0 6px' }}>
          Aujourd&apos;hui · Commande {order.code}
        </div>
        {messages.map((m) => {
          const me = m.sender === 'customer';
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
                  {timeLabel(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* quick replies */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 16px 10px', scrollbarWidth: 'none' }}>
        {QUICK.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            style={{
              flexShrink: 0,
              padding: '8px 14px',
              borderRadius: 999,
              border: '1.5px solid var(--brand)',
              background: '#fff',
              color: 'var(--brand)',
              fontFamily: 'var(--ui-font)',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* input bar */}
      <div
        style={{
          flexShrink: 0,
          background: '#fff',
          borderTop: '1px solid var(--line)',
          padding: `10px 14px ${SAFE_BOTTOM + 10}px`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--soft)', borderRadius: 999, padding: '11px 16px' }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(draft)}
            placeholder="Écrire un message…"
            style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)' }}
          />
        </div>
        <button
          onClick={() => send(draft)}
          style={{
            width: 46,
            height: 46,
            borderRadius: 999,
            background: 'var(--brand)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 6px 14px -6px var(--brand)',
          }}
        >
          <Icon name="right" size={21} color="#fff" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
