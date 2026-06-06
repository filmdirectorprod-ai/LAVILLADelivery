'use client';
// Driver dashboard — the livreur home. Live board with two sections:
//   • Livraison en cours — the order this driver has claimed (rich card)
//   • Disponibles        — the unclaimed pool any driver can accept
// Subscribes to Realtime on `orders` and `order_tracking` and re-pulls the
// RLS-scoped board on any change. The online/offline switch is a device-local
// preference (there's no is_online column yet): when offline we hide the
// available pool so the driver stops seeing new requests.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDH } from '@/lib/format';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import type { Driver, Order, OrderTracking } from '@/lib/types';
import type { DriverOrder } from '@/lib/queries';

const STAGE_LABEL: Record<number, string> = {
  0: 'Confirmée',
  1: 'En préparation',
  2: 'Récupérée',
  3: 'En route',
  4: 'Livrée',
};

const ONLINE_KEY = 'lv-driver-online';

function mapBoard(rows: unknown[]): DriverOrder[] {
  return (rows ?? []).map((r) => {
    const { order_tracking, ...order } = r as Order & {
      order_tracking: OrderTracking | OrderTracking[] | null;
    };
    const tracking = Array.isArray(order_tracking)
      ? order_tracking[0] ?? null
      : order_tracking ?? null;
    return { order: order as Order, tracking };
  });
}

function etaMinutes(eta: string | null): number | null {
  if (!eta) return null;
  const diff = Math.round((Date.parse(eta) - Date.now()) / 60000);
  return Math.max(0, diff);
}

export function DriverDashboard({
  driver,
  initialBoard,
  deliveriesCount,
  totalEarnings,
}: {
  driver: Driver;
  initialBoard: DriverOrder[];
  deliveriesCount: number;
  totalEarnings: number;
}) {
  const router = useRouter();
  const [board, setBoard] = useState<DriverOrder[]>(initialBoard);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(ONLINE_KEY);
    if (stored !== null) setOnline(stored === '1');
  }, []);

  const toggleOnline = () => {
    setOnline((v) => {
      const next = !v;
      try {
        localStorage.setItem(ONLINE_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('orders')
      .select('*, order_tracking(*)')
      .in('status', ['preparing', 'en_route'])
      .order('placed_at', { ascending: false });
    setBoard(mapBoard(data ?? []));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('driver-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tracking' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const mine = board.filter((b) => b.tracking?.driver_id === driver.id && b.tracking?.manual);
  const available = board.filter((b) => !b.tracking?.manual);
  const activeDelivery = mine[0] ?? null;

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: `${SAFE_TOP + 6}px 16px 18px`, background: 'var(--brand-d)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PhotoSlot label={driver.name} src={driver.avatar_url ?? undefined} style={{ width: 52, height: 52, borderRadius: 16 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {driver.name}
            </div>
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>
              Livreur · {driver.vehicle ?? 'Scooter'}
            </div>
          </div>
          <button
            onClick={logout}
            aria-label="Déconnexion"
            style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.14)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <Icon name="logout" size={19} color="#fff" />
          </button>
        </div>

        {/* Online toggle */}
        <button
          onClick={toggleOnline}
          style={{ width: '100%', marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 14, padding: '12px 14px', cursor: 'pointer' }}
        >
          <span className={online ? 'lv-livedot' : undefined} style={{ width: 9, height: 9, borderRadius: 999, background: online ? '#69e0a0' : 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
          <span style={{ flex: 1, textAlign: 'left', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: '#fff' }}>
            {online ? 'En ligne · vous recevez des courses' : 'Hors ligne'}
          </span>
          <span style={{ width: 46, height: 28, borderRadius: 999, background: online ? 'var(--brand)' : 'rgba(255,255,255,0.25)', position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 3, left: online ? 21 : 3, width: 22, height: 22, borderRadius: 999, background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </span>
        </button>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Stat label="Courses" value={deliveriesCount} />
          <Stat label="Gains" value={formatDH(totalEarnings)} />
          <Stat label="Note" value={driver.rating.toFixed(1)} />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `16px 16px ${SAFE_BOTTOM + 16}px` }}>
        <Section title="Livraison en cours" count={mine.length} />
        {activeDelivery ? (
          <ActiveCard data={activeDelivery} onOpen={() => router.push(`/driver/order/${activeDelivery.order.id}`)} />
        ) : (
          <Empty text="Aucune livraison en cours." />
        )}

        <div style={{ height: 22 }} />
        <Section title="Disponibles" count={online ? available.length : 0} />
        {!online ? (
          <Empty text="Vous êtes hors ligne. Activez « En ligne » pour recevoir des courses." />
        ) : (
          <button
            onClick={() => router.push('/driver/requests')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: 14, cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="bell" size={20} color="var(--brand)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>
                {available.length === 0 ? 'Aucune demande' : `${available.length} demande${available.length > 1 ? 's' : ''} disponible${available.length > 1 ? 's' : ''}`}
              </div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>
                {available.length === 0 ? 'Vous recevrez les nouvelles courses ici.' : 'Voir et accepter les courses'}
              </div>
            </div>
            <Icon name="right" size={18} color="var(--muted)" />
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: '10px 12px' }}>
      <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: '#fff' }}>{value}</div>
      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'rgba(255,255,255,0.7)' }}>{label}</div>
    </div>
  );
}

function Section({ title, count }: { title: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15.5, color: 'var(--ink)', margin: 0 }}>{title}</h2>
      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>{count}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', background: '#fff', border: '1px dashed var(--line)', borderRadius: 14, padding: '18px 16px', textAlign: 'center' }}>
      {text}
    </div>
  );
}

// Rich "current delivery" card — stage badge, address, total, ETA, and a clear
// call-to-action to open the full course (where the state machine + GPS live).
function ActiveCard({ data, onOpen }: { data: DriverOrder; onOpen: () => void }) {
  const { order, tracking } = data;
  const eta = etaMinutes(tracking?.eta_at ?? order.eta_at);
  const isDelivery = order.mode === 'livraison';
  const stage = tracking?.stage ?? 0;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{order.code}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--soft)', borderRadius: 999, padding: '5px 11px' }}>
          <span className="lv-livedot" style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--brand)' }} />
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: 'var(--brand)' }}>{STAGE_LABEL[stage] ?? '—'}</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={isDelivery ? 'scooter' : 'store'} size={20} color="var(--brand)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isDelivery ? order.address ?? 'Adresse de livraison' : 'Retrait en boutique'}
          </div>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>
            {formatDH(order.total_dh)}
            {eta !== null ? ` · ~${eta} min` : ''}
          </div>
        </div>
      </div>

      <button
        onClick={onOpen}
        style={{ width: '100%', marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--brand)', border: 'none', borderRadius: 12, padding: '12px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14.5, color: '#fff' }}
      >
        Voir la course
        <Icon name="right" size={18} color="#fff" />
      </button>
    </div>
  );
}

