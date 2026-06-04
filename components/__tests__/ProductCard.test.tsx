import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCard } from '@/components/ProductCard';
import { formatDH } from '@/lib/format';
import type { Product } from '@/lib/types';

const product: Product = {
  id: 'p1',
  slug: 'p-fraisier',
  name: 'Le Fraisier de La Villa',
  universe: 'patisserie',
  category: 'gateaux',
  price_dh: 165,
  description: '',
  rating: 4.9,
  reviews_count: 214,
  image_url: null,
  photo_label: 'Fraisier entier',
  is_customizable: true,
  diet_badges: [],
  tags: ['Chef', 'Fait maison'],
  is_signature: true,
  active: true,
  created_at: '2026-01-01T00:00:00Z',
};

describe('ProductCard', () => {
  it('renders name, price via formatDH, and the gold tag', () => {
    render(<ProductCard p={product} />);
    expect(screen.getByText('Le Fraisier de La Villa')).toBeTruthy();
    expect(screen.getByText(formatDH(165))).toBeTruthy();
    expect(screen.getByText('Chef')).toBeTruthy();
  });

  it('fires onAdd without bubbling to onOpen', () => {
    const onOpen = vi.fn();
    const onAdd = vi.fn();
    const { container } = render(
      <ProductCard p={product} onOpen={onOpen} onAdd={onAdd} />,
    );
    // the add button is the last button in the card
    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onAdd).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
