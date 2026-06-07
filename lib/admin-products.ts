// Pure, side-effect-free helpers for the admin Produits screen. The catalogue is
// grouped by category (ordered by the category sort, products name-sorted) here so
// the same logic serves the server first-paint and the client realtime refetch,
// and stays unit testable. No React, no I/O.

import type { Product, Category } from '@/lib/types';

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
