import { describe, expect, it } from 'vitest';
import { staffMessage } from '@/lib/order-error-messages';

// Les chaînes testées ici sont celles que lèvent réellement les fonctions SQL
// de l'admin (0015, 0021, 0024) — relevées dans les migrations, pas inventées.
describe('staffMessage', () => {
  it('explique une session expirée plutôt qu’un code', () => {
    expect(staffMessage('forbidden')).toMatch(/session a expiré/i);
    expect(staffMessage('permission denied for table orders')).toMatch(/session a expiré/i);
  });

  it('dit qu’un autre écran est passé avant, au lieu de « not_pending »', () => {
    expect(staffMessage('not_pending')).toMatch(/déjà confirmée/i);
  });

  it('couvre les autres gardes d’état', () => {
    expect(staffMessage('not_ready')).toMatch(/pas encore prête/i);
    expect(staffMessage('not_preparing')).toMatch(/plus en préparation/i);
    expect(staffMessage('not_cancellable')).toMatch(/trop tard/i);
    expect(staffMessage('invalid status foo')).toMatch(/pas possible/i);
    expect(staffMessage('invalid stage 7')).toMatch(/pas possible/i);
  });

  it('couvre les cas livreur et commande', () => {
    expect(staffMessage('not_found')).toMatch(/introuvable/i);
    expect(staffMessage('unknown order')).toMatch(/introuvable/i);
    expect(staffMessage('unknown driver')).toMatch(/n’existe plus/i);
    expect(staffMessage('unavailable')).toMatch(/pas disponible/i);
  });

  it('reconnaît une coupure réseau', () => {
    expect(staffMessage('TypeError: Failed to fetch')).toMatch(/connexion perdue/i);
  });

  it('ne masque jamais une panne inconnue derrière une phrase vague', () => {
    const brut = 'duplicate key value violates unique constraint "orders_code_key"';
    expect(staffMessage(brut)).toContain(brut);
  });

  it('ne rend jamais un message vide', () => {
    for (const raw of ['forbidden', 'not_ready', 'boum', '']) {
      expect(staffMessage(raw).length).toBeGreaterThan(0);
    }
  });
});
