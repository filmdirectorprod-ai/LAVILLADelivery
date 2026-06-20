'use client';
// Driver "Demandes" — the dedicated available-orders pool (mockup 4). Lists the
// unclaimed orders any driver can take, with two sort modes (most recent / best
// paid), an "Accepter" action (driver_accept_order RPC, 0008) and a local
// "Refuser" that just hides the card for this session.
//
// The driver earns the delivery fee (delivery_fee_dh). There's no per-order
// distance or duration in the schema, so — unlike the mockup — we don't fake
// "3.2 km / ~28 min"; we surface the real money (gain + order total) instead.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { formatDH } from '@/lib/format';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { DRIVER_POOL_STATUSES } from '@/lib/order-status';
import { Btn } from '@/components/ui/Btn';
import { Badge } from '@/components/ui/Badge';
import type { Order, OrderTracking } from '@/lib/types';
import type { DriverOrder } from '@/lib/queries';

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
    let q = supabase
      .from('orders')
      .select('*, order_tracking(*)')
      .in('status', DRIVER_POOL_STATUSES);
    if (branchId) q = q.eq('branch_id', branchId); // only this driver's agency
    const { data } = await q.order('placed_at', { ascending: false });
    setBoard(mapBoard(data ?? []));
  }, [branchId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('driver-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_tracking' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const available = useMemo(() => {
    const list = board.filter((b) => !b.tracking?.manual && !dismissed.has(b.order.id));
    return [...list].sort((a, b) =>
      sort === 'pay'
        ? b.order.delivery_fee_dh - a.order.delivery_fee_dh
        : Date.parse(b.order.placed_at) - Date.parse(a.order.placed_at),
    );
  }, [board, dismissed, sort]);

  const accept = async (orderId: string) => {
    setBusy(orderId);
    const supabase = createClient();
    const { error } = await supabase.rpc('driver_accept_order', { p_order: orderId });
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: `${SAFE_TOP + 6}px 16px 14px`, background: 'linear-gradient(150deg, var(--brand), var(--brand-d))' }}>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 21, color: '#fff', margin: 0 }}>
          Nouvelles commandes
        </h1>
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
          {available.length} course{available.length > 1 ? 's' : ''} disponible{available.length > 1 ? 's' : ''} près de vous
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Chip active={sort === 'recent'} onClick={() => setSort('recent')}>Plus récentes</Chip>
          <Chip active={sort === 'pay'} onClick={() => setSort('pay')}>Mieux payées</Chip>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `16px 16px ${SAFE_BOTTOM + 16}px` }}>
        {available.length === 0 ? (
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', background: '#fff', border: '1px dashed var(--line)', borderRadius: 18, padding: '26px 16px', textAlign: 'center' }}>
            Aucune commande à récupérer pour l’instant.
          </div>
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

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: 'none',
        borderRadius: 999,
        padding: '9px 16px',
        cursor: 'pointer',
        fontFamily: 'var(--ui-font)',
        fontSize: 13.5,
        fontWeight: 600,
        background: active ? '#fff' : 'rgba(255,255,255,0.16)',
        color: active ? 'var(--brand-d)' : '#fff',
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
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: 16, marginBottom: 12, boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{order.code}</span>
          <Badge gold>Nouveau</Badge>
        </div>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>{timeAgo(order.placed_at)}</span>
      </div>

      {/* route */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--brand)' }} />
          <span style={{ width: 2, flex: 1, background: 'var(--line)', margin: '3px 0' }} />
          <span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--brand-d)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>La Villa · boutique</div>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isDelivery ? order.address ?? 'Adresse de livraison' : 'Retrait en boutique'}
          </div>
        </div>
      </div>

      {/* money */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', margin: '0 0 14px' }}>
        <Metric label="Gain (livraison)" value={formatDH(order.delivery_fee_dh)} accent />
        <Metric label="Total commande" value={formatDH(order.total_dh)} />
      </div>

      {/* actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="ghost" onClick={onRefuse} disabled={busy} style={{ flex: 1 }}>
          Refuser
        </Btn>
        <Btn onClick={onAccept} disabled={busy} style={{ flex: 2 }}>
          {busy ? 'Acceptation…' : `Accepter · ${formatDH(order.total_dh)}`}
        </Btn>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, padding: '12px 0', textAlign: 'center', borderRight: accent ? '1px solid var(--line)' : 'none' }}>
      <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 16, color: accent ? 'var(--brand)' : 'var(--ink)' }}>{value}</div>
      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
