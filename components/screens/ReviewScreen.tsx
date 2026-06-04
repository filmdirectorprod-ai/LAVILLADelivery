'use client';
// LAISSER UN AVIS — order review. Ported from the prototype (screens-account.jsx
// Review). Posts to /api/reviews, which runs the submit_review RPC (validates
// the order is owned + delivered, awards +50 pts server-side). On success shows
// the confirmation state.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Order, OrderItem, Product } from '@/lib/types';
import { REVIEW_TAGS, REVIEW_POINTS } from '@/lib/constants';
import { useToast } from '@/lib/toast-store';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { Btn } from '@/components/ui/Btn';
import { Chip } from '@/components/ui/Chip';
import { PhotoSlot } from '@/components/ui/PhotoSlot';

export interface ReviewScreenProps {
  order: Order;
  items: OrderItem[];
  products: Product[];
}

const LABELS = ['', 'Décevant', 'Moyen', 'Bien', 'Très bien', 'Excellent !'];

export function ReviewScreen({ order, items, products }: ReviewScreenProps) {
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [tags, setTags] = useState<Record<string, boolean>>({});
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const byId = new Map(products.map((p) => [p.id, p]));
  const first = items[0];
  const firstImg = first?.product_id ? byId.get(first.product_id)?.image_url : null;
  const names = items.map((it) => it.name_snapshot).join(', ');

  const submit = async () => {
    if (rating === 0 || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          rating,
          tags: Object.keys(tags).filter((t) => tags[t]),
          comment: text,
        }),
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({ error: 'Erreur' }))) as { error?: string };
        toast(error ?? 'Échec de l’envoi');
        setBusy(false);
        return;
      }
      setSent(true);
      router.refresh();
    } catch {
      toast('Échec de l’envoi');
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(165deg, var(--brand), var(--brand-d))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center' }}>
        <div style={{ width: 92, height: 92, borderRadius: 999, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={46} color="#fff" strokeWidth={2.4} />
        </div>
        <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: 26, color: '#fff', marginTop: 22 }}>Merci pour votre avis !</div>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 14, color: 'rgba(255,255,255,0.82)', margin: '8px 0 0', maxWidth: 260, lineHeight: 1.5 }}>Votre retour aide La Villa à s&apos;améliorer.</p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 999, background: 'rgba(168,151,35,0.25)', border: '1px solid rgba(168,151,35,0.55)', marginTop: 20 }}>
          <Icon name="star" size={16} color="var(--gold)" fill />
          <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: '#F0E4A8' }}>+{REVIEW_POINTS} points ajoutés</span>
        </div>
        <div style={{ marginTop: 30 }}>
          <Btn variant="gold" onClick={() => router.push('/loyalty')}>Retour à la fidélité</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: `${SAFE_TOP + 4}px 16px 12px`, background: '#fff', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line)' }}>
        <button onClick={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid var(--line)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="left" size={20} color="var(--ink)" />
        </button>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 19, color: 'var(--ink)', margin: 0 }}>Laisser un avis</h1>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '18px 18px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--soft)', borderRadius: 16, padding: 12 }}>
          <PhotoSlot label={first?.name_snapshot ?? 'commande'} src={firstImg} style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{order.code}</div>
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names}</div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>Comment était votre commande ?</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <Icon name="star" size={40} color={(hover || rating) >= n ? 'var(--gold)' : 'var(--line)'} fill={(hover || rating) >= n} />
              </button>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 600, color: 'var(--gold)', marginTop: 10, minHeight: 18 }}>{LABELS[rating]}</div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 10 }}>Qu&apos;avez-vous aimé ?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {REVIEW_TAGS.map((t) => (
              <Chip key={t} active={!!tags[t]} onClick={() => setTags((s) => ({ ...s, [t]: !s[t] }))}>
                {t}
              </Chip>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 8 }}>
            Votre commentaire <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}>· optionnel</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Partagez votre expérience avec La Villa…"
            style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--line)', borderRadius: 14, padding: '13px 14px', fontFamily: 'var(--ui-font)', fontSize: 14, outline: 'none', color: 'var(--ink)', resize: 'none', lineHeight: 1.5 }}
          />
        </div>
        <div style={{ height: 8 }} />
      </div>

      <div style={{ flexShrink: 0, background: '#fff', borderTop: '1px solid var(--line)', padding: `12px 18px ${SAFE_BOTTOM + 12}px` }}>
        <Btn full size="lg" disabled={rating === 0 || busy} onClick={submit}>
          {busy ? 'Envoi…' : `Publier mon avis · +${REVIEW_POINTS} pts`}
        </Btn>
      </div>
    </div>
  );
}
