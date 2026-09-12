// @vitest-environment jsdom
// Monte réellement la vue d'ensemble avec des données d'exemple : le rendu doit
// aboutir, les grands chiffres s'afficher, et les pastilles doivent filtrer la
// liste des commandes. Supabase, le temps réel et le chargement dynamique de la
// carte sont neutralisés.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/use-realtime', () => ({ useRealtime: () => {} }));
// L'écran nomme l'agence dans son alerte « commande prête sans livreur » ; le
// hook interroge Supabase, neutralisé ici comme le reste.
vi.mock('@/lib/use-branches', () => ({
  useBranches: () => [{ id: 'riad', name: 'La Villa Riad — Ville Nouvelle' }],
}));
vi.mock('next/dynamic', () => ({
  default: () =>
    function LiveDriverMapStub() {
      return <div>Suivi des livreurs · en direct</div>;
    },
}));

import { OverviewScreen } from '../OverviewScreen';
import type { AdminOverviewData } from '@/lib/queries';

const today = new Date().toISOString();
const order = (id: string, code: string, status: string, total: number) =>
  ({ id, code, status, total_dh: total, placed_at: today, mode: 'livraison' }) as unknown as AdminOverviewData['orders'][number];

const data = {
  orders: [
    order('o1', 'LV-001', 'en_route', 132),
    order('o2', 'LV-002', 'delivered', 80),
    order('o3', 'LV-003', 'cancelled', 999),
  ],
  drivers: [{ id: 'd1', name: 'Brahim', is_online: true }],
  ratings: [4, 5],
  tracking: [{ order_id: 'o1', driver_id: 'd1', lat: 34, lng: -5, updated_at: today }],
} as unknown as AdminOverviewData;

describe('OverviewScreen', () => {
  it('rend l’en-tête, les grands chiffres et les commandes en cours', () => {
    render(<OverviewScreen initial={data} mapsKey={undefined} />);
    expect(screen.getByText('livreurs en ligne')).toBeInTheDocument();
    expect(screen.getByText("Chiffre d'affaires du jour")).toBeInTheDocument();
    expect(screen.getByText('212')).toBeInTheDocument(); // 132 + 80, l’annulée exclue
    expect(screen.getByRole('heading', { name: 'Commandes en cours' })).toBeInTheDocument();
    expect(screen.getByText('LV-001')).toBeInTheDocument();
    expect(screen.queryByText('LV-002')).not.toBeInTheDocument();
    expect(screen.getByText(/Brahim/)).toBeInTheDocument();
  });

  it('filtre la liste quand on choisit une pastille', () => {
    render(<OverviewScreen initial={data} mapsKey={undefined} />);
    const chips = screen.getByRole('group', { name: 'Filtrer les commandes par statut' });
    fireEvent.click(within(chips).getByRole('button', { name: /Livrées/ }));
    expect(screen.getByRole('heading', { name: 'Commandes · Livrées' })).toBeInTheDocument();
    expect(screen.getByText('LV-002')).toBeInTheDocument();
    expect(screen.queryByText('LV-001')).not.toBeInTheDocument();

    fireEvent.click(within(chips).getByRole('button', { name: /Toutes/ }));
    expect(screen.getByText('LV-003')).toBeInTheDocument();
  });

  it('affiche un message quand un filtre est vide', () => {
    render(<OverviewScreen initial={data} mapsKey={undefined} />);
    const chips = screen.getByRole('group', { name: 'Filtrer les commandes par statut' });
    fireEvent.click(within(chips).getByRole('button', { name: /En attente/ }));
    expect(screen.getByText(/Aucune commande « en attente » aujourd'hui\./)).toBeInTheDocument();
  });
});
