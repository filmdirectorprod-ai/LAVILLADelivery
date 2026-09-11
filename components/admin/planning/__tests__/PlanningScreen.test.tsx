// @vitest-environment jsdom
// Monte le Planning : heures par livreur et total, couverture par jour, suppression
// d'un créneau nommée.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/use-realtime', () => ({ useRealtime: () => {} }));

import { PlanningScreen } from '../PlanningScreen';
import { buildShiftWeek } from '@/lib/admin-planning';
import type { AdminPlanningData } from '@/lib/queries';
import type { DriverShift } from '@/lib/types';

const drivers = [
  { id: 'a', name: 'Karim' },
  { id: 'b', name: 'Omar' },
];
const shifts = [
  { id: '1', driver_id: 'a', starts_at: '2026-09-07T09:00:00Z', ends_at: '2026-09-07T17:30:00Z', note: '', created_at: '' },
  { id: '2', driver_id: 'a', starts_at: '2026-09-08T18:00:00Z', ends_at: '2026-09-08T22:00:00Z', note: 'Médina', created_at: '' },
] as DriverShift[];
const initial = { week: buildShiftWeek(shifts, drivers, new Date('2026-09-07T00:00:00Z')), drivers, weekStart: '2026-09-07' } as unknown as AdminPlanningData;

describe('PlanningScreen', () => {
  it('rend heures, couverture et créneaux', () => {
    render(<PlanningScreen initial={initial} />);
    // Hero, ligne de Karim et total de la grille.
    expect(screen.getAllByText('12 h 30')).toHaveLength(3);
    expect(screen.getByText('Livreurs par jour')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Supprimer le créneau 09:00–17:30 de Karim' })).toBeInTheDocument();
    expect(screen.getByText('Médina')).toBeInTheDocument();
  });
});
