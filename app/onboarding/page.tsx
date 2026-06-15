'use client';
// Onboarding — 3 slides. Ported verbatim from the prototype (screens-home.jsx).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { Btn } from '@/components/ui/Btn';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';

const SLIDES = [
  {
    photo: 'Vitrine pâtisserie La Villa',
    title: 'Le goût de La Villa,\nlivré chez vous',
    sub: 'Pâtisserie & restaurant, une maison de qualité à Fès depuis 2007.',
  },
  {
    photo: 'Livreur La Villa dans Fès',
    title: 'Livraison rapide\ndans tout Fès',
    sub: 'Vos gâteaux et plats préférés, à votre porte en moins de 30 minutes.',
  },
  {
    photo: 'Suivi de commande sur carte',
    title: 'Suivez votre commande\nen temps réel',
    sub: 'De la préparation à votre porte — vous savez exactement où en est votre commande.',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <PhotoSlot label={s.photo} style={{ position: 'absolute', inset: 0 }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to top, rgba(8,28,31,0.92) 18%, rgba(8,28,31,0.35) 52%, rgba(8,28,31,0.15) 100%)',
        }}
      />
      {/* Logo (pastille claire pour rester lisible sur la photo sombre) */}
      <div
        style={{
          position: 'absolute',
          top: SAFE_TOP + 6,
          left: 18,
          zIndex: 3,
          background: '#fff',
          borderRadius: 14,
          padding: '8px 12px',
          boxShadow: '0 8px 20px -12px rgba(0,0,0,0.5)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo.png"
          alt="La Villa — Maison de Qualité, depuis 2007"
          style={{ width: 116, height: 'auto', display: 'block' }}
        />
      </div>

      <button
        onClick={() => router.push('/auth')}
        style={{
          position: 'absolute',
          top: SAFE_TOP + 6,
          right: 18,
          zIndex: 3,
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(8px)',
          border: 'none',
          color: '#fff',
          fontFamily: 'var(--ui-font)',
          fontSize: 13,
          fontWeight: 500,
          padding: '8px 14px',
          borderRadius: 999,
          cursor: 'pointer',
        }}
      >
        Passer
      </button>

      <div
        style={{
          position: 'relative',
          marginTop: 'auto',
          padding: `0 26px ${SAFE_BOTTOM + 26}px`,
          zIndex: 2,
        }}
      >
        <div
          className="font-display"
          style={{
            fontSize: 33,
            fontWeight: 700,
            lineHeight: 1.12,
            color: '#fff',
            whiteSpace: 'pre-line',
            letterSpacing: 0.2,
          }}
        >
          {s.title}
        </div>
        <p
          style={{
            margin: '14px 0 0',
            fontFamily: 'var(--ui-font)',
            fontSize: 15,
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          {s.sub}
        </p>

        <div style={{ display: 'flex', gap: 7, margin: '22px 0 20px' }}>
          {SLIDES.map((_, k) => (
            <div
              key={k}
              style={{
                height: 7,
                borderRadius: 999,
                transition: 'all .25s ease',
                width: k === i ? 26 : 7,
                background: k === i ? 'var(--brand)' : 'rgba(255,255,255,0.45)',
              }}
            />
          ))}
        </div>
        <Btn full size="lg" onClick={() => (last ? router.push('/auth') : setI(i + 1))}>
          {last ? 'Commencer' : 'Suivant'}
        </Btn>
      </div>
    </div>
  );
}
