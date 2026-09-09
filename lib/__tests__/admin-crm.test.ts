import { describe, it, expect } from 'vitest';
import { filterCustomers, segmentFor, type CustomerRow } from '@/lib/admin-crm';

const row = (over: Partial<CustomerRow>): CustomerRow => ({
  id: 'u1', name: 'User', phone: null, orders: 1, spend: 100,
  lastOrder: '2026-06-01T10:00:00Z', points: 0, tier: null, segment: 'Nouveau', note: null,
  ...over,
});

describe('admin-crm', () => {
  // Mirrors the CASE in admin_customer_rows (0051) — keep both in step.
  it('segments by spend / order count', () => {
    expect(segmentFor(1200, 1)).toBe('VIP');
    expect(segmentFor(50, 10)).toBe('VIP');
    expect(segmentFor(50, 3)).toBe('Régulier');
    expect(segmentFor(50, 1)).toBe('Nouveau');
  });

  it('filters by name or phone', () => {
    const rows = [row({ name: 'Sofia', phone: '0611' }), row({ id: 'u2', name: 'Karim', phone: '0622' })];
    expect(filterCustomers(rows, 'sof')).toHaveLength(1);
    expect(filterCustomers(rows, '0611')).toHaveLength(1);
    expect(filterCustomers(rows, 'zzz')).toHaveLength(0);
    expect(filterCustomers(rows, '  ')).toHaveLength(2);
  });
});
