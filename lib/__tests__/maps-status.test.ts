import { describe, expect, it } from 'vitest';
import { MAPS_KEY_ABSENTE, hasMapsKey, mapsErrorMessage } from '@/lib/maps-status';

describe('hasMapsKey', () => {
  it('refuse une variable absente ou vide', () => {
    expect(hasMapsKey(undefined)).toBe(false);
    expect(hasMapsKey(null)).toBe(false);
    expect(hasMapsKey('')).toBe(false);
    expect(hasMapsKey('   ')).toBe(false); // une variable définie mais blanche
  });

  it('accepte une clé réelle', () => {
    expect(hasMapsKey('AIzaSyExempleDeCleQuiRessembleAUneVraie')).toBe(true);
  });
});

describe('mapsErrorMessage', () => {
  it('nomme le domaine non autorisé et où le corriger', () => {
    const m = mapsErrorMessage('RefererNotAllowedMapError');
    expect(m).toMatch(/domaine/i);
    expect(m).toMatch(/référents autorisés/i);
  });

  it('nomme l’API non activée', () => {
    expect(mapsErrorMessage('ApiNotActivatedMapError')).toMatch(/Maps JavaScript/);
    expect(mapsErrorMessage('ApiTargetBlockedMapError')).toMatch(/Maps JavaScript/);
  });

  it('nomme la facturation, la clé invalide, le quota', () => {
    expect(mapsErrorMessage('BillingNotEnabledMapError')).toMatch(/facturation/i);
    expect(mapsErrorMessage('InvalidKeyMapError')).toMatch(/ne reconnaît pas/i);
    expect(mapsErrorMessage('OverQuotaMapError')).toMatch(/quota/i);
  });

  it('ne masque pas une cause inconnue', () => {
    expect(mapsErrorMessage('BoumInattenduMapError')).toContain('BoumInattenduMapError');
  });

  it('reste utile même sans message', () => {
    expect(mapsErrorMessage('').length).toBeGreaterThan(20);
  });
});

describe('MAPS_KEY_ABSENTE', () => {
  it('rappelle que les variables NEXT_PUBLIC_ sont figées à la construction', () => {
    expect(MAPS_KEY_ABSENTE).toMatch(/NEXT_PUBLIC_GOOGLE_MAPS_API_KEY/);
    expect(MAPS_KEY_ABSENTE).toMatch(/construction/i);
  });
});
