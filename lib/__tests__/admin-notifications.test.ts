import { describe, it, expect } from 'vitest';
import {
  orderNotification,
  incidentNotification,
  prependNotification,
  unreadBadge,
  relativeTime,
  type AdminNotification,
} from '@/lib/admin-notifications';

describe('orderNotification', () => {
  it('builds an order notification keyed by id, pointing at /admin/orders', () => {
    const n = orderNotification({ id: 'o1', code: 'LV-001', placed_at: '2026-06-08T10:00:00Z' });
    expect(n).toEqual({
      id: 'order:o1',
      kind: 'order',
      title: 'Nouvelle commande LV-001',
      href: '/admin/orders',
      at: '2026-06-08T10:00:00Z',
    });
  });

  it('tolerates a missing code without a trailing space', () => {
    expect(orderNotification({ id: 'o2', code: null, placed_at: '2026-06-08T10:00:00Z' }).title).toBe(
      'Nouvelle commande',
    );
  });
});

describe('incidentNotification', () => {
  it('builds an incident notification pointing at /admin/incidents', () => {
    const n = incidentNotification({ id: 'i1', title: 'Retard livraison', created_at: '2026-06-08T09:00:00Z' });
    expect(n).toEqual({
      id: 'incident:i1',
      kind: 'incident',
      title: 'Nouvel incident · Retard livraison',
      href: '/admin/incidents',
      at: '2026-06-08T09:00:00Z',
    });
  });

  it('falls back to "Incident" when the title is empty', () => {
    expect(incidentNotification({ id: 'i2', title: null, created_at: '2026-06-08T09:00:00Z' }).title).toBe(
      'Nouvel incident · Incident',
    );
  });
});

describe('prependNotification', () => {
  const a = orderNotification({ id: 'o1', code: 'LV-1', placed_at: '2026-06-08T10:00:00Z' });
  const b = incidentNotification({ id: 'i1', title: 'X', created_at: '2026-06-08T10:01:00Z' });

  it('puts the newest entry first', () => {
    expect(prependNotification([a], b).map((n) => n.id)).toEqual(['incident:i1', 'order:o1']);
  });

  it('de-duplicates by id (re-delivered event moves to front, no duplicate)', () => {
    const dup = orderNotification({ id: 'o1', code: 'LV-1', placed_at: '2026-06-08T10:05:00Z' });
    expect(prependNotification([a, b], dup).map((n) => n.id)).toEqual(['order:o1', 'incident:i1']);
  });

  it('caps the list at the given max, keeping the newest', () => {
    let list: AdminNotification[] = [];
    for (let i = 0; i < 5; i++) {
      list = prependNotification(list, orderNotification({ id: `o${i}`, code: `LV-${i}` }), 3);
    }
    expect(list).toHaveLength(3);
    expect(list[0].id).toBe('order:o4');
  });
});

describe('unreadBadge', () => {
  it('hides at zero, shows the count, caps at 9+', () => {
    expect(unreadBadge(0)).toBe('');
    expect(unreadBadge(3)).toBe('3');
    expect(unreadBadge(9)).toBe('9');
    expect(unreadBadge(10)).toBe('9+');
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-06-08T12:00:00Z');

  it('formats seconds, minutes, hours and days', () => {
    expect(relativeTime('2026-06-08T11:59:30Z', now)).toBe("à l'instant");
    expect(relativeTime('2026-06-08T11:45:00Z', now)).toBe('il y a 15 min');
    expect(relativeTime('2026-06-08T09:00:00Z', now)).toBe('il y a 3 h');
    expect(relativeTime('2026-06-06T12:00:00Z', now)).toBe('il y a 2 j');
  });

  it('returns an empty string for an unparseable date', () => {
    expect(relativeTime('not-a-date', now)).toBe('');
  });
});
