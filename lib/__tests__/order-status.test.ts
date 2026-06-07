import { describe, it, expect } from 'vitest';
import {
  orderStatusLabel,
  orderStatusPill,
  isActiveOrderStatus,
  isInProgressOrderStatus,
  ACTIVE_ORDER_STATUSES,
  IN_PROGRESS_ORDER_STATUSES,
  DRIVER_POOL_STATUSES,
} from '@/lib/order-status';

describe('orderStatusLabel', () => {
  it('maps every status to its French label', () => {
    expect(orderStatusLabel('pending')).toBe('En attente');
    expect(orderStatusLabel('preparing')).toBe('En préparation');
    expect(orderStatusLabel('ready')).toBe('Prête');
    expect(orderStatusLabel('en_route')).toBe('En route');
    expect(orderStatusLabel('delivered')).toBe('Livrée');
    expect(orderStatusLabel('cancelled')).toBe('Annulée');
  });

  it('falls back to the raw value for an unknown status', () => {
    expect(orderStatusLabel('weird')).toBe('weird');
  });
});

describe('status sets', () => {
  it('treats ready as active and in-progress, but not delivered/cancelled', () => {
    expect(isActiveOrderStatus('ready')).toBe(true);
    expect(isInProgressOrderStatus('ready')).toBe(true);
    expect(isActiveOrderStatus('delivered')).toBe(false);
    expect(isActiveOrderStatus('cancelled')).toBe(false);
  });

  it('active includes the kitchen+delivery flow plus pending', () => {
    expect(ACTIVE_ORDER_STATUSES).toEqual(['pending', 'preparing', 'ready', 'en_route']);
  });

  it('in-progress excludes pending (kitchen → delivery only)', () => {
    expect(IN_PROGRESS_ORDER_STATUSES).toEqual(['preparing', 'ready', 'en_route']);
    expect(isInProgressOrderStatus('pending')).toBe(false);
  });

  it('driver pool starts at ready (kitchen gate), never preparing', () => {
    expect(DRIVER_POOL_STATUSES).toEqual(['ready', 'en_route']);
    expect(DRIVER_POOL_STATUSES).not.toContain('preparing');
  });
});

describe('orderStatusPill', () => {
  it('gives en_route and ready distinct teal pills, cancelled a red one', () => {
    expect(orderStatusPill('en_route').fg).toBe('var(--brand-d)');
    expect(orderStatusPill('ready').fg).toBe('var(--brand)');
    expect(orderStatusPill('cancelled').fg).not.toBe(orderStatusPill('ready').fg);
    expect(orderStatusPill('preparing').fg).toBe('var(--gold)');
  });
});
