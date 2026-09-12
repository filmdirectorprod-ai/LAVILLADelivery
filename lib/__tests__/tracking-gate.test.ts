import { describe, expect, it } from 'vitest';
import { createTrackingGate } from '@/lib/tracking-gate';
import type { RealtimeChangePayload } from '@/lib/use-realtime';

const update = (row: Record<string, unknown>) =>
  ({ eventType: 'UPDATE', new: row, old: {} }) as unknown as RealtimeChangePayload;

describe('createTrackingGate', () => {
  it('laisse passer la première vue d’une commande', () => {
    const gate = createTrackingGate();
    expect(gate(update({ order_id: 'o1', driver_id: 'd1', stage: 2 }))).toBe(true);
  });

  it('bloque les mises à jour qui ne bougent que la position', () => {
    const gate = createTrackingGate();
    gate(update({ order_id: 'o1', driver_id: 'd1', stage: 2, lat: 33.1, lng: -8.1 }));
    expect(gate(update({ order_id: 'o1', driver_id: 'd1', stage: 2, lat: 33.2, lng: -8.2 }))).toBe(false);
    expect(gate(update({ order_id: 'o1', driver_id: 'd1', stage: 2, lat: 33.3, lng: -8.3 }))).toBe(false);
  });

  it('laisse passer un changement d’étape, de livreur ou d’heure annoncée', () => {
    const gate = createTrackingGate();
    gate(update({ order_id: 'o1', driver_id: 'd1', stage: 2 }));
    expect(gate(update({ order_id: 'o1', driver_id: 'd1', stage: 3 }))).toBe(true);
    expect(gate(update({ order_id: 'o1', driver_id: 'd2', stage: 3 }))).toBe(true);
    expect(gate(update({ order_id: 'o1', driver_id: 'd2', stage: 3, eta_at: '2026-01-01T19:00:00Z' }))).toBe(true);
  });

  it('suit chaque commande séparément', () => {
    const gate = createTrackingGate();
    gate(update({ order_id: 'o1', stage: 2 }));
    gate(update({ order_id: 'o2', stage: 2 }));
    expect(gate(update({ order_id: 'o1', stage: 2 }))).toBe(false);
    expect(gate(update({ order_id: 'o2', stage: 4 }))).toBe(true);
  });

  it('recharge sur une suppression', () => {
    const gate = createTrackingGate();
    expect(gate({ eventType: 'DELETE', old: { order_id: 'o1' } } as unknown as RealtimeChangePayload)).toBe(true);
  });
});
