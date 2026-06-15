// lib/kitchen.ts — Pure logic for the admin "Cuisine" board (no I/O, fully testable).
// Turns a snapshot of kitchen orders (pending | preparing | ready) into the three
// kanban columns plus the per-station load model (capacity is fixed, see
// STATION_CAPACITY) and the list of late-order codes.
import type { Order, OrderItem, Universe } from '@/lib/types';

export type StationId = Universe; // 'patisserie' | 'restaurant'

/** Fixed kitchen capacity per station (how many active orders saturate it). */
export const STATION_CAPACITY: Record<StationId, number> = {
  patisserie: 4,
  restaurant: 6,
};

export const STATION_LABEL: Record<StationId, string> = {
  patisserie: 'Pâtisserie',
  restaurant: 'Restaurant',
};

/** Stable display order of the station cards. */
export const STATION_ORDER: StationId[] = ['patisserie', 'restaurant'];

export interface KitchenTicket {
  order: Order;
  items: OrderItem[];
  station: StationId;
  customerName: string;
  itemCount: number;
  /** True only for active (pending/preparing) orders past their ETA. */
  late: boolean;
  /** Minutes until eta_at (may be negative); null when no ETA. */
  minutesRemaining: number | null;
}

export interface StationLoad {
  station: StationId;
  label: string;
  capacity: number;
  /** Active orders (pending + preparing) routed to this station. */
  active: number;
  /** 0..100, capped. */
  loadPct: number;
  saturated: boolean;
  /** Rough wait estimate: longest remaining ETA among this station's queue. */
  waitMinutes: number;
}

export interface KitchenBoard {
  pending: KitchenTicket[];
  preparing: KitchenTicket[];
  ready: KitchenTicket[];
  stations: StationLoad[];
  lateCodes: string[];
}

export interface KitchenInput {
  /** Orders with status in (pending, preparing, ready), already FIFO-ordered. */
  orders: Order[];
  itemsByOrder: Map<string, OrderItem[]>;
  universeOf: (productId: string | null) => Universe | null;
  nameOf?: (userId: string) => string | null;
  now?: Date;
}

/** "Mehdi Rahimi" -> "Mehdi R." · single token kept as-is · empty -> "Client". */
export function shortName(fullName: string | null | undefined): string {
  const raw = (fullName ?? '').trim();
  if (!raw) return 'Client';
  const parts = raw.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last[0].toUpperCase()}.`;
}

/** Route an order to a station by the dominant universe of its items (tie → pâtisserie). */
export function ticketStation(
  items: OrderItem[],
  universeOf: (productId: string | null) => Universe | null,
): StationId {
  let pat = 0;
  let resto = 0;
  for (const it of items) {
    const u = universeOf(it.product_id);
    if (u === 'patisserie') pat += it.qty;
    else if (u === 'restaurant') resto += it.qty;
  }
  return resto > pat ? 'restaurant' : 'patisserie';
}

export function minutesRemaining(etaIso: string | null, now: Date): number | null {
  if (!etaIso) return null;
  const t = Date.parse(etaIso);
  if (Number.isNaN(t)) return null;
  return Math.round((t - now.getTime()) / 60000);
}

export function isLate(order: Order, now: Date): boolean {
  if (!order.eta_at) return false;
  const t = Date.parse(order.eta_at);
  if (Number.isNaN(t)) return false;
  return now.getTime() > t;
}

function itemCountOf(items: OrderItem[]): number {
  return items.reduce((n, it) => n + it.qty, 0);
}

export function buildKitchenBoard(input: KitchenInput): KitchenBoard {
  const now = input.now ?? new Date();

  const make = (o: Order, flagLate: boolean): KitchenTicket => {
    const items = input.itemsByOrder.get(o.id) ?? [];
    return {
      order: o,
      items,
      station: ticketStation(items, input.universeOf),
      customerName: shortName(input.nameOf?.(o.user_id) ?? null),
      itemCount: itemCountOf(items),
      late: flagLate && isLate(o, now),
      minutesRemaining: minutesRemaining(o.eta_at, now),
    };
  };

  const pending = input.orders.filter((o) => o.status === 'pending').map((o) => make(o, true));
  const preparing = input.orders.filter((o) => o.status === 'preparing').map((o) => make(o, true));
  const ready = input.orders.filter((o) => o.status === 'ready').map((o) => make(o, false));

  const active = [...pending, ...preparing];
  const stations: StationLoad[] = STATION_ORDER.map((st) => {
    const mine = active.filter((t) => t.station === st);
    const capacity = STATION_CAPACITY[st];
    const count = mine.length;
    const remaining = mine
      .map((t) => t.minutesRemaining)
      .filter((m): m is number => m != null && m > 0);
    return {
      station: st,
      label: STATION_LABEL[st],
      capacity,
      active: count,
      loadPct: Math.min(100, Math.round((count / capacity) * 100)),
      saturated: count >= capacity,
      waitMinutes: remaining.length ? Math.max(...remaining) : 0,
    };
  });

  const lateCodes = active.filter((t) => t.late).map((t) => t.order.code);

  return { pending, preparing, ready, stations, lateCodes };
}
