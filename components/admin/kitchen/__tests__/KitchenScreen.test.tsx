// @vitest-environment jsdom
// Monte la Cuisine : alertes saturation / retard, liste « À produire maintenant »
// et action sur un ticket.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/use-realtime', () => ({ useRealtime: () => {} }));
vi.mock('@/lib/kitchen-data', () => ({ loadKitchenBoard: async () => ({ preparing: [], ready: [], stations: [], lateCodes: [] }) }));

import { KitchenScreen } from '../KitchenScreen';
import type { KitchenBoard } from '@/lib/kitchen';

const ticket = (id: string, code: string, items: [string, number][], late: boolean) => ({
  order: { id, code, mode: 'livraison' },
  items: items.map(([n, q], i) => ({ id: `${id}-${i}`, qty: q, name_snapshot: n })),
  station: 'restaurant',
  customerName: 'Amina R.',
  itemCount: items.reduce((a, [, q]) => a + q, 0),
  late,
  minutesRemaining: late ? -5 : 10,
});

const board = {
  preparing: [ticket('o1', 'LV-7', [['Tajine', 2], ['Thé', 1]], true), ticket('o2', 'LV-8', [['Tajine', 1]], false)],
  ready: [],
  stations: [{ station: 'restaurant', label: 'Restaurant', capacity: 6, active: 6, loadPct: 100, saturated: true, waitMinutes: 12 }],
  lateCodes: ['LV-7'],
} as unknown as KitchenBoard;

describe('KitchenScreen', () => {
  it('rend alertes, production et actions', () => {
    render(<KitchenScreen initial={board} />);
    expect(screen.getByText(/Station saturée/)).toBeInTheDocument();
    expect(screen.getByText(/en retard : LV-7/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'À produire maintenant' })).toBeInTheDocument();
    expect(screen.getByText('3×')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Restaurant : charge 100 %' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marquer prête — LV-7' })).toBeInTheDocument();
  });
});
