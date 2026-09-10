// @vitest-environment jsdom
// Monte l'écran Gérants : une carte par agence avec l'activité du jour, la
// dernière connexion, le mot de passe masqué par défaut et le panneau de
// réinitialisation.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

import { ManagersScreen, type ManagerRow } from '../ManagersScreen';
import type { Branch } from '@/lib/types';

const branches = [{ id: 'b1', slug: 'riad', name: 'La Villa Riad — Fès', address: '12 rue du Riad', phone: '+212 5 35 00 00 00', plus_code: null, lat: null, lng: null, is_active: true }] as Branch[];
const managers: ManagerRow[] = [{ id: 'm1', full_name: 'Karim', branch_id: 'b1', email: 'karim@gerant.lavilla.ma', last_sign_in_at: null }];

function mount() {
  return render(<ManagersScreen branches={branches} managers={managers} activity={{ b1: { orders: 296, revenue: 41200 } }} />);
}

describe('ManagersScreen', () => {
  it("rend la carte de l'agence et la dernière connexion", () => {
    mount();
    const card = screen.getByRole('heading', { name: 'La Villa Riad' }).closest('section')!;
    expect(within(card).getByText('296')).toBeInTheDocument();
    expect(within(card).getByText('Karim')).toBeInTheDocument();
    expect(screen.getByText('Dernière connexion : Jamais connecté')).toBeInTheDocument();
    expect(screen.getByText('karim@gerant.lavilla.ma')).toBeInTheDocument();
  });

  it('masque le mot de passe par défaut et ouvre la réinitialisation', () => {
    mount();
    const pw = screen.getByLabelText('Mot de passe');
    expect(pw).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(pw).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Nouveau mot de passe' }));
    expect(screen.getByLabelText('Nouveau mot de passe pour Karim')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Enregistrer le mot de passe' })).toBeInTheDocument();
  });
});
