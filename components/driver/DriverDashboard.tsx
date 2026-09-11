'use client';
// Accueil livreur — dans la langue de l'admin : fond turquoise foncé, panneaux
// de verre, grands chiffres fins. Deux sections vivantes :
//   • Livraison en cours — la course que ce livreur a prise
//   • Disponibles        — le vivier de courses à accepter
// S'abonne au temps réel sur `orders` et `order_tracking`. L'interrupteur
// En ligne pilote la présence réelle (DriverPresence la transmet à l'admin).
//
// Corrections : la note ne plante plus quand elle est vide, le point vert est
// devenu blanc (palette stricte), et la carte de course annonce le créneau
// demandé et les espèces à encaisser (0054).
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDH } from '@/lib/format';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { DRIVER_POOL_STATUSES } from '@/lib/order-status';
import { slotShortLabel } from '@/lib/checkout-slots';
import { Icon } from '@/components/ui/Icon';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { UserNotificationBell } from '@/components/ui/UserNotificationBell';
import { unreadFromStaff, SUPPORT_SEEN_KEY } from '@/lib/driver-support';
import { useDriverOnline } from '@/lib/driver-online-store';
import { useRealtime } from '@/lib/use-realtime';
import type { Driver, Order, OrderTracking, SupportMessage } from '@/lib/types';
import type { DriverOrder } from '@/lib/queries';
import { EmptyLine, Figure, GhostAction, Panel, Pill, PrimaryAction, SectionTitle, Switch, Well, text } from '@/components/driver/ui/DriverUI';

const STAGE_LABEL: Record<number, string> = {
  0: 'Confirmée',
  1: 'En préparation',
  2: 'Récupérée',
  3: 'En route',
  4: 'Livrée',
};

function mapBoard(rows: unknown[]): DriverOrder[] {
  return (rows ?? []).map((r) => {
    const { order_tracking, ...order } = r as Order & {
      order_tracking: OrderTracking | OrderTracking[] | null;
    };
    const tracking = Array.isArray(order_tracking) ? order_tracking[0] ?? null : order_tracking ?? null;
    return { order: order as Order, tracking };
  });
}

