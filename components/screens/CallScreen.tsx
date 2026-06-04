'use client';
// APPEL LIVREUR — driver voice-call mock. Ported from the prototype
// (screens-order.jsx DriverCall). Deferred as a visual mock per scope: no real
// telephony. The call timer ticks locally; controls toggle visual state only.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Driver, Order } from '@/lib/types';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { PhotoSlot } from '@/components/ui/PhotoSlot';

export interface CallScreenProps {
  order: Order;
  driver: Driver | null;
}

export function CallScreen({ order, driver }: CallScreenProps) {
  const router = useRouter();
  const [sec, setSec] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');

  const ctrl = (icon: string, label: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer' }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: active ? '#fff' : 'rgba(255,255,255,0.16)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <Icon name={icon} size={26} color={active ? 'var(--brand)' : '#fff'} fill={icon === 'phone'} />
      </div>
      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
    </button>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(165deg, var(--brand), var(--brand-d))', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'absolute', top: -40, right: -30, width: 180, height: 180, borderRadius: 999, background: 'rgba(168,151,35,0.14)' }} />
      <div style={{ marginTop: SAFE_TOP + 46, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <div className="lv-pulse" style={{ position: 'absolute', inset: 0, margin: 'auto', width: 110, height: 110, borderRadius: 999, background: 'rgba(255,255,255,0.4)' }} />
          <div style={{ position: 'relative', width: 124, height: 124, borderRadius: 999, border: '3px solid rgba(255,255,255,0.6)', padding: 4 }}>
            <PhotoSlot label={driver?.name ?? 'livreur'} src={driver?.avatar_url} style={{ width: '100%', height: '100%', borderRadius: 999 }} dim />
          </div>
        </div>
        <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 25, color: '#fff', marginTop: 22 }}>
          {driver?.name ?? 'Votre livreur'}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'rgba(255,255,255,0.8)', marginTop: 5 }}>
          <Icon name="scooter" size={16} color="rgba(255,255,255,0.8)" /> Votre livreur · La Villa
        </div>
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 16, color: '#F0E4A8', marginTop: 16, letterSpacing: 1 }}>
          {mm}:{ss}
        </div>
      </div>

      <div style={{ marginTop: 'auto', width: '100%', padding: `0 30px ${SAFE_BOTTOM + 30}px`, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 32 }}>
          {ctrl('message', 'Message', false, () => router.push(`/chat/${order.id}`))}
          {ctrl(muted ? 'x' : 'phone', muted ? 'Muet' : 'Micro', muted, () => setMuted(!muted))}
          {ctrl('bell', 'Haut-parleur', speaker, () => setSpeaker(!speaker))}
        </div>
        <button
          onClick={() => router.push(`/tracking/${order.id}`)}
          style={{
            width: 70,
            height: 70,
            borderRadius: 999,
            background: '#E0524B',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            boxShadow: '0 10px 26px -8px rgba(224,82,75,0.7)',
          }}
        >
          <Icon name="phone" size={28} color="#fff" fill style={{ transform: 'rotate(135deg)' }} />
        </button>
      </div>
    </div>
  );
}
