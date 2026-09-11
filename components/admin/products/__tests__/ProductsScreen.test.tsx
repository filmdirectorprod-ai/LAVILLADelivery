// @vitest-environment jsdom
// Monte l'écran Produits : alerte de rupture, interrupteurs et filtre d'état.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/use-realtime', () => ({ useRealtime: () => {} }));
vi.mock('@/lib/use-branches', () => ({ useBranches: () => [] }));
vi.mock('@/lib/revalidate-catalogue', () => ({ revalidateCatalogue: () => {} }));

import { ProductsScreen } from '../ProductsScreen';
import type { AdminProductsData } from '@/lib/queries';

const product = (id: string, name: string, inStock: boolean) => ({ id, name, universe: 'patisserie', category: 'pat', price_dh: 40, active: true, in_stock: inStock, is_signature: false, image_url: null, photo_label: null });
const initial = {
  products: [product('p1', 'Éclair', true), product('p2', 'Tarte', false)],
  categories: [{ id: 'c1', key: 'pat', label: 'Pâtisserie fine', universe: 'patisserie', sort: 1 }],
} as unknown as AdminProductsData;

describe('ProductsScreen', () => {
  it('signale la rupture et filtre', () => {
    render(<ProductsScreen initial={initial} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 produit est en rupture');
    expect(screen.getByRole('switch', { name: 'En stock — Tarte' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('heading', { name: 'Éclair' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^En rupture/ }));
    expect(screen.queryByRole('heading', { name: 'Éclair' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tarte' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
