// Helpers behind the enriched admin pages: Commandes, Cuisine, Livreurs, Produits,
// Clients, Avis, Support, Incidents, Planning, Zones.
import { describe, it, expect } from 'vitest';
import { ageLabel, isOrderWaitingLong, orderAgeMinutes, ordersHeadline, type AdminOrderRow } from '@/lib/admin-orders';
import { productionList, type KitchenTicket } from '@/lib/kitchen';
import { driverFilterCounts, filterDriverRows, rosterTotals, type DriverRow } from '@/lib/admin-drivers';
import { averagePrice, filterProducts, productFilterCounts } from '@/lib/admin-products';
import { crmTotals, daysSince, queryCustomers, type CustomerRow } from '@/lib/admin-crm';
import { driverRatings, filterReviews, positiveShare, topTags, type ReviewRow } from '@/lib/admin-reviews';
import { filterThreads, supportTotals, type SupportThread } from '@/lib/admin-support';
import { filterIncidentRows, incidentTotals, type IncidentRow } from '@/lib/admin-incidents';
import { buildShiftWeek, formatHours, rowHours, shiftHours, weekTotals } from '@/lib/admin-planning';
import { zoneTotals } from '@/lib/admin-zones';
import type { Driver, DriverShift, Incident, Order, Product, Review, SupportMessage, Zone } from '@/lib/types';

const NOW = new Date('2026-09-10T12:00:00Z');
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60000).toISOString();

describe('admin-orders headline', () => {
  const row = (status: string, placed: string, total: number) => ({ order: { status, placed_at: placed, total_dh: total } as Order, items: [], tracking: null, customerName: null, driverName: null }) as AdminOrderRow;

  it('âge et libellé', () => {
    expect(orderAgeMinutes({ placed_at: minsAgo(65) }, NOW)).toBe(65);
    expect(ageLabel(0)).toBe("à l'instant");
    expect(ageLabel(12)).toBe('12 min');
    expect(ageLabel(65)).toBe('1 h 05');
  });

  it('attente longue seulement pour les commandes ouvertes', () => {
    expect(isOrderWaitingLong({ placed_at: minsAgo(40), status: 'preparing' }, NOW)).toBe(true);
    expect(isOrderWaitingLong({ placed_at: minsAgo(40), status: 'delivered' }, NOW)).toBe(false);
    expect(isOrderWaitingLong({ placed_at: minsAgo(10), status: 'pending' }, NOW)).toBe(false);
  });

  it('chiffres du jour sans les annulées ni la veille', () => {
    const since = minsAgo(300);
    const h = ordersHeadline([row('delivered', minsAgo(60), 100), row('preparing', minsAgo(45), 50), row('cancelled', minsAgo(20), 999), row('delivered', minsAgo(600), 70)], since, NOW);
    expect(h).toEqual({ todayOrders: 2, todayRevenue: 150, avgBasket: 75, waitingLong: 1 });
  });
});

describe('kitchen productionList', () => {
  it('additionne les articles par nom', () => {
    const t = (items: [string, number][]) => ({ items: items.map(([n, q], i) => ({ id: n + i, name_snapshot: n, qty: q })) }) as unknown as KitchenTicket;
    expect(productionList([t([['Tajine', 2], ['Thé', 1]]), t([['Tajine', 1], ['Tajine', 1]])])).toEqual([
      { name: 'Tajine', qty: 4, orders: 2 },
      { name: 'Thé', qty: 1, orders: 1 },
    ]);
  });
});

