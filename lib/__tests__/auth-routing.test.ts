import { describe, expect, it } from 'vitest';
import { hasAuthCookie, isApiPath, isPublicPath, landingPathFor, signInPathFor } from '@/lib/auth-routing';

describe('isPublicPath', () => {
  it('laisse passer les trois entrées publiques et leurs sous-chemins', () => {
    for (const p of ['/onboarding', '/auth', '/auth/admin', '/auth/livreur', '/parrain/ABC123']) {
      expect(isPublicPath(p)).toBe(true);
    }
  });

  it('garde tout le reste', () => {
    for (const p of ['/', '/admin', '/driver', '/orders', '/tracking/1']) {
      expect(isPublicPath(p)).toBe(false);
    }
  });

  it('ne se laisse pas tromper par un préfixe qui ressemble', () => {
    // « /authentique » commence par « /auth » sans être une route publique.
    expect(isPublicPath('/authentique')).toBe(false);
    expect(isPublicPath('/onboarding-bis')).toBe(false);
  });
});

describe('isApiPath', () => {
  it('reconnaît les routes d’API', () => {
    expect(isApiPath('/api')).toBe(true);
    expect(isApiPath('/api/orders')).toBe(true);
    expect(isApiPath('/api/admin/drivers')).toBe(true);
  });

  it('ne confond pas avec une page qui commence pareil', () => {
    expect(isApiPath('/apidoc')).toBe(false);
    expect(isApiPath('/')).toBe(false);
  });
});

describe('signInPathFor', () => {
  it('renvoie chaque application vers son propre écran de connexion', () => {
    expect(signInPathFor('/admin/orders')).toBe('/auth/admin');
    expect(signInPathFor('/driver/requests')).toBe('/auth/livreur');
    expect(signInPathFor('/orders')).toBe('/onboarding');
  });
});

describe('landingPathFor', () => {
  it('renvoie un utilisateur déjà connecté vers son application', () => {
    expect(landingPathFor('/auth/admin')).toBe('/admin');
    expect(landingPathFor('/auth/livreur')).toBe('/driver');
    expect(landingPathFor('/auth')).toBe('/');
    expect(landingPathFor('/onboarding')).toBe('/');
  });
});

describe('hasAuthCookie', () => {
  it('reconnaît le cookie de session Supabase', () => {
    expect(hasAuthCookie(['sb-zcpjoyizevpylukqmqmq-auth-token'])).toBe(true);
  });

  it('reconnaît un cookie découpé en morceaux', () => {
    expect(hasAuthCookie(['sb-abc-auth-token.0', 'sb-abc-auth-token.1'])).toBe(true);
  });

  it('ignore les cookies sans rapport', () => {
    expect(hasAuthCookie([])).toBe(false);
    expect(hasAuthCookie(['theme', 'lv-cart', 'sb-abc-other'])).toBe(false);
  });

  // Le point du changement : sans session, on ne paie pas l'aller-retour réseau.
  it('dit non quand aucun cookie n’est présent — c’est ce qui évite l’appel', () => {
    expect(hasAuthCookie(['_vercel_jwt', 'NEXT_LOCALE'])).toBe(false);
  });
});
