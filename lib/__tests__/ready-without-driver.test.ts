import { describe, expect, it } from 'vitest';
import { readyWithoutDriver } from '@/lib/admin-overview';

const BRANCHES = [
  { id: 'riad', name: 'La Villa Riad — Ville Nouvelle' },
  { id: 'badie', name: 'La Villa Badie — Aïn Chkef' },
];

describe('readyWithoutDriver', () => {
  it('signale une commande prête dont l’agence n’a aucun livreur en ligne', () => {
    const out = readyWithoutDriver(
      [{ status: 'ready', branch_id: 'badie' }],
      [{ is_online: true, branch_id: 'riad' }],
      BRANCHES,
    );
    expect(out).toEqual([{ branchId: 'badie', branchName: 'La Villa Badie — Aïn Chkef', count: 1 }]);
  });

  it('ne signale rien quand l’agence a un livreur en ligne', () => {
    const out = readyWithoutDriver(
      [{ status: 'ready', branch_id: 'riad' }],
      [{ is_online: true, branch_id: 'riad' }],
      BRANCHES,
    );
    expect(out).toEqual([]);
  });

  it('ignore un livreur hors ligne : il ne peut rien prendre', () => {
    const out = readyWithoutDriver(
      [{ status: 'ready', branch_id: 'riad' }],
      [{ is_online: false, branch_id: 'riad' }],
      BRANCHES,
    );
    expect(out[0]).toMatchObject({ branchId: 'riad', count: 1 });
  });

  it('ignore les courses déjà parties', () => {
    const out = readyWithoutDriver(
      [
        { status: 'en_route', branch_id: 'badie' },
        { status: 'preparing', branch_id: 'badie' },
        { status: 'delivered', branch_id: 'badie' },
      ],
      [],
      BRANCHES,
    );
    expect(out).toEqual([]);
  });

  it('compte et groupe par agence, la plus touchée en tête', () => {
    const out = readyWithoutDriver(
      [
        { status: 'ready', branch_id: 'badie' },
        { status: 'ready', branch_id: 'badie' },
        { status: 'ready', branch_id: 'riad' },
      ],
      [],
      BRANCHES,
    );
    expect(out).toEqual([
      { branchId: 'badie', branchName: 'La Villa Badie — Aïn Chkef', count: 2 },
      { branchId: 'riad', branchName: 'La Villa Riad — Ville Nouvelle', count: 1 },
    ]);
  });

  it('une commande sans agence passe dès qu’un livreur est en ligne', () => {
    expect(
      readyWithoutDriver([{ status: 'ready', branch_id: null }], [{ is_online: true, branch_id: 'riad' }], BRANCHES),
    ).toEqual([]);
    expect(
      readyWithoutDriver([{ status: 'ready', branch_id: null }], [{ is_online: false, branch_id: 'riad' }], BRANCHES),
    ).toEqual([{ branchId: null, branchName: 'Sans agence', count: 1 }]);
  });

  it('nomme prudemment une agence inconnue plutôt que d’afficher un identifiant', () => {
    const out = readyWithoutDriver([{ status: 'ready', branch_id: 'zzz' }], [], BRANCHES);
    expect(out[0].branchName).toBe('Agence inconnue');
  });
});