describe('admin-drivers roster', () => {
  const drv = (id: string, name: string, online: boolean, extra: Partial<Driver> = {}) =>
    ({ id, name, is_online: online, last_seen: online ? minsAgo(1) : null, phone: null, vehicle: null, user_id: 'u', ...extra }) as Driver;
  const rows: DriverRow[] = [
    { driver: drv('a', 'Karim', true), deliveries: 3, earnings: 45, currentRoute: { code: 'LV-1', status: 'en_route' } },
    { driver: drv('b', 'Sanaé', true, { vehicle: 'Scooter' }), deliveries: 1, earnings: 15, currentRoute: null },
    { driver: drv('c', 'Omar', false, { user_id: null }), deliveries: 0, earnings: 0, currentRoute: null },
  ];

  it('compte par statut et totalise', () => {
    expect(driverFilterCounts(rows, NOW)).toEqual({ all: 3, available: 1, delivering: 1, offline: 1 });
    expect(rosterTotals(rows, NOW)).toEqual({ online: 2, delivering: 1, deliveries: 4, earnings: 60, withoutAccess: 1 });
  });

  it('filtre par statut et recherche sans accents', () => {
    expect(filterDriverRows(rows, 'offline', '', NOW).map((r) => r.driver.id)).toEqual(['c']);
    expect(filterDriverRows(rows, 'all', 'sanae', NOW).map((r) => r.driver.id)).toEqual(['b']);
    expect(filterDriverRows(rows, 'all', 'scoot', NOW).map((r) => r.driver.id)).toEqual(['b']);
  });
});

describe('admin-products filters', () => {
  const p = (name: string, extra: Partial<Product>) => ({ name, universe: 'patisserie', price_dh: 40, active: true, in_stock: true, is_signature: false, image_url: 'x', ...extra }) as Product;
  const list = [p('Éclair', {}), p('Tajine', { universe: 'restaurant', price_dh: 80, is_signature: true }), p('Tarte', { active: false, in_stock: false, image_url: null })];

  it('compte chaque filtre', () => {
    expect(productFilterCounts(list)).toEqual({ all: 3, active: 2, hidden: 1, out: 1, signature: 1, nophoto: 1 });
  });

  it('combine filtre, univers et recherche', () => {
    expect(filterProducts(list, 'all', 'patisserie', 'eclair').map((x) => x.name)).toEqual(['Éclair']);
    expect(filterProducts(list, 'out', 'all', '').map((x) => x.name)).toEqual(['Tarte']);
    expect(averagePrice(list)).toBe(60);
  });
});

