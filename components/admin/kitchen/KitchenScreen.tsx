// components/admin/kitchen/KitchenScreen.tsx
// Live container for the Cuisine board, in the language of the Vue d'ensemble:
// headline figures (in preparation, ready, late, longest wait), gold notices for a
// saturated station or late orders, the station load gauges, the "À produire
// maintenant" list (items of the tickets being cooked, summed by product), and the
// two kanban columns (En préparation / Prêt). Subscribes to postgres_changes on
// orders / order_items and refetches the whole board (lib/kitchen-data.ts).
// Each ticket's action calls the matching staff RPC:
//   preparing → admin_mark_order_ready     (→ ready)
//   ready     → admin_handoff_to_driver    (→ en_route)
'use client';
import { useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loadKitchenBoard } from '@/lib/kitchen-data';
import { STATION_LABEL, productionList, type KitchenBoard, type KitchenTicket } from '@/lib/kitchen';
import { StationLoadCard } from './StationLoadCard';
import { KitchenTicketCard, type KitchenAction } from './KitchenTicketCard';
import { useRealtime } from '@/lib/use-realtime';
import { HeroStat } from '@/components/admin/overview/HeroStat';
import { EmptyState, GlassPanel, LiveBadge, Notice, PageHeader, PanelTitle } from '@/components/admin/ui/Glass';

const EMPTY: KitchenBoard = { preparing: [], ready: [], stations: [], lateCodes: [] };

function todayLabel(): string {
  const s = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Casablanca' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function KitchenScreen({ initial }: { initial: KitchenBoard }) {
  const [board, setBoard] = useState<KitchenBoard>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    setBoard(await loadKitchenBoard(createClient()));
  }, []);

  // A new order lands as an orders row + N order_items rows; debounced, that is
  // a single board refetch instead of N+1.
  useRealtime('admin-kitchen', [{ table: 'orders' }, { table: 'order_items' }], refetch);

  const callRpc = useCallback(
    (fn: string) => async (orderId: string) => {
      setBusy(true);
      await createClient().rpc(fn, { p_order: orderId });
      setBusy(false);
      refetch();
    },
    [refetch],
  );

  const readyAction: KitchenAction = { label: 'Marquer prête', onClick: callRpc('admin_mark_order_ready') };
  const handoffAction: KitchenAction = { label: 'Remettre au livreur', onClick: callRpc('admin_handoff_to_driver') };

  const saturated = board.stations.filter((s) => s.saturated);
  const lateCount = board.lateCodes.length;
  const maxWait = board.stations.reduce((m, s) => Math.max(m, s.waitMinutes), 0);
  const production = useMemo(() => productionList(board.preparing), [board.preparing]);
  const maxQty = production[0]?.qty ?? 1;

  return (
    <div style={{ padding: '30px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader title="Cuisine" subtitle={todayLabel()} actions={<LiveBadge />} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 56px' }}>
        <HeroStat label="En préparation" value={String(board.preparing.length)} />
        <HeroStat label="Prêtes · attendent un livreur" value={String(board.ready.length)} />
        <HeroStat label="En retard" value={String(lateCount)} />
        <HeroStat label="Attente la plus longue" value={`~${maxWait}`} unit="min" />
      </div>

      {saturated.length > 0 && (
        <Notice icon="flame">
          Station saturée — {saturated.map((s) => STATION_LABEL[s.station]).join(', ')}. Les nouvelles commandes vont s&apos;accumuler.
        </Notice>
      )}
      {lateCount > 0 && (
        <Notice icon="clock">
          {lateCount} commande{lateCount > 1 ? 's' : ''} en retard : {board.lateCodes.join(', ')}
        </Notice>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 22, alignItems: 'start' }}>
        <GlassPanel>
          <PanelTitle>Charge des postes</PanelTitle>
          {board.stations.length === 0 ? (
            <EmptyState title="Aucun poste." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {board.stations.map((s) => (
                <StationLoadCard key={s.station} load={s} />
              ))}
            </div>
          )}
        </GlassPanel>

        <GlassPanel>
          <PanelTitle aside={production.length ? `${production.reduce((n, p) => n + p.qty, 0)} unités` : undefined}>À produire maintenant</PanelTitle>
          {production.length === 0 ? (
            <EmptyState title="Rien en préparation." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {production.slice(0, 12).map((p) => (
                <div key={p.name} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) 80px', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--ui-font)', fontSize: 20, fontWeight: 300, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{p.qty}×</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)' }}>
                      {p.orders} commande{p.orders > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                    <div style={{ width: `${(p.qty / maxQty) * 100}%`, height: '100%', borderRadius: 999, background: '#ffffff' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>

      {/* Kanban — only confirmed work (confirmation happens in Commandes) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 22, alignItems: 'start' }}>
        <KitchenColumn title="En préparation" tickets={board.preparing} busy={busy} action={readyAction} />
        <KitchenColumn title="Prêt" tickets={board.ready} busy={busy} action={handoffAction} />
      </div>
    </div>
  );
}

function KitchenColumn({ title, tickets, busy, action }: { title: string; tickets: KitchenTicket[]; busy: boolean; action: KitchenAction }) {
  return (
    <GlassPanel>
      <PanelTitle aside={`${tickets.length} commande${tickets.length > 1 ? 's' : ''}`}>{title}</PanelTitle>
      {tickets.length === 0 ? (
        <EmptyState title="Aucune commande." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tickets.map((t) => (
            <KitchenTicketCard key={t.order.id} ticket={t} busy={busy} action={action} />
          ))}
        </div>
      )}
    </GlassPanel>
  );
}
