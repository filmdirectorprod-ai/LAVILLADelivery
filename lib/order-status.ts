// Single source of truth for order-status presentation and grouping. Consumed by
// the customer orders list, the driver pool, and the admin overview/orders/kitchen
// screens so every surface agrees on labels, colours and which statuses count as
// "active" / "in progress" / "pickable by a driver".
//
// Lifecycle: pending → preparing → ready → en_route → delivered  (+ cancelled).
//   • ready  : the kitchen has marked the food cooked — it now enters the driver
//              pickup pool. This is the kitchen "gate".
import type { OrderStatus } from '@/lib/types';

/** Statuses an order passes through while still open for the customer. */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['pending', 'preparing', 'ready', 'en_route'];

/** Statuses the admin counts as "in progress" (kitchen → delivery; excludes the
 *  never-used `pending`). */
export const IN_PROGRESS_ORDER_STATUSES: OrderStatus[] = ['preparing', 'ready', 'en_route'];

/** Statuses an order must be in to appear in / be claimed from the driver pool. */
export const DRIVER_POOL_STATUSES: OrderStatus[] = ['ready', 'en_route'];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente',
  preparing: 'En préparation',
  ready: 'Prête',
  en_route: 'En route',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

/** French label for a status; falls back to the raw value if unknown. */
export function orderStatusLabel(status: string): string {
  return STATUS_LABELS[status as OrderStatus] ?? status;
}

export function isActiveOrderStatus(status: string): boolean {
  return (ACTIVE_ORDER_STATUSES as string[]).includes(status);
}

export function isInProgressOrderStatus(status: string): boolean {
  return (IN_PROGRESS_ORDER_STATUSES as string[]).includes(status);
}

export interface StatusPill {
  bg: string;
  fg: string;
}

/** Pill background/foreground for a status badge. `preparing`/`pending` keep the
 *  gold treatment the Phase 2 overview table already used. */
export function orderStatusPill(status: string): StatusPill {
  switch (status) {
    case 'en_route':
      return { bg: 'rgba(19,124,139,0.12)', fg: 'var(--brand-d)' };
    case 'ready':
      return { bg: 'rgba(19,124,139,0.10)', fg: 'var(--brand)' };
    case 'delivered':
      return { bg: 'rgba(46,125,50,0.12)', fg: '#2e7d32' };
    case 'cancelled':
      return { bg: 'rgba(180,35,35,0.10)', fg: '#a23' };
    default:
      return { bg: 'rgba(168,151,35,0.14)', fg: 'var(--gold)' };
  }
}
