// components/admin/kitchen/KitchenScreen.tsx
// Live container for the redesigned Cuisine board. Renders the server snapshot
// (KitchenBoard), subscribes to postgres_changes on orders / order_items and
// refetches the whole board (via lib/kitchen-data.ts) on any change. Shows the
// date + "Temps réel" badge, a saturation alert, a late-orders alert, the two
// station load gauges, and the three kanban columns (En attente / En préparation
// / Prêt). Each ticket's action calls the matching staff RPC:
//   pending   → admin_start_preparation   (→ preparing)
//   preparing → admin_mark_order_ready     (→ ready)
//   ready     → admin_handoff_to_driver    (→ en_route)
'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loadKitchenBoard } from '@/lib/kitchen-data';
import { STATION_LABEL, type KitchenBoard, type KitchenTicket } from '@/lib/kitchen';
import { Icon } from '@/components/ui/Icon';
import { StationLoadCard } from './StationLoadCard';
import { KitchenTicketCard, type KitchenAction } from './KitchenTicketCard';

const EMPTY: KitchenBoard = { preparing: [], ready: [], stations: [], lateCodes: [] };

function todayLabel(): string {
  const s = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function KitchenScreen({ initial }: { initial: KitchenBoard }) {
  const [board, setBoard] = useState<KitchenBoard>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    setBoard(await loadKitchenBoard(supabase));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-kitchen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const callRpc = useCallback(
    (fn: string) => async (orderId: string) => {
      setBusy(true);
      const supabase = createClient();
      await supabase.rpc(fn, { p_order: orderId });
      setBusy(false);
      refetch();
    },
    [refetch],
  );

  const readyAction: KitchenAction = { label: 'Marquer prête', color: 'var(--gold)', onClick: callRpc('admin_mark_order_ready') };
  const handoffAction: KitchenAction = { label: 'Remettre au livreur', color: '#2f9e6f', onClick: callRpc('admin_handoff_to_driver') };

  const saturated = board.stations.filter((s) => s.saturated);
  const lateCount = board.lateCodes.length;

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Cuisine</h1>
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>{todayLabel()}</p>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--brand)', background: 'rgba(19,124,139,0.10)', padding: '7px 13px', borderRadius: 999 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: '#2f9e6f', display: 'inline-block' }} />
          Temps réel
        </span>
      </div>

      {/* Alerts */}
      {saturated.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(210,75,75,0.10)', border: '1px solid rgba(210,75,75,0.3)', borderRadius: 14, padding: '13px 16px' }}>
          <Icon name="flame" size={18} color="#d24b4b" />
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 600, color: '#b23b3b' }}>
            Station saturée — {saturated.map((s) => STATION_LABEL[s.station]).join(', ')}. Les nouvelles commandes vont s&apos;accumuler.
          </span>
        </div>
      )}
      {lateCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(168,151,35,0.12)', border: '1px solid rgba(168,151,35,0.32)', borderRadius: 14, padding: '13px 16px' }}>
          <Icon name="clock" size={18} color="var(--gold)" />
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 600, color: '#8a7a14' }}>
            {lateCount} commande{lateCount > 1 ? 's' : ''} en retard : {board.lateCodes.join(', ')}
          </span>
        </div>
      )}

      {/* Station load gauges */}
      {board.stations.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {board.stations.map((s) => (
            <StationLoadCard key={s.station} load={s} />
          ))}
        </div>
      )}

      {/* Kanban — only confirmed work (confirmation happens in Commandes) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
        <KitchenColumn title="En préparation" tone="var(--brand)" tickets={board.preparing} busy={busy} action={readyAction} />
        <KitchenColumn title="Prêt" tone="#2f9e6f" tickets={board.ready} busy={busy} action={handoffAction} />
      </div>
    </div>
  );
}

function KitchenColumn({
  title,
  tone,
  tickets,
  busy,
  action,
}: {
  title: string;
  tone: string;
  tickets: KitchenTicket[];
  busy: boolean;
  action: KitchenAction;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: tone, display: 'inline-block' }} />
        <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', margin: 0 }}>{title}</h2>
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: 'var(--muted)', background: 'var(--soft)', padding: '2px 8px', borderRadius: 999 }}>
          {tickets.length}
        </span>
      </div>
      {tickets.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed var(--line)', borderRadius: 14, padding: '26px 16px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>
          Aucune commande.
        </div>
      ) : (
        tickets.map((t) => <KitchenTicketCard key={t.order.id} ticket={t} busy={busy} action={action} />)
      )}
    </div>
  );
}
