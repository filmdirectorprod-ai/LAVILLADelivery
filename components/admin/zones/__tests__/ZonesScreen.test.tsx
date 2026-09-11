// @vitest-environment jsdom
// Monte l'écran Zones : fourchette de frais, jauge relative et ouverture de l'éditeur.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/use-realtime', () => ({ useRealtime: () => {} }));
vi.mock('@/lib/use-branches', () => ({ useBranches: () => [] }));
vi.mock('@/lib/revalidate-catalogue', () => ({ revalidateCatalogue: () => {} }));

import { ZonesScreen } from '../ZonesScreen';
import type { AdminZonesData } from '@/lib/queries';

const initial = {
  zones: [
    { id: 'z1', name: 'Médina', fee_dh: 10, eta_min: 20, eta_max: 30, polygon: null, branch_id: null },
    { id: 'z2', name: 'Ville nouvelle', fee_dh: 20, eta_min: 30, eta_max: 50, polygon: null, branch_id: null },
  ],
} as unknown as AdminZonesData;

describe('ZonesScreen', () => {
  it('rend les frais et ouvre l’éditeur', () => {
    render(<ZonesScreen initial={initial} />);
    expect(screen.getByText('10–20')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Médina : 10 DH de frais' })).toHaveAttribute('aria-valuenow', '50');

    fireEvent.click(screen.getByRole('button', { name: 'Modifier la zone Médina' }));
    expect(screen.getByRole('heading', { name: 'Modifier la zone Médina' })).toBeInTheDocument();
    expect(screen.getByLabelText('Frais (DH)')).toHaveValue(10);
  });
});
