'use client';
// Admin Statistiques: a date-range report over the last 90 days of orders. KPIs,
// daily revenue bars, top products, per-agency split, and CSV export. All figures
// come from the pure lib/admin-stats helpers; the rows are already RLS-scoped.
import { useMemo, useState } from 'react';
import { formatDH } from '@/lib/format';
import {
  filterOrders, summarize, revenueByDay, topProducts, revenueByBranch, statsToCsv,
  type StatOrder, type StatItem,
} from '@/lib/admin-stats';
import type { Branch } from '@/lib/types';

type RangeKey = 'today' | '7d' | '30d' | '90d';
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: 'today', label: "Aujourd'hui", days: 1 },
  { key: '7d', label: '7 jours', days: 7 },
  { key: '30d', label: '30 jours', days: 30 },
  { key: '90d', label: '90 jours', days: 90 },
];

function rangeBounds(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (days === 1) from.setHours(0, 0, 0, 0);
  else from.setTime(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: new Date(to.getTime() + 1000).toISOString() };
}

function Kpi({ label, value, accent, delta }: { label: string; value: string; accent?: boolean; delta?: number | null }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', flex: 1, minWidth: 150 }}>
      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 24, fontWeight: 700, color: accent ? 'var(--brand)' : 'var(--ink)' }}>{value}</div>
        {delta != null && (
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 700, color: delta >= 0 ? '#1f7a49' : '#c0392b' }}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}

export function StatsScreen({ orders, items, branches }: { orders: StatOrder[]; items: StatItem[]; branches: Branch[] }) {
  const [range, setRange] = useState<RangeKey>('30d');
  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name.replace(/ —.*$/, '')])), [branches]);

  const { from, to } = useMemo(() => rangeBounds(RANGES.find((r) => r.key === range)!.days), [range]);
  const scoped = useMemo(() => filterOrders(orders, from, to), [orders, from, to]);
  const scopedIds = useMemo(() => new Set(scoped.map((o) => o.id)), [scoped]);
  const scopedItems = useMemo(() => items.filter((it) => scopedIds.has(it.order_id)), [items, scopedIds]);

  const kpis = useMemo(() => summarize(scoped), [scoped]);
  // Same-length window immediately before, for the revenue trend.
  const prevRevenue = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    const prevFrom = new Date(Date.parse(from) - days * 24 * 60 * 60 * 1000).toISOString();
    return summarize(filterOrders(orders, prevFrom, from)).revenue;
  }, [orders, from, range]);
  const revenueDelta = prevRevenue > 0 ? Math.round(((kpis.revenue - prevRevenue) / prevRevenue) * 100) : null;
  const series = useMemo(() => revenueByDay(scoped), [scoped]);
  const top = useMemo(() => topProducts(scopedItems), [scopedItems]);
  const byBranch = useMemo(() => revenueByBranch(scoped), [scoped]);
  const maxDay = Math.max(1, ...series.map((s) => s.revenue));

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
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Statistiques</h1>
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>Chiffres de vente sur la période choisie.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {RANGES.map((r) => {
            const on = range === r.key;
            return (
              <button key={r.key} onClick={() => setRange(r.key)} style={{ border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`, borderRadius: 999, padding: '7px 14px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, background: on ? 'rgba(19,124,139,0.08)' : '#fff', color: on ? 'var(--brand)' : 'var(--muted)' }}>
                {r.label}
              </button>
            );
          })}
          <button onClick={exportCsv} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', background: '#fff' }}>
            Exporter CSV
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Kpi label="Chiffre d'affaires" value={formatDH(kpis.revenue)} accent delta={revenueDelta} />
        <Kpi label="Commandes" value={String(kpis.orders)} />
        <Kpi label="Panier moyen" value={formatDH(kpis.avgBasket)} />
        <Kpi label="Livrées" value={String(kpis.delivered)} />
      </div>

      {/* Daily revenue bars */}
      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
        <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 16 }}>Chiffre d&apos;affaires par jour</div>
        {series.length === 0 ? (
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>Aucune vente sur la période.</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, overflowX: 'auto' }}>
            {series.map((s) => (
              <div key={s.day} title={`${s.day} · ${formatDH(s.revenue)}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 26 }}>
                <div style={{ width: 22, height: Math.max(3, Math.round((s.revenue / maxDay) * 130)), background: 'var(--brand)', borderRadius: '5px 5px 0 0' }} />
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 9.5, color: 'var(--muted)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{s.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        {/* Top products */}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 14 }}>Top produits</div>
          {top.length === 0 ? (
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>—</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {top.map((t, i) => (
                <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 22, fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 13, color: 'var(--muted)' }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                  <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>×{t.qty}</span>
                  <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 700, color: 'var(--brand)', minWidth: 70, textAlign: 'right' }}>{formatDH(t.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Per agency */}
        {branches.length > 1 && (
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
            <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 14 }}>Par agence</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {branches.map((b) => {
                const v = byBranch.get(b.id) ?? { revenue: 0, orders: 0 };
                return (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ flex: 1, fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)' }}>{branchName.get(b.id)}</span>
                    <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>{v.orders} cmd</span>
                    <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 700, color: 'var(--brand)', minWidth: 70, textAlign: 'right' }}>{formatDH(v.revenue)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
