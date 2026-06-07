import { describe, it, expect } from 'vitest';
import { buildProductGroups, catalogueStats } from '@/lib/admin-products';
import type { Product, Category } from '@/lib/types';

function product(over: Partial<Product> & { id: string; name: string; category: string }): Product {
  return {
    slug: over.id,
    universe: 'patisserie',
    price_dh: 20,
    description: '',
    rating: 5,
    reviews_count: 0,
    image_url: null,
    photo_label: null,
    is_customizable: false,
    diet_badges: [],
    tags: [],
    is_signature: false,
    active: true,
    created_at: '2026-06-07T10:00:00Z',
    ...over,
  };
}

const categories: Category[] = [
  { id: 'c1', key: 'gateaux', label: 'Gâteaux', universe: 'patisserie', sort: 1 },
  { id: 'c2', key: 'viennoiserie', label: 'Viennoiserie', universe: 'patisserie', sort: 2 },
];

describe('buildProductGroups', () => {
  it('groups by category ordered by sort, products name-sorted', () => {
    const products = [
      product({ id: 'p1', name: 'Croissant', category: 'viennoiserie' }),
      product({ id: 'p2', name: 'Tarte', category: 'gateaux' }),
      product({ id: 'p3', name: 'Éclair', category: 'gateaux' }),
    ];
    const groups = buildProductGroups(products, categories);
    expect(groups.map((g) => g.key)).toEqual(['gateaux', 'viennoiserie']);
    expect(groups[0].label).toBe('Gâteaux');
    expect(groups[0].products.map((p) => p.name)).toEqual(['Tarte', 'Éclair'].sort((a, b) => a.localeCompare(b)));
  });

  it('puts products with an unknown category in a trailing group keyed by raw key', () => {
    const products = [
      product({ id: 'p1', name: 'Mystère', category: 'inconnu' }),
      product({ id: 'p2', name: 'Tarte', category: 'gateaux' }),
    ];
    const groups = buildProductGroups(products, categories);
    expect(groups.map((g) => g.key)).toEqual(['gateaux', 'inconnu']);
    expect(groups[1].label).toBe('inconnu');
  });
});

describe('catalogueStats', () => {
  it('counts total, active and signature products', () => {
    const products = [
      product({ id: 'p1', name: 'A', category: 'gateaux', active: true, is_signature: true }),
      product({ id: 'p2', name: 'B', category: 'gateaux', active: false, is_signature: false }),
      product({ id: 'p3', name: 'C', category: 'gateaux', active: true, is_signature: false }),
    ];
    expect(catalogueStats(products)).toEqual({ total: 3, active: 2, signature: 1 });
  });
});
