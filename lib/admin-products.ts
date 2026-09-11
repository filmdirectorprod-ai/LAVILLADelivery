// Pure, side-effect-free helpers for the admin Produits screen. The catalogue is
// grouped by category (ordered by the category sort, products name-sorted) here so
// the same logic serves the server first-paint and the client realtime refetch,
// and stays unit testable. No React, no I/O.

import type { Product, Category, Universe } from '@/lib/types';

export interface ProductGroup {
  /** Category key (Product.category / Category.key). */
  key: string;
  /** Display label — the category's label, or the raw key if no category row. */
  label: string;
  products: Product[];
}

/** Group products under their category, ordered by the category `sort`. Products
 *  whose category has no matching row are collected into a trailing "Autres"
 *  group. Within each group products are sorted by name. */
export function buildProductGroups(products: Product[], categories: Category[]): ProductGroup[] {
  const catByKey = new Map(categories.map((c) => [c.key, c]));
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    const cur = groups.get(p.category);
    if (cur) cur.push(p);
    else groups.set(p.category, [p]);
  }

  const out: ProductGroup[] = Array.from(groups.entries()).map(([key, list]) => {
    const cat = catByKey.get(key);
    list.sort((a, b) => a.name.localeCompare(b.name));
    return { key, label: cat?.label ?? key, products: list };
  });
  out.sort((a, b) => {
    const sa = catByKey.get(a.key)?.sort ?? Number.MAX_SAFE_INTEGER;
    const sb = catByKey.get(b.key)?.sort ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.label.localeCompare(b.label);
  });
  return out;
}

export interface CatalogueStats {
  total: number;
  active: number;
  signature: number;
}

/** Headline counts for the Produits screen header. */
export function catalogueStats(products: Product[]): CatalogueStats {
  return {
    total: products.length,
    active: products.filter((p) => p.active).length,
    signature: products.filter((p) => p.is_signature).length,
  };
}
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export type ProductFilter = 'all' | 'active' | 'hidden' | 'out' | 'signature' | 'nophoto';

export const PRODUCT_FILTER_LABEL: Record<ProductFilter, string> = {
  all: 'Tous',
  active: 'En vente',
  hidden: 'Masqués',
  out: 'En rupture',
  signature: 'Signatures',
  nophoto: 'Sans photo',
};

function matchesFilter(p: Product, f: ProductFilter): boolean {
  switch (f) {
    case 'all':
      return true;
    case 'active':
      return p.active;
    case 'hidden':
      return !p.active;
    case 'out':
      return !p.in_stock;
    case 'signature':
      return p.is_signature;
    case 'nophoto':
      return !p.image_url;
  }
}

export function productFilterCounts(products: Product[]): Record<ProductFilter, number> {
  const out = { all: 0, active: 0, hidden: 0, out: 0, signature: 0, nophoto: 0 } as Record<ProductFilter, number>;
  for (const p of products) for (const f of Object.keys(out) as ProductFilter[]) if (matchesFilter(p, f)) out[f] += 1;
  return out;
}

/** Products matching a state filter, a universe and an accent-insensitive name search. */
export function filterProducts(products: Product[], filter: ProductFilter, universe: Universe | 'all', query: string): Product[] {
  const q = fold(query.trim());
  return products.filter((p) => matchesFilter(p, filter) && (universe === 'all' || p.universe === universe) && (!q || fold(p.name).includes(q)));
}

/** Mean price of the products on sale, rounded; 0 when none. */
export function averagePrice(products: Product[]): number {
  const onSale = products.filter((p) => p.active);
  return onSale.length ? Math.round(onSale.reduce((n, p) => n + Number(p.price_dh), 0) / onSale.length) : 0;
}
