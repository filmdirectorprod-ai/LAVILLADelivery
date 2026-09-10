import { describe, it, expect } from 'vitest';
import { branchActivity, lastSeenLabel, credentialsText } from '@/lib/admin-managers';

describe('admin-managers', () => {
  it('additionne l’activité du jour par agence, hors annulations', () => {
    expect(
      branchActivity([
        { branch_id: 'b1', status: 'delivered', total_dh: 100 },
        { branch_id: 'b1', status: 'cancelled', total_dh: 999 },
        { branch_id: null, status: 'en_route', total_dh: 20 },
      ]),
    ).toEqual({ b1: { orders: 1, revenue: 100 }, none: { orders: 1, revenue: 20 } });
  });

  it('formule la dernière connexion', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
    expect(lastSeenLabel(null, now)).toBe('Jamais connecté');
    expect(lastSeenLabel(ago(30_000), now)).toBe("À l'instant");
    expect(lastSeenLabel(ago(5 * 60_000), now)).toBe('Il y a 5 min');
    expect(lastSeenLabel(ago(3 * 3_600_000), now)).toBe('Il y a 3 h');
    expect(lastSeenLabel(ago(2 * 86_400_000), now)).toBe('Il y a 2 j');
    expect(lastSeenLabel(ago(30 * 86_400_000), now)).toBe('le 16 mai 2026');
  });

  it('prépare le texte des identifiants', () => {
    expect(credentialsText('gerant.badie@gerant.lavilla.ma', 'abc')).toBe('Identifiant : gerant.badie@gerant.lavilla.ma\nMot de passe : abc');
  });
});
