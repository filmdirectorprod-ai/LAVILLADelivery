'use client';
// AIDE / SUPPORT — static FAQ accordion + direct contact actions (call,
// WhatsApp, email) + opening hours and shop address. No backend.
import { useState } from 'react';
import { SAFE_BOTTOM } from '@/lib/layout';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Icon } from '@/components/ui/Icon';
import { LA_VILLA_BRANCHES, branchMapsUrl } from '@/lib/branches';

// Coordonnées La Villa — à ajuster avec les vraies infos de la maison.
const PHONE_DISPLAY = '+212 5 35 00 00 00';
const PHONE_TEL = '+212535000000';
const WHATSAPP = '212600000000';
const EMAIL = 'contact@lavilla.ma';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Comment suivre ma commande ?',
    a: "Dès la confirmation, suivez chaque étape (préparation, en route, livrée) en temps réel depuis l’écran de suivi, accessible aussi via « Mes commandes ».",
  },
  {
    q: 'Quels sont les délais de livraison ?',
    a: "Comptez en général 20 à 40 minutes selon votre zone et l’affluence. Une estimation précise s’affiche au moment du paiement et pendant le suivi.",
  },
  {
    q: 'Quelles zones livrez-vous ?',
    a: 'Nous livrons dans plusieurs quartiers de Fès. Les zones disponibles et leurs frais s’affichent au moment de choisir votre adresse de livraison.',
  },
  {
    q: 'Comment fonctionne le programme de fidélité ?',
    a: 'Vous cumulez 1 point par dirham dépensé. Vos points débloquent des paliers (Gourmand, Connaisseur, Gourmet, Cercle Villa) et peuvent être convertis en réductions à la commande.',
  },
  {
    q: 'Puis-je commander un gâteau personnalisé ?',
    a: 'Oui. Sur les pâtisseries personnalisables, choisissez la taille et le parfum directement sur la fiche produit avant de l’ajouter au panier.',
  },
  {
    q: 'Comment modifier ou annuler une commande ?',
    a: 'Tant que la commande n’est pas en préparation, contactez-nous au plus vite par téléphone ou WhatsApp et nous ferons le nécessaire.',
  },
];

export interface HelpScreenProps {
  /** Optional override for the support email (defaults to the house address). */
  email?: string;
}

export function HelpScreen({ email = EMAIL }: HelpScreenProps) {
  const [open, setOpen] = useState<number | null>(0);

  const contact = (icon: string, label: string, sub: string, href: string, color = 'var(--brand)') => (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel="noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '14px 15px',
        textDecoration: 'none',
        background: '#fff',
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={19} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{label}</div>
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>{sub}</div>
      </div>
      <Icon name="right" size={18} color="var(--muted)" />
    </a>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ScreenHeader title="Aide / Support" />
      <div style={{ flex: 1, overflow: 'auto', padding: `16px 18px ${SAFE_BOTTOM + 24}px` }}>
        {/* Contact */}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
          {contact('phone', 'Appeler La Villa', PHONE_DISPLAY, `tel:${PHONE_TEL}`)}
          <div style={{ height: 1, background: 'var(--line)' }} />
          {contact('message', 'WhatsApp', 'Réponse rapide', `https://wa.me/${WHATSAPP}`, '#25D366')}
          <div style={{ height: 1, background: 'var(--line)' }} />
          {contact('receipt', 'E-mail', email, `mailto:${email}`)}
        </div>

        {/* Hours + address */}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 15px', marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <Icon name="clock" size={18} color="var(--brand)" />
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>Tous les jours · 8h – 22h</span>
          </div>
          {LA_VILLA_BRANCHES.map((b) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginTop: 11 }}>
              <Icon name="pin" size={18} color="var(--brand)" />
              <span style={{ fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)', fontWeight: 500, lineHeight: 1.4 }}>
                <strong>{b.name}</strong><br />
                {b.address}<br />
                <a href={branchMapsUrl(b)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 12.5, fontWeight: 600, color: 'var(--brand)', textDecoration: 'none' }}>
                  Voir sur Maps
                </a>
              </span>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, margin: '20px 4px 8px' }}>
          Questions fréquentes
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 15px', background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ flex: 1, fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{item.q}</span>
                  <Icon name={isOpen ? 'minus' : 'plus'} size={17} color="var(--muted)" />
                </button>
                {isOpen && (
                  <div style={{ padding: '0 15px 14px', fontFamily: 'var(--ui-font)', fontSize: 13.5, lineHeight: 1.5, color: 'var(--muted)' }}>
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
