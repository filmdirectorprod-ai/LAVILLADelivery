'use client';
// Demandes — le vivier des courses non prises, dans la langue de l'admin :
// chiffres en tête, pastilles de tri, cartes de verre. « Accepter » passe par
// driver_accept_order (0008) ; « Refuser » masque la carte pour cette session.
//
// Le livreur gagne les frais de livraison. Le schéma ne stocke ni distance ni
// durée par course : on n'invente donc pas « 3,2 km / ~28 min », on montre
// l'argent réel (gain + total) et, depuis 0054, le créneau demandé et ce qu'il
// faudra encaisser.
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { formatDH } from '@/lib/format';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { DRIVER_POOL_STATUSES } from '@/lib/order-status';
import { slotShortLabel } from '@/lib/checkout-slots';
import { useRealtime, type RealtimeChangePayload } from '@/lib/use-realtime';
import { useBranches } from '@/lib/use-branches';
import { createTrackingGate } from '@/lib/tracking-gate';
import type { Order, OrderTracking } from '@/lib/types';
import type { DriverOrder } from '@/lib/queries';
import { EmptyLine, Figure, GhostAction, Panel, Pill, PrimaryAction, text } from '@/components/driver/ui/DriverUI';

type SortMode = 'recent' | 'pay';

function mapBoard(rows: unknown[]): DriverOrder[] {
  return (rows ?? []).map((r) => {
    const { order_tracking, ...order } = r as Order & {
      order_tracking: OrderTracking | OrderTracking[] | null;
    };
    const tracking = Array.isArray(order_tracking) ? order_tracking[0] ?? null : order_tracking ?? null;
    return { order: order as Order, tracking };
  });
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (Number.isNaN(mins)) return '';
  if (mins < 1) return 'À l’instant';
  if (mins < 60) return `Il y a ${mins} min`;
  const h = Math.floor(mins / 60);
  return `Il y a ${h} h`;
}

