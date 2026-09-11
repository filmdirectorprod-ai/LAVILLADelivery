'use client';
// Admin Statistiques, in the language of the Vue d'ensemble: large light figures
// with their evolution against the previous window of the same length, a glass
// panel with the daily revenue and a weekday × hour heatmap, a side column with
// the delivery / pickup split, the cancellation rate and the per-agency share,
// and the top products with their share of revenue.
//
// Everything is aggregated in Postgres (admin_stats_snapshot — 0051, 0052, 0053).
// Against a database that has not received 0053 yet the new keys are absent:
// the screen says so instead of showing empty sections as if nothing sold.
import { Fragment, useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatAmount } from '@/lib/format';
import {
  RANGES,
  DEFAULT_RANGE,
  WEEKDAYS,
  rangeWindow,
  pctDelta,
  toSnapshot,
  statsToCsv,
  cancellationRate,
  heatmapGrid,
  modeShares,
  topWithShares,
  type RangeKey,
  type StatsSnapshot,
} from '@/lib/admin-stats';
import type { Branch } from '@/lib/types';
import { useRealtime } from '@/lib/use-realtime';
import { HeroStat, MiniStat } from '@/components/admin/overview/HeroStat';
import { Chip, EmptyState, GhostButton, GlassPanel, Meter, PageHeader, PanelTitle, SubPanel } from '@/components/admin/ui/Glass';

const MIGRATION_HINT = 'Disponible après la migration 0053.';

/** ▲▼ against the previous window. Down is gold, not red: the palette has no
 *  red, and gold on the dark ground reads as "look here". */
function Delta({ value }: { value: number | null }) {
  if (value === null) return <div style={{ height: 26 }} />;
  const up = value >= 0;
  return (
    <div style={{ marginTop: 8, fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: up ? 'var(--a-text)' : 'var(--a-accent)' }}>
      {up ? '▲' : '▼'} {Math.abs(value)} %<span style={{ fontWeight: 400, color: 'var(--a-muted)' }}> vs période précédente</span>
    </div>
  );
}

const dayLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function StatsScreen({ snapshot: initial, branches }: { snapshot: StatsSnapshot; branches: Branch[] }) {
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);
  const [snapshot, setSnapshot] = useState<StatsSnapshot>(initial);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (key: RangeKey) => {
    const { from, to, prevFrom } = rangeWindow(key);
    setLoading(true);
    const { data } = await createClient().rpc('admin_stats_snapshot', { p_from: from, p_to: to, p_prev_from: prevFrom });
    setSnapshot(toSnapshot(data));
    setLoading(false);
  }, []);

  const pick = useCallback(
    (key: RangeKey) => {
      setRange(key);
      load(key);
    },
    [load],
  );

  // Live: re-run the aggregate when an order changes. A 2 s debounce keeps a busy
  // dinner service to one aggregation, not one per order event.
  const refetch = useCallback(() => load(range), [load, range]);
  useRealtime('admin-stats', [{ table: 'orders' }], refetch, { debounceMs: 2000 });

  const { kpis, prevKpis, series, byBranch } = snapshot;
  const maxDay = Math.max(1, ...series.map((s) => s.revenue));
  const bestDay = series.length ? series.reduce((a, b) => (b.revenue > a.revenue ? b : a)).day : null;
  const heat = useMemo(() => heatmapGrid(snapshot.heatmap), [snapshot.heatmap]);
  const modes = useMemo(() => modeShares(snapshot.modes), [snapshot.modes]);
  const top = useMemo(() => topWithShares(snapshot.top, kpis.revenue), [snapshot.top, kpis.revenue]);
  const cancelRate = cancellationRate(snapshot);
  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name.replace(/ —.*$/, '')])), [branches]);
  const branchRevenueTotal = branches.reduce((n, b) => n + (byBranch[b.id]?.revenue ?? 0), 0);

  function exportCsv() {
    const csv = statsToCsv(series);
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stats-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div style={{ padding: '30px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Statistiques"
        subtitle={loading ? 'Mise à jour…' : 'Chiffres de vente sur la période choisie, comparés à la période précédente de même durée.'}
        actions={
          <>
            {RANGES.map((r) => (
              <Chip key={r.key} on={range === r.key} onClick={() => pick(r.key)}>
                {r.label}
              </Chip>
            ))}
            <GhostButton onClick={exportCsv}>Exporter CSV</GhostButton>
          </>
        }
      />

      {!snapshot.extended && (
        <div role="note" style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--a-text)', border: '1px solid var(--a-glass-line)', borderRadius: 16, padding: '12px 16px' }}>
          La répartition livraison / retrait, les annulations, la grille d&apos;affluence et l&apos;évolution de chaque indicateur apparaîtront dès que la
          migration <strong>0053</strong> sera appliquée sur la base.
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 56px' }}>
        <div>
          <HeroStat label="Chiffre d'affaires" value={formatAmount(kpis.revenue)} unit="DH" />
          <Delta value={pctDelta(kpis.revenue, snapshot.prevRevenue)} />
        </div>
        <div>
          <HeroStat label="Commandes" value={String(kpis.orders)} />
          <Delta value={pctDelta(kpis.orders, prevKpis.orders)} />
        </div>
        <div>
          <HeroStat label="Panier moyen" value={formatAmount(kpis.avgBasket)} unit="DH" />
          <Delta value={pctDelta(kpis.avgBasket, prevKpis.avgBasket)} />
        </div>
        <div>
          <HeroStat label="Livrées" value={String(kpis.delivered)} />
          <Delta value={pctDelta(kpis.delivered, prevKpis.delivered)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: 22, alignItems: 'start' }}>
        <GlassPanel>
          <PanelTitle aside={bestDay ? `Meilleur jour : ${dayLabel(bestDay)}` : undefined}>Chiffre d&apos;affaires par jour</PanelTitle>
          {series.length === 0 ? (
            <EmptyState title="Aucune vente sur la période." />
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 190, overflowX: 'auto', paddingBottom: 4 }}>
              {series.map((s) => (
                <div
                  key={s.day}
                  title={`${dayLabel(s.day)} · ${formatAmount(s.revenue)} DH`}
                  style={{ flex: '1 0 14px', maxWidth: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%' }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${Math.max(4, (s.revenue / maxDay) * 150)}px`,
                      borderRadius: 8,
                      background: s.day === bestDay ? 'var(--a-accent)' : 'rgba(255, 255, 255, 0.55)',
                    }}
                  />
                  <span style={{ fontFamily: 'var(--ui-font)', fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{dayLabel(s.day)}</span>
                </div>
              ))}
            </div>
          )}

          <SubPanel style={{ marginTop: 18 }}>
            <PanelTitle aside={heat.max > 0 ? `Pic : ${heat.max} commande${heat.max > 1 ? 's' : ''} sur un créneau` : undefined}>Affluence · jour × heure</PanelTitle>
            {!snapshot.extended ? (
              <EmptyState title={MIGRATION_HINT} />
            ) : heat.max === 0 ? (
              <EmptyState title="Aucune commande sur la période." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '34px repeat(24, minmax(12px, 1fr))', gap: 3, minWidth: 420 }}>
                  <span />
                  {Array.from({ length: 24 }, (_, h) => (
                    <span key={h} style={{ fontFamily: 'var(--ui-font)', fontSize: 9.5, color: 'var(--muted)', textAlign: 'center', visibility: h % 3 === 0 ? 'visible' : 'hidden' }}>
                      {h}h
                    </span>
                  ))}
                  {heat.grid.map((row, d) => (
                    <Fragment key={WEEKDAYS[d]}>
                      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>{WEEKDAYS[d]}</span>
                      {row.map((n, h) => (
                        <div
                          key={h}
                          title={`${WEEKDAYS[d]} ${h}h · ${n} commande${n > 1 ? 's' : ''}`}
                          style={{
                            height: 18,
                            borderRadius: 4,
                            background:
                              n === 0 ? 'rgba(255, 255, 255, 0.05)' : n === heat.max ? 'var(--a-accent)' : `rgba(255, 255, 255, ${(0.14 + 0.7 * (n / heat.max)).toFixed(2)})`,
                          }}
                        />
                      ))}
                    </Fragment>
                  ))}
                </div>
              </div>
            )}
          </SubPanel>
        </GlassPanel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <GlassPanel>
            <PanelTitle>Livraison / retrait</PanelTitle>
            {!snapshot.extended ? (
              <EmptyState title={MIGRATION_HINT} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {modes.map((m) => (
                  <div key={m.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6, fontFamily: 'var(--ui-font)', fontSize: 13 }}>
                      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{m.label}</span>
                      <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {m.orders} cmd · <strong style={{ color: 'var(--ink)' }}>{m.share} %</strong>
                      </span>
                    </div>
                    <Meter ratio={m.share / 100} label={`${m.label} : ${m.share} % des commandes`} />
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                  <MiniStat
                    label="Taux d'annulation"
                    value={cancelRate === null ? '—' : String(cancelRate)}
                    unit={cancelRate === null ? undefined : '%'}
                    title={`${snapshot.cancelled.count} annulée${snapshot.cancelled.count > 1 ? 's' : ''} sur ${snapshot.cancelled.total} commande${snapshot.cancelled.total > 1 ? 's' : ''}`}
                  />
                </div>
              </div>
            )}
          </GlassPanel>

          {branches.length > 1 && (
            <GlassPanel>
              <PanelTitle>Par agence</PanelTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {branches.map((b) => {
                  const v = byBranch[b.id] ?? { revenue: 0, orders: 0 };
                  const ratio = branchRevenueTotal > 0 ? v.revenue / branchRevenueTotal : 0;
                  return (
                    <div key={b.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6, fontFamily: 'var(--ui-font)', fontSize: 13 }}>
                        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{branchName.get(b.id)}</span>
                        <span style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {v.orders} cmd · <strong style={{ color: 'var(--ink)' }}>{formatAmount(v.revenue)} DH</strong>
                        </span>
                      </div>
                      <Meter ratio={ratio} label={`${branchName.get(b.id)} : ${Math.round(ratio * 100)} % du chiffre d'affaires`} />
                    </div>
                  );
                })}
              </div>
            </GlassPanel>
          )}
        </div>
      </div>

      <GlassPanel>
        <PanelTitle aside={top.length ? `${top.length} produit${top.length > 1 ? 's' : ''}` : undefined}>Top produits</PanelTitle>
        {top.length === 0 ? (
          <EmptyState title="Aucun produit vendu sur la période." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {top.map((t, i) => (
              <div key={t.name} style={{ display: 'grid', gridTemplateColumns: '24px minmax(120px, 1.2fr) minmax(0, 2fr) 56px 96px 48px', alignItems: 'center', gap: 14 }}>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                <div style={{ height: 8, borderRadius: 999, background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${t.width * 100}%`, height: '100%', borderRadius: 999, background: i === 0 ? 'var(--a-accent)' : 'rgba(255, 255, 255, 0.6)' }} />
                </div>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>×{t.qty}</span>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatAmount(t.revenue)} DH</span>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.share === null ? '—' : `${t.share} %`}</span>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
