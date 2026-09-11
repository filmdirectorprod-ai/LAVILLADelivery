// @vitest-environment jsdom
// Monte l'écran Clients : chiffres, filtre « À relancer » et recherche sans accents.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc: async () => ({ data: [], error: null }) }) }));

import { CrmScreen } from '../CrmScreen';
import type { CustomerRow } from '@/lib/admin-crm';

const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
const rows: CustomerRow[] = [
  { id: '1', name: 'Amina', phone: '0611111111', orders: 12, spend: 1500, lastOrder: daysAgo(1), points: 300, tier: 'Gourmet', segment: 'VIP', note: null },
  { id: '2', name: 'Réda', phone: null, orders: 4, spend: 300, lastOrder: daysAgo(45), points: 0, tier: null, segment: 'Régulier', note: null },
];

describe('CrmScreen', () => {
  it('filtre « À relancer » et recherche', async () => {
    render(<CrmScreen rows={rows} />);
    expect(await screen.findByRole('heading', { name: 'Amina' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Appeler Amina' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^À relancer/ }));
    expect(screen.queryByRole('button', { name: /Amina/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Réda/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Tous/ }));
    fireEvent.change(screen.getByLabelText('Rechercher un client'), { target: { value: 'reda' } });
    expect(screen.queryByRole('button', { name: /Amina/ })).not.toBeInTheDocument();
  });
});
