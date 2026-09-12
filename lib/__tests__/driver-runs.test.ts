import { describe, expect, it } from 'vitest';
import { driverRuns, type DriverPosition } from '@/lib/admin-overview';

const brahim: DriverPosition = { id: 'd1', name: 'Brahim', lat: 34.04, lng: -4.99 };
const amine: DriverPosition = { id: 'd2', name: 'Amine', lat: 34.03, lng: -5.0 };

const commande = (over: Partial<Parameters<typeof driverRuns>[2][number]> = {}) => ({
  id: 'o1',
  code: 'CMD-1234',
  status: 'en_route',
  address: '12 av. Hassan II',
  dest_lat: 34.02,
  dest_lng: -5.01,
  ...over,
});

describe('driverRuns', () => {
  it('rattache un livreur à la course qu’il porte', () => {
    const runs = driverRuns([brahim], [{ order_id: 'o1', driver_id: 'd1' }], [commande()]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      driverId: 'd1',
      driverName: 'Brahim',
      orderCode: 'CMD-1234',
      from: { lat: 34.04, lng: -4.99 },
      to: { lat: 34.02, lng: -5.01 },
    });
  });

  it('ignore une commande encore en boutique : le trajet n’a pas commencé', () => {
    const runs = driverRuns([brahim], [{ order_id: 'o1', driver_id: 'd1' }], [commande({ status: 'ready' })]);
    expect(runs).toEqual([]);
  });

  it('ignore une commande sans coordonnées (passée avant la migration 0054)', () => {
    const runs = driverRuns(
      [brahim],
      [{ order_id: 'o1', driver_id: 'd1' }],
      [commande({ dest_lat: null, dest_lng: null })],
    );
    expect(runs).toEqual([]);
  });

  it('laisse sans trajet un livreur en ligne qui n’a pas de course', () => {
    const runs = driverRuns([brahim, amine], [{ order_id: 'o1', driver_id: 'd1' }], [commande()]);
    expect(runs.map((r) => r.driverId)).toEqual(['d1']);
  });

  it('ne retient qu’une course par livreur', () => {
    const runs = driverRuns(
      [brahim],
      [
        { order_id: 'o1', driver_id: 'd1' },
        { order_id: 'o2', driver_id: 'd1' },
      ],
      [commande(), commande({ id: 'o2', code: 'CMD-5678' })],
    );
    expect(runs).toHaveLength(1);
  });

  it('ignore une liaison sans livreur', () => {
    expect(driverRuns([brahim], [{ order_id: 'o1', driver_id: null }], [commande()])).toEqual([]);
  });

  it('ne rend rien quand personne n’est localisé', () => {
    expect(driverRuns([], [{ order_id: 'o1', driver_id: 'd1' }], [commande()])).toEqual([]);
  });
});
