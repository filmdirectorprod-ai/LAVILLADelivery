import { describe, it, expect } from 'vitest';
import { buildCustomerRows, filterCustomers, segmentFor, type CrmOrder, type CrmProfile } from '@/lib/admin-crm';

const prof = (id: string, over: Partial<CrmProfile> = {}): CrmProfile => ({
  id, full_name: 'User ' + id, phone: null, loyalty_points: 0, loyalty_tier: null, crm_note: null, ...over,
});
const ord = (user_id: string, total: number, placed: string, status = 'delivered'): CrmOrder => ({
  id: user_id + placed, user_id, code: 'C', status, total_dh: total, placed_at: placed,
});

describe('admin-crm', () => {
  it('segments by spend / order count', () => {
    expect(segmentFor(1200, 1)).toBe('VIP');
    expect(segmentFor(50, 10)).toBe('VIP');
    expect(segmentFor(50, 3)).toBe('Régulier');
    expect(segmentFor(50, 1)).toBe('Nouveau');
  });

  it('aggregates spend/orders/last per customer, excluding cancelled, sorted by spend', () => {
    const orders = [
      ord('u1', 100, '2026-06-01T10:00:00Z'),
      ord('u1', 200, '2026-06-05T10:00:00Z'),
      ord('u1', 999, '2026-06-06T10:00:00Z', 'cancelled'),
      ord('u2', 500, '2026-06-02T10:00:00Z'),
    ];
    const rows = buildCustomerRows(orders, [prof('u1', { phone: '0600', full_name: 'Karim' }), prof('u2')]);
    expect(rows.map((r) => r.id)).toEqual(['u2', 'u1']); // u2 spend 500 > u1 300
    const u1 = rows.find((r) => r.id === 'u1')!;
    expect(u1.spend).toBe(300);
    expect(u1.orders).toBe(2);
    expect(u1.lastOrder).toBe('2026-06-05T10:00:00Z');
    expect(u1.name).toBe('Karim');
    expect(u1.phone).toBe('0600');
  });

  it('filters by name or phone', () => {
    const rows = buildCustomerRows([ord('u1', 100, '2026-06-01T10:00:00Z')], [prof('u1', { full_name: 'Sofia', phone: '0611' })]);
    expect(filterCustomers(rows, 'sof')).toHaveLength(1);
    expect(filterCustomers(rows, '0611')).toHaveLength(1);
    expect(filterCustomers(rows, 'zzz')).toHaveLength(0);
  });
});
