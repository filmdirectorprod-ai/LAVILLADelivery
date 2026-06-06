import { describe, it, expect } from 'vitest';
import { ADMIN_NAV, isActiveNav } from '@/lib/admin-nav';

describe('admin nav', () => {
  it('exposes the ten sidebar sections in order', () => {
    expect(ADMIN_NAV.map((n) => n.href)).toEqual([
      '/admin',
      '/admin/orders',
      '/admin/kitchen',
      '/admin/products',
      '/admin/drivers',
      '/admin/reviews',
      '/admin/zones',
      '/admin/support',
      '/admin/incidents',
      '/admin/planning',
    ]);
  });

  it('matches the overview only on an exact path', () => {
    expect(isActiveNav('/admin', '/admin')).toBe(true);
    expect(isActiveNav('/admin/orders', '/admin')).toBe(false);
  });

  it('matches a section on its path or a sub-path', () => {
    expect(isActiveNav('/admin/orders', '/admin/orders')).toBe(true);
    expect(isActiveNav('/admin/orders/abc', '/admin/orders')).toBe(true);
    expect(isActiveNav('/admin/kitchen', '/admin/orders')).toBe(false);
  });
});
