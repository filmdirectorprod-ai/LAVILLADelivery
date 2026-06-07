import { describe, it, expect } from 'vitest';
import { buildIncidentRows, openIncidentCount, partitionIncidentRows } from '@/lib/admin-incidents';
import type { Incident } from '@/lib/types';

function incident(over: Partial<Incident> & { id: string }): Incident {
  return {
    order_id: null,
    driver_id: null,
    kind: 'retard',
    severity: 'moyenne',
    status: 'open',
    title: 'Incident',
    detail: '',
    created_by: null,
    created_at: '2026-06-07T10:00:00Z',
    resolved_at: null,
    ...over,
  };
}

const drivers = [{ id: 'd1', name: 'Karim' }];
const orders = [{ id: 'o1', code: 'LV-001' }];

describe('buildIncidentRows', () => {
  it('joins driver and order, leaving missing links null', () => {
    const rows = buildIncidentRows(
      [incident({ id: 'i1', driver_id: 'd1', order_id: 'o1' })],
      drivers,
      orders,
    );
    expect(rows[0]).toMatchObject({ driverName: 'Karim', orderCode: 'LV-001' });
    const rows2 = buildIncidentRows([incident({ id: 'i2', driver_id: 'ghost', order_id: null })], drivers, orders);
    expect(rows2[0]).toMatchObject({ driverName: null, orderCode: null });
  });

  it('puts open incidents before resolved, most severe then newest', () => {
    const rows = buildIncidentRows(
      [
        incident({ id: 'resolved', status: 'resolved', resolved_at: '2026-06-07T12:00:00Z' }),
        incident({ id: 'open-low', status: 'open', severity: 'basse', created_at: '2026-06-07T11:00:00Z' }),
        incident({ id: 'open-high', status: 'open', severity: 'haute', created_at: '2026-06-07T09:00:00Z' }),
      ],
      drivers,
      orders,
    );
    expect(rows.map((r) => r.incident.id)).toEqual(['open-high', 'open-low', 'resolved']);
  });

  it('orders resolved incidents most-recently-resolved first', () => {
    const rows = buildIncidentRows(
      [
        incident({ id: 'old', status: 'resolved', resolved_at: '2026-06-06T10:00:00Z' }),
        incident({ id: 'new', status: 'resolved', resolved_at: '2026-06-07T10:00:00Z' }),
      ],
      drivers,
      orders,
    );
    expect(rows.map((r) => r.incident.id)).toEqual(['new', 'old']);
  });
});

describe('openIncidentCount', () => {
  it('counts only open incidents', () => {
    const list = [
      incident({ id: 'i1', status: 'open' }),
      incident({ id: 'i2', status: 'resolved' }),
      incident({ id: 'i3', status: 'open' }),
    ];
    expect(openIncidentCount(list)).toBe(2);
  });
});

describe('partitionIncidentRows', () => {
  it('splits into open and resolved, preserving input order', () => {
    const rows = buildIncidentRows(
      [
        incident({ id: 'open-high', status: 'open', severity: 'haute' }),
        incident({ id: 'open-low', status: 'open', severity: 'basse' }),
        incident({ id: 'done', status: 'resolved', resolved_at: '2026-06-07T12:00:00Z' }),
      ],
      drivers,
      orders,
    );
    const { open, resolved } = partitionIncidentRows(rows);
    expect(open.map((r) => r.incident.id)).toEqual(['open-high', 'open-low']);
    expect(resolved.map((r) => r.incident.id)).toEqual(['done']);
  });
});
