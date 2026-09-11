// @vitest-environment jsdom
// Monte l'écran Incidents : alerte gravité haute et filtre par gravité.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/use-realtime', () => ({ useRealtime: () => {} }));

import { IncidentsScreen } from '../IncidentsScreen';
import type { AdminIncidentsData } from '@/lib/queries';

const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
const row = (id: string, title: string, severity: string, status: string, resolved: string | null) => ({
  incident: { id, title, severity, status, kind: 'retard', detail: '', driver_id: null, order_id: null, created_by: null, created_at: ago(5), resolved_at: resolved },
  driverName: null,
  orderCode: null,
});
const initial = {
  rows: [row('1', 'Accident scooter', 'haute', 'open', null), row('2', 'Client absent', 'basse', 'open', null), row('3', 'Retard Médina', 'moyenne', 'resolved', ago(3))],
  drivers: [],
  orders: [],
} as unknown as AdminIncidentsData;

describe('IncidentsScreen', () => {
  it('alerte puis filtre par gravité', () => {
    render(<IncidentsScreen initial={initial} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 incident de gravité haute');
    expect(screen.getByText('Résolu en 2 h')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Résoudre « Accident scooter »' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Basse/ }));
    expect(screen.queryByRole('heading', { name: 'Accident scooter' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Client absent' })).toBeInTheDocument();
  });
});
