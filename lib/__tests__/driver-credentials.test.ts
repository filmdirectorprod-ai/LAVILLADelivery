import { describe, it, expect } from 'vitest';
import {
  normalizeIdentifiant,
  validateIdentifiant,
  validateDriverPassword,
  identifiantToEmail,
  loginToEmail,
  generatePassword,
  LIVREUR_EMAIL_DOMAIN,
} from '@/lib/driver-credentials';

describe('normalizeIdentifiant', () => {
  it('trims and lowercases', () => {
    expect(normalizeIdentifiant('  Karim  ')).toBe('karim');
    expect(normalizeIdentifiant(null)).toBe('');
  });
});

describe('validateIdentifiant', () => {
  it('accepts a valid identifiant', () => {
    expect(validateIdentifiant('karim')).toBeNull();
    expect(validateIdentifiant('karim.benali')).toBeNull();
    expect(validateIdentifiant('livreur_07')).toBeNull();
    expect(validateIdentifiant('Karim')).toBeNull(); // normalized
  });
  it('rejects empty', () => {
    expect(validateIdentifiant('')).toMatch(/requis/);
  });
  it('rejects too short / too long', () => {
    expect(validateIdentifiant('ab')).toMatch(/3 caractères/);
    expect(validateIdentifiant('a'.repeat(31))).toMatch(/30 caractères/);
  });
  it('rejects spaces and invalid chars', () => {
    expect(validateIdentifiant('kar im')).toMatch(/invalide/);
    expect(validateIdentifiant('karim!')).toMatch(/invalide/);
    expect(validateIdentifiant('café')).toMatch(/invalide/);
  });
  it('rejects leading/trailing punctuation', () => {
    expect(validateIdentifiant('.karim')).toMatch(/invalide/);
    expect(validateIdentifiant('karim-')).toMatch(/invalide/);
  });
});

describe('validateDriverPassword', () => {
  it('accepts ≥ 6 chars', () => {
    expect(validateDriverPassword('secret1')).toBeNull();
  });
  it('rejects empty and short', () => {
    expect(validateDriverPassword('')).toMatch(/requis/);
    expect(validateDriverPassword('abc')).toMatch(/6 caractères/);
  });
});

describe('identifiantToEmail', () => {
  it('appends the technical domain', () => {
    expect(identifiantToEmail('Karim')).toBe(`karim@${LIVREUR_EMAIL_DOMAIN}`);
  });
});

describe('loginToEmail', () => {
  it('maps a bare identifiant to the technical email', () => {
    expect(loginToEmail('karim')).toBe(`karim@${LIVREUR_EMAIL_DOMAIN}`);
  });
  it('passes a full email through (lowercased)', () => {
    expect(loginToEmail('Karim@Gmail.com')).toBe('karim@gmail.com');
  });
  it('trims whitespace', () => {
    expect(loginToEmail('  karim  ')).toBe(`karim@${LIVREUR_EMAIL_DOMAIN}`);
  });
});

describe('generatePassword', () => {
  it('produces the requested length from the safe charset', () => {
    const pw = generatePassword(12);
    expect(pw).toHaveLength(12);
    expect(pw).toMatch(/^[a-zA-Z2-9]+$/);
    expect(pw).not.toMatch(/[01lIO]/); // no ambiguous chars
  });
});
