// @vitest-environment jsdom
// Monte l'écran Fidélité : recherche et filtre par palier, mouvements récents,
// catalogue des récompenses verrouillé pour un gérant d'agence.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/use-realtime', () => ({ useRealtime: () => {} }));

import { LoyaltyAdminScreen } from '../LoyaltyAdminScreen';
import type { Reward } from '@/lib/types';

const members = [
  { id: 'u1', name: 'Amina Benali', points: 1200, tier: 'Connaisseur' },
  { id: 'u2', name: 'Youssef', points: 300, tier: 'Gourmand' },
];
const activity = [{ id: 'l1', userId: 'u1', name: 'Amina Benali', delta: 50, reason: 'Commande LV-001', createdAt: new Date().toISOString() }];
const rewards = [{ id: 'r1', title: 'Café offert', cost_pts: 200, image_url: null, active: true }] as Reward[];

function mount() {
  return render(<LoyaltyAdminScreen members={members} activity={activity} flow={[]} rewards={rewards} ledgerReady canEditRewards={false} />);
}

describe('LoyaltyAdminScreen', () => {
  it('affiche les mouvements et verrouille le catalogue', () => {
    mount();
    expect(screen.getByText('+50 pts')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Désactiver « Café offert »' })).toBeDisabled();
    expect(screen.getByText('Modifiable par le super-admin')).toBeInTheDocument();
  });

  it('filtre les membres par recherche puis par palier', () => {
    mount();
    expect(screen.getAllByText('Amina Benali')).toHaveLength(2); // liste + mouvements
    fireEvent.change(screen.getByLabelText('Rechercher un membre'), { target: { value: 'youss' } });
    expect(screen.getAllByText('Amina Benali')).toHaveLength(1);
    expect(screen.getByText('Youssef')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Rechercher un membre'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /^Connaisseur/ }));
    expect(screen.queryByText('Youssef')).not.toBeInTheDocument();
    expect(screen.getAllByText('Amina Benali')).toHaveLength(2);
  });
});