export function DriverRequestsScreen({ initialBoard, branchId }: { initialBoard: DriverOrder[]; branchId?: string | null }) {
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const [board, setBoard] = useState<DriverOrder[]>(initialBoard);
  const [sort, setSort] = useState<SortMode>('recent');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    let q = supabase.from('orders').select('*, order_tracking(*)').in('status', DRIVER_POOL_STATUSES);
    if (branchId) q = q.eq('branch_id', branchId); // seulement l'agence du livreur
    const { data } = await q.order('placed_at', { ascending: false }).limit(100);
    setBoard(mapBoard(data ?? []));
  }, [branchId]);

  // Seules les commandes de cette agence atteignent l'appareil ; l'anti-rebond
  // ramène la rafale d'une prise de course à un seul rechargement.
  // Même précaution que le tableau de bord : order_tracking n'est pas filtrable
  // par agence, la position de chaque livreur de la ville arrivait ici toutes
  // les 4 secondes. Seule compte ici la prise de course (`manual`), que la porte
  // laisse passer.
  const gate = useRef(createTrackingGate()).current;
  const onPoolChange = useCallback(
    (payload: RealtimeChangePayload) => {
      if (payload.table === 'order_tracking' && !gate(payload)) return;
      refetch();
    },
    [gate, refetch],
  );

  useRealtime(
    'driver-requests',
    [
      { table: 'orders', filter: branchId ? `branch_id=eq.${branchId}` : undefined },
      { table: 'order_tracking' },
    ],
    onPoolChange,
  );

  const available = useMemo(() => {
    const list = board.filter((b) => !b.tracking?.manual && !dismissed.has(b.order.id));
    return [...list].sort((a, b) =>
      sort === 'pay'
        ? b.order.delivery_fee_dh - a.order.delivery_fee_dh
        : Date.parse(b.order.placed_at) - Date.parse(a.order.placed_at),
    );
  }, [board, dismissed, sort]);

  const gainTotal = available.reduce((n, b) => n + (b.order.delivery_fee_dh ?? 0), 0);

  // Un écran vide ne disait pas pourquoi il l'était. Or deux règles, invisibles
  // depuis ici, décident de ce qui arrive : la cuisine doit avoir marqué la
  // commande « prête », et la commande doit partir de CETTE agence — les règles
  // de lecture de la base empêchent même le livreur de voir les autres. Sans
  // cette phrase, un livreur qui attend croit l'application cassée.
  const branches = useBranches();
  const myBranch = branches.find((b) => b.id === branchId)?.name ?? null;

  const accept = async (orderId: string) => {
    setBusy(orderId);
    const { error } = await createClient().rpc('driver_accept_order', { p_order: orderId });
    setBusy(null);
    if (error) {
      toast('Course déjà prise par un autre livreur.');
      refetch();
      return;
    }
    router.push(`/driver/order/${orderId}`);
  };

  const refuse = (orderId: string) => setDismissed((prev) => new Set(prev).add(orderId));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <div style={{ padding: `${SAFE_TOP + 10}px 16px 0` }}>
        <h1 style={{ ...text, margin: 0, fontWeight: 600, fontSize: 27, letterSpacing: '-0.02em', color: 'var(--a-text)' }}>Demandes</h1>
        <p style={{ ...text, fontSize: 13, color: 'var(--a-muted)', margin: '4px 0 0' }}>Courses disponibles dans votre agence.</p>
      </div>

      <div style={{ display: 'flex', gap: 24, padding: '18px 16px 0', flexWrap: 'wrap' }}>
        <Figure label="Courses à prendre" value={String(available.length)} />
        <Figure label="Gain cumulé" value={formatDH(gainTotal).replace(' DH', '')} unit="DH" />
      </div>

      <div role="group" aria-label="Trier les courses" style={{ display: 'flex', gap: 8, padding: '18px 16px 0' }}>
        <SortChip on={sort === 'recent'} onClick={() => setSort('recent')}>
          Plus récentes
        </SortChip>
        <SortChip on={sort === 'pay'} onClick={() => setSort('pay')}>
          Mieux payées
        </SortChip>
      </div>

      <div style={{ padding: `16px 16px ${SAFE_BOTTOM + 16}px`, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {available.length === 0 ? (
          <EmptyLine
            title="Aucune course à récupérer."
            hint={
              myBranch
                ? `Une commande arrive ici dès que la cuisine l’a marquée « prête », et seulement si elle part de votre agence — ${myBranch}.`
                : 'Une commande arrive ici, en direct, dès que la cuisine l’a marquée « prête ».'
            }
          />
        ) : (
          available.map((b) => (
            <RequestCard
              key={b.order.id}
              data={b}
              busy={busy === b.order.id}
              onAccept={() => accept(b.order.id)}
              onRefuse={() => refuse(b.order.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SortChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        ...text,
        border: on ? '1px solid #ffffff' : '1px solid var(--a-glass-line)',
        background: on ? '#ffffff' : 'transparent',
        color: on ? 'var(--a-on-white)' : 'var(--ink)',
        borderRadius: 999,
        padding: '9px 16px',
        fontSize: 13.5,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function RequestCard({
  data,
  busy,
  onAccept,
  onRefuse,
}: {
  data: DriverOrder;
  busy: boolean;
  onAccept: () => void;
  onRefuse: () => void;
}) {
  const { order } = data;
  const isDelivery = order.mode === 'livraison';
  const slot = slotShortLabel(order.slot_at);
  const cash = (order.payment_method ?? 'cod') === 'cod' ? order.total_dh : 0;

  return (
    <Panel>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ ...text, fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>{order.code}</span>
          <Pill tone="outline">{isDelivery ? 'Livraison' : 'Retrait'}</Pill>
          {slot && <Pill tone="accent">{slot}</Pill>}
        </div>
        <span style={{ ...text, fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{timeAgo(order.placed_at)}</span>
      </div>

      {/* trajet */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: '#ffffff' }} />
          <span style={{ width: 2, flex: 1, background: 'var(--line)', margin: '3px 0' }} />
          <span style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--a-accent)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...text, fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>La Villa · boutique</div>
          <div style={{ ...text, fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isDelivery ? order.address ?? 'Adresse de livraison' : 'Retrait en boutique'}
          </div>
        </div>
      </div>

      {/* argent */}
      <div style={{ display: 'flex', gap: 22, borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '12px 0', marginBottom: 14 }}>
        <Figure label="Votre gain" value={formatDH(order.delivery_fee_dh).replace(' DH', '')} unit="DH" />
        <Figure label={cash > 0 ? 'À encaisser' : 'Total commande'} value={formatDH(order.total_dh).replace(' DH', '')} unit="DH" />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <GhostAction onClick={onRefuse} disabled={busy} style={{ flex: 1 }}>
          Refuser
        </GhostAction>
        <PrimaryAction onClick={onAccept} disabled={busy} full={false} style={{ flex: 1.6 }}>
          {busy ? 'Acceptation…' : 'Accepter'}
        </PrimaryAction>
      </div>
    </Panel>
  );
}
