// @vitest-environment jsdom
// Monte l'écran Livreurs : alerte d'accès manquant, classement du jour et filtre
// par statut.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/use-realtime', () => ({ useRealtime: () => {} }));
vi.mock('@/lib/use-branches', () => ({ useBranches: () => [] }));

import { DriversScreen } from '../DriversScreen';
import type { AdminDriversData } from '@/lib/queries';

const driver = (id: string, name: string, online: boolean, userId: string | null) => ({ id, name, is_online: online, last_seen: online ? new Date().toISOString() : null, user_id: userId, rating: 4.8, phone: null, vehicle: 'Scooter', avatar_url: null });
const initial = {
  rows: [
    { driver: driver('a', 'Karim', true, 'u1'), deliveries: 3, earnings: 45, currentRoute: { code: 'LV-9', status: 'en_route' } },
    { driver: driver('b', 'Omar', false, null), deliveries: 0, earnings: 0, currentRoute: null },
  ],
} as unknown as AdminDriversData;

describe('DriversScreen', () => {
  it('rend alerte et classement puis filtre', () => {
    render(<DriversScreen initial={initial} />);
    expect(screen.getByRole('status')).toHaveTextContent("1 livreur n'a pas encore d'accès");
    expect(screen.getByRole('heading', { name: 'Classement du jour' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Karim' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Hors ligne/ }));
    expect(screen.queryByRole('heading', { name: 'Karim' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Omar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer un accès pour Omar' })).toBeInTheDocument();
  });
});
