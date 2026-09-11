// @vitest-environment jsdom
// Monte l'écran Avis : mots-clés fréquents cliquables et livreurs les mieux notés.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/use-realtime', () => ({ useRealtime: () => {} }));

import { ReviewsScreen } from '../ReviewsScreen';
import type { AdminReviewsData } from '@/lib/queries';

const row = (id: string, rating: number, tags: string[], driverName: string) => ({
  review: { id, order_id: id, user_id: 'u', rating, tags, comment: '', photo_url: null, points_awarded: 0, created_at: new Date().toISOString() },
  customerName: 'Amina',
  orderCode: `LV-${id}`,
  driverName,
});
const initial = { rows: [row('1', 5, ['Rapide'], 'Karim'), row('2', 4, ['Rapide'], 'Karim'), row('3', 2, ['Froid'], 'Omar')] } as unknown as AdminReviewsData;

describe('ReviewsScreen', () => {
  it('filtre par mot-clé et classe les livreurs', () => {
    render(<ReviewsScreen initial={initial} />);
    expect(screen.getAllByRole('img', { name: /sur 5/ })).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'Livreurs les mieux notés' })).toBeInTheDocument();
    expect(screen.getByText('Karim')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Froid/ }));
    expect(screen.getAllByRole('img', { name: /sur 5/ })).toHaveLength(1);
  });
});