function etaMinutes(eta: string | null): number | null {
  if (!eta) return null;
  const diff = Math.round((Date.parse(eta) - Date.now()) / 60000);
  return Number.isNaN(diff) ? null : Math.max(0, diff);
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
  // Disponibilité — partagée avec DriverPresence, qui transmet la présence réelle
  // à l'admin (et la garde en mémoire locale).
  const online = useDriverOnline((s) => s.online);
  const toggleOnline = useDriverOnline((s) => s.toggle);
  const [supportUnread, setSupportUnread] = useState(0);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    let q = supabase.from('orders').select('*, order_tracking(*)').in('status', DRIVER_POOL_STATUSES);
    if (driver.branch_id) q = q.eq('branch_id', driver.branch_id); // seulement son agence
    const { data } = await q.order('placed_at', { ascending: false }).limit(100);
    setBoard(mapBoard(data ?? []));
  }, [driver.branch_id]);

  // Limité à l'agence de ce livreur : un changement dans une autre agence ne
  // réveille plus l'appareil. order_tracking n'a pas de branch_id, donc il reste
  // large — l'anti-rebond ramène une rafale de prises à un seul rechargement.
  useRealtime(
    'driver-board',
    [
      { table: 'orders', filter: driver.branch_id ? `branch_id=eq.${driver.branch_id}` : undefined },
      { table: 'order_tracking' },
    ],
    refetch,
  );

  // Pastille support : les réponses du gérant plus récentes que la dernière visite.
  const refreshSupport = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('support_messages')
      .select('id, driver_id, sender, created_at')
      .eq('driver_id', driver.id)
      .order('created_at', { ascending: false })
      .limit(200);
    let lastSeen: string | null = null;
    try {
      lastSeen = localStorage.getItem(SUPPORT_SEEN_KEY);
    } catch {
      /* stockage indisponible */
    }
    setSupportUnread(unreadFromStaff((data ?? []) as SupportMessage[], lastSeen));
  }, [driver.id]);

  useEffect(() => {
    refreshSupport();
  }, [refreshSupport]);

  useRealtime(
    'driver-support-badge',
    [{ table: 'support_messages', event: 'INSERT', filter: `driver_id=eq.${driver.id}` }],
    refreshSupport,
  );

  const mine = board.filter((b) => b.tracking?.driver_id === driver.id && b.tracking?.manual);
  const available = board.filter((b) => !b.tracking?.manual);
  const activeDelivery = mine[0] ?? null;
  const note = Number(driver.rating ?? 0).toFixed(1);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      {/* En-tête : identité + accès rapides */}
      <div style={{ padding: `${SAFE_TOP + 10}px 16px 0`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 52, height: 52, borderRadius: 999, border: '2px solid var(--a-accent)', padding: 2, flexShrink: 0 }}>
          <PhotoSlot label={driver.name} src={driver.avatar_url ?? undefined} style={{ width: '100%', height: '100%', borderRadius: 999 }} sizes="48px" dim />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...text, fontWeight: 600, fontSize: 19, color: 'var(--a-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {driver.name}
          </div>
          <div style={{ ...text, fontSize: 12.5, color: 'var(--a-muted)' }}>Livreur · {driver.vehicle ?? 'Scooter'}</div>
        </div>
        <UserNotificationBell color="var(--a-text)" audience="driver" />
        <button
          onClick={logout}
          aria-label="Déconnexion"
          style={{ width: 42, height: 42, borderRadius: 999, border: '1px solid var(--a-glass-line)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Icon name="logout" size={19} color="var(--a-text)" />
        </button>
      </div>

      {/* Chiffres du livreur */}
      <div style={{ display: 'flex', gap: 22, padding: '20px 16px 0', flexWrap: 'wrap' }}>
        <Figure label="Courses" value={String(deliveriesCount)} />
        <Figure label="Gains cumulés" value={formatDH(totalEarnings).replace(' DH', '')} unit="DH" />
        <Figure label="Note" value={note} unit="/ 5" />
      </div>

      <div style={{ padding: `18px 16px ${SAFE_BOTTOM + 16}px`, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Disponibilité */}
        <Panel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                flexShrink: 0,
                background: online ? '#ffffff' : 'rgba(255,255,255,0.28)',
                boxShadow: online ? '0 0 0 4px rgba(255,255,255,0.16)' : 'none',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...text, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                {online ? 'En ligne' : 'Hors ligne'}
              </div>
              <div style={{ ...text, fontSize: 12.5, color: 'var(--muted)' }}>
                {online ? 'Vous recevez les nouvelles courses' : 'Activez pour recevoir des courses'}
              </div>
            </div>
            <Switch checked={online} onChange={toggleOnline} label="Être en ligne" />
          </div>
        </Panel>

        {/* Accès rapides */}
        <div style={{ display: 'flex', gap: 10 }}>
          <GhostAction onClick={() => router.push('/driver/planning')} full>
            <Icon name="calendar" size={18} color="var(--ink)" /> Planning
          </GhostAction>
          <GhostAction onClick={() => router.push('/driver/support')} full style={{ position: 'relative' }}>
            <Icon name="message" size={18} color="var(--ink)" /> Support
            {supportUnread > 0 && (
              <span
                aria-label={`${supportUnread} message${supportUnread > 1 ? 's' : ''} non lu${supportUnread > 1 ? 's' : ''}`}
                style={{ ...text, position: 'absolute', top: -6, right: -6, minWidth: 22, height: 22, padding: '0 6px', borderRadius: 999, background: '#ffffff', color: 'var(--a-on-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}
              >
                {supportUnread > 9 ? '9+' : supportUnread}
              </span>
            )}
          </GhostAction>
        </div>

        {/* Livraison en cours */}
        <div>
          <SectionTitle aside={mine.length ? `${mine.length} en cours` : undefined}>Livraison en cours</SectionTitle>
          {activeDelivery ? (
            <ActiveCard data={activeDelivery} onOpen={() => router.push(`/driver/order/${activeDelivery.order.id}`)} />
          ) : (
            <EmptyLine title="Aucune livraison en cours." hint="Les courses acceptées apparaissent ici." />
          )}
        </div>

        {/* Disponibles */}
        <div>
          <SectionTitle aside={online ? `${available.length} disponible${available.length > 1 ? 's' : ''}` : 'hors ligne'}>
            Demandes
          </SectionTitle>
          {!online ? (
            <EmptyLine title="Vous êtes hors ligne." hint="Activez « En ligne » pour recevoir des courses." />
          ) : (
            <Panel padding={0}>
              <button
                onClick={() => router.push('/driver/requests')}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', borderRadius: 20, padding: 16, cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="bell" size={20} color="var(--ink)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...text, fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
                    {available.length === 0 ? 'Aucune demande' : `${available.length} course${available.length > 1 ? 's' : ''} à prendre`}
                  </div>
                  <div style={{ ...text, fontSize: 12.5, color: 'var(--muted)' }}>
                    {available.length === 0 ? 'Vous recevrez les nouvelles courses ici.' : 'Voir et accepter les courses'}
                  </div>
                </div>
                <Icon name="right" size={18} color="var(--muted)" />
              </button>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

// Carte de la course en cours — état, adresse, créneau, encaissement, action.
function ActiveCard({ data, onOpen }: { data: DriverOrder; onOpen: () => void }) {
  const { order, tracking } = data;
  const eta = etaMinutes(tracking?.eta_at ?? order.eta_at);
  const isDelivery = order.mode === 'livraison';
  const stage = tracking?.stage ?? 0;
  const slot = slotShortLabel(order.slot_at);
  const cash = (order.payment_method ?? 'cod') === 'cod' ? order.total_dh : 0;

  return (
    <Panel>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <span style={{ ...text, fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>{order.code}</span>
        <Pill tone="solid">{STAGE_LABEL[stage] ?? '—'}</Pill>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={isDelivery ? 'scooter' : 'store'} size={20} color="var(--ink)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...text, fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isDelivery ? order.address ?? 'Adresse de livraison' : 'Retrait en boutique'}
          </div>
          <div style={{ ...text, fontSize: 12.5, color: 'var(--muted)' }}>
            {formatDH(order.total_dh)}
            {eta !== null ? ` · ~${eta} min` : ''}
            {slot ? ` · ${slot}` : ''}
          </div>
        </div>
      </div>

      {cash > 0 && (
        <Well style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="cash" size={17} color="var(--a-accent)" />
          <span style={{ ...text, fontSize: 13.5, color: 'var(--ink)' }}>
            <strong style={{ fontWeight: 600 }}>{formatDH(cash)}</strong> à encaisser en espèces
          </span>
        </Well>
      )}

      <PrimaryAction onClick={onOpen} style={{ marginTop: 14 }}>
        Voir la course
        <Icon name="right" size={18} color="var(--a-on-white)" />
      </PrimaryAction>
    </Panel>
  );
}
