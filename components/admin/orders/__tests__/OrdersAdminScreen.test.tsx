// @vitest-environment jsdom
// Monte l'écran Commandes : onglet « À confirmer » par défaut, alerte d'attente
// longue, onglets avec compteurs et recherche par client.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/use-realtime', () => ({ useRealtime: () => {} }));
vi.mock('@/lib/use-branches', () => ({ useBranches: () => [] }));

import { OrdersAdminScreen } from '../OrdersAdminScreen';
import type { AdminOrdersData } from '@/lib/queries';

const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const row = (id: string, code: string, status: string, placed: string, customer: string) => ({
  order: { id, code, status, mode: 'livraison', total_dh: 120, placed_at: placed, branch_id: null },
  items: [{ id: `${id}-i`, order_id: id, qty: 2, name_snapshot: 'Tajine' }],
  tracking: null,
  customerName: customer,
  driverName: null,
});
const initial = { rows: [row('o1', 'LV-101', 'pending', ago(5), 'Amina'), row('o2', 'LV-102', 'preparing', ago(45), 'Youssef')], drivers: [] } as unknown as AdminOrdersData;

describe('OrdersAdminScreen', () => {
  it("ouvre sur « À confirmer » et signale l'attente longue", () => {
    render(<OrdersAdminScreen initial={initial} />);
    expect(screen.getByText('LV-101')).toBeInTheDocument();
    expect(screen.queryByText('LV-102')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vérifier' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 commande ouverte depuis plus de 30 min');
  });

  it('filtre par onglet puis par client', () => {
    render(<OrdersAdminScreen initial={initial} />);
    fireEvent.click(screen.getByRole('button', { name: /^Toutes\s*2$/ }));
    expect(screen.getByText('LV-102')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Rechercher une commande'), { target: { value: 'youss' } });
    expect(screen.queryByText('LV-101')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prête' })).toBeInTheDocument();
  });
});