describe('admin-crm query', () => {
  const c = (id: string, name: string, extra: Partial<CustomerRow>) => ({ id, name, phone: null, orders: 1, spend: 100, lastOrder: minsAgo(60), points: 0, tier: null, segment: 'Nouveau', note: null, ...extra }) as CustomerRow;
  const rows = [c('1', 'Amina', { spend: 1500, orders: 12, segment: 'VIP' }), c('2', 'Réda', { phone: '06 11 22 33 44', orders: 4, spend: 300, segment: 'Régulier', lastOrder: minsAgo(60 * 24 * 45) }), c('3', 'Zineb', { orders: 0, spend: 0, lastOrder: null })];

  it('recherche, segment, relance et tri', () => {
    expect(queryCustomers(rows, 'reda', 'all', 'spend', NOW).map((r) => r.id)).toEqual(['2']);
    expect(queryCustomers(rows, '0611', 'all', 'spend', NOW).map((r) => r.id)).toEqual(['2']);
    expect(queryCustomers(rows, '', 'dormant', 'spend', NOW).map((r) => r.id)).toEqual(['2']);
    expect(queryCustomers(rows, '', 'all', 'orders', NOW).map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(daysSince(null, NOW)).toBeNull();
  });

  it('totalise', () => {
    expect(crmTotals(rows, NOW)).toEqual({ customers: 3, bySegment: { VIP: 1, 'Régulier': 1, Nouveau: 1 }, spend: 1800, avgSpend: 900, dormant: 1 });
  });
});

describe('admin-reviews insights', () => {
  const r = (rating: number, tags: string[], driverName: string | null) => ({ review: { rating, tags } as Review, customerName: null, orderCode: null, driverName }) as ReviewRow;
  const rows = [r(5, ['Rapide', 'Chaud'], 'Karim'), r(4, ['Rapide'], 'Karim'), r(2, ['Froid'], 'Omar')];
  const reviews = rows.map((x) => x.review);

  it('part positive, tags et livreurs', () => {
    expect(positiveShare(reviews)).toBe(67);
    expect(positiveShare([])).toBeNull();
    expect(topTags(reviews, 2)).toEqual([{ tag: 'Rapide', count: 2 }, { tag: 'Chaud', count: 1 }]);
    expect(driverRatings(rows)).toEqual([{ name: 'Karim', average: 4.5, count: 2 }, { name: 'Omar', average: 2, count: 1 }]);
    expect(filterReviews(rows, null, 'Froid')).toHaveLength(1);
    expect(filterReviews(rows, 5, 'Rapide')).toHaveLength(1);
  });
});

describe('admin-support totals', () => {
  const msg = (sender: 'driver' | 'staff') => ({ sender }) as SupportMessage;
  const th = (name: string, online: boolean, messages: SupportMessage[], unread: number) => ({ driver: { id: name, name, avatarUrl: null, isOnline: online, matricule: '' }, messages, unread }) as SupportThread;
  const threads = [th('Karim', true, [msg('staff'), msg('driver')], 1), th('Sanaé', false, [msg('driver'), msg('staff')], 0), th('Omar', true, [], 0)];

  it('compte et filtre', () => {
    expect(supportTotals(threads)).toEqual({ drivers: 3, unread: 1, awaiting: 1, online: 2 });
    expect(filterThreads(threads, '', true).map((t) => t.driver.name)).toEqual(['Karim']);
    expect(filterThreads(threads, 'sanae', false).map((t) => t.driver.name)).toEqual(['Sanaé']);
  });
});

describe('admin-incidents totals', () => {
  const inc = (severity: Incident['severity'], status: Incident['status'], kind: string, created: string, resolved: string | null) => ({ incident: { severity, status, kind, created_at: created, resolved_at: resolved } as Incident, driverName: null, orderCode: null }) as IncidentRow;
  const rows = [inc('haute', 'open', 'retard', minsAgo(30), null), inc('basse', 'open', 'litige', minsAgo(30), null), inc('moyenne', 'resolved', 'retard', minsAgo(300), minsAgo(180)), inc('haute', 'resolved', 'accident', minsAgo(60 * 24 * 10), minsAgo(60 * 24 * 10 - 240))];

  it('ouverts, graves, résolus sur 7 jours, délai moyen', () => {
    expect(incidentTotals(rows, NOW)).toEqual({ open: 2, high: 1, resolvedWeek: 1, avgResolutionHours: 3 });
    expect(filterIncidentRows(rows, 'haute', 'all')).toHaveLength(2);
    expect(filterIncidentRows(rows, 'all', 'retard')).toHaveLength(2);
  });
});

describe('admin-planning totals', () => {
  const monday = new Date('2026-09-07T00:00:00Z');
  const shift = (id: string, driver: string, start: string, end: string) => ({ id, driver_id: driver, starts_at: start, ends_at: end, note: '', created_at: start }) as DriverShift;
  const week = buildShiftWeek(
    [shift('1', 'a', '2026-09-07T09:00:00Z', '2026-09-07T17:30:00Z'), shift('2', 'a', '2026-09-08T18:00:00Z', '2026-09-08T22:00:00Z'), shift('3', 'b', '2026-09-07T11:00:00Z', '2026-09-07T15:00:00Z')],
    [{ id: 'a', name: 'Karim' }, { id: 'b', name: 'Omar' }, { id: 'c', name: 'Sanaé' }],
    monday,
  );

  it('heures, couverture et format', () => {
    expect(shiftHours({ starts_at: '2026-09-07T09:00:00Z', ends_at: '2026-09-07T08:00:00Z' })).toBe(0);
    expect(rowHours(week.rows[0])).toBe(12.5);
    expect(weekTotals(week)).toEqual({ shifts: 3, hours: 16.5, drivers: 2, perDay: [2, 1, 0, 0, 0, 0, 0], uncoveredDays: 5 });
    expect(formatHours(7.5)).toBe('7 h 30');
    expect(formatHours(8)).toBe('8 h');
  });
});

describe('admin-zones totals', () => {
  it('moyennes et bornes', () => {
    const z = (fee: number, min: number, max: number) => ({ fee_dh: fee, eta_min: min, eta_max: max }) as Zone;
    expect(zoneTotals([z(10, 20, 30), z(20, 30, 50)])).toEqual({ count: 2, avgFee: 15, minFee: 10, maxFee: 20, avgEta: 33 });
    expect(zoneTotals([]).count).toBe(0);
  });
});
