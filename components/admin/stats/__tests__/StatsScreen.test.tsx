// @vitest-environment jsdom
// Monte l'écran Statistiques : évolutions vs période précédente, répartition
// livraison / retrait, grille d'affluence et top produits ; et, sans la
// migration 0053, le message qui l'explique au lieu de sections vides.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/use-realtime', () => ({ useRealtime: () => {} }));

import { StatsScreen } from '../StatsScreen';
import { toSnapshot } from '@/lib/admin-stats';
import type { Branch } from '@/lib/types';

const branches = [{ id: 'b1', slug: 'riad', name: 'La Villa Riad — Fès', is_active: true }] as Branch[];

describe('StatsScreen', () => {
  it('rend les évolutions, les modes, la grille et le top produits', () => {
    const snapshot = toSnapshot({
      kpis: { revenue: 1500, orders: 30, avgBasket: 50, delivered: 20 },
      prevRevenue: 1000,
      prevKpis: { revenue: 1000, orders: 40, avgBasket: 25, delivered: 20 },
      series: [{ day: '2026-09-04', revenue: 1500 }],
      top: [{ name: 'Tajine de poulet', qty: 12, revenue: 900 }],
      byBranch: { b1: { revenue: 1500, orders: 30 } },
      modes: { livraison: { orders: 3, revenue: 300 }, retrait: { orders: 1, revenue: 100 } },
      cancelled: { count: 1, total: 5 },
      heatmap: [{ dow: 5, hour: 20, orders: 2 }],
    });
    render(<StatsScreen snapshot={snapshot} branches={branches} />);
    expect(screen.getByText('▲ 50 %')).toBeInTheDocument();
    expect(screen.getByText('▼ 25 %')).toBeInTheDocument();
    expect(screen.getByText('75 %')).toBeInTheDocument();
    expect(screen.getByText('Ven')).toBeInTheDocument();
    expect(screen.getByText('Tajine de poulet')).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 jours' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('signale la migration 0053 manquante', () => {
    const snapshot = toSnapshot({ kpis: { revenue: 10, orders: 1, avgBasket: 10, delivered: 1 }, prevRevenue: 0, series: [], top: [], byBranch: {} });
    render(<StatsScreen snapshot={snapshot} branches={branches} />);
    expect(screen.getByRole('note')).toHaveTextContent('0053');
  });
});
