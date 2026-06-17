// lib/driver-credentials.ts — Pure helpers for driver account provisioning.
// Drivers sign in with a simple identifiant (e.g. "karim"); internally that maps
// to a technical auth email <identifiant>@livreur.lavilla.ma. No I/O here so the
// rules are shared by the admin form, the API route and the driver login, and
// stay unit-testable.

/** Technical email domain backing every driver identifiant. */
export const LIVREUR_EMAIL_DOMAIN = 'livreur.lavilla.ma';

/** Lowercase + trim an identifiant to its canonical form. */
export function normalizeIdentifiant(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

/**
 * Validate an admin-chosen driver identifiant. Returns a French error message,
 * or null when valid. Rules: 3–30 chars, lowercase letters/digits plus . _ -,
 * and must start and end with a letter or digit.
 */
export function validateIdentifiant(raw: string | null | undefined): string | null {
  const id = normalizeIdentifiant(raw);
  if (!id) return "L'identifiant est requis.";
  if (id.length < 3) return "L'identifiant doit faire au moins 3 caractères.";
  if (id.length > 30) return "L'identifiant ne doit pas dépasser 30 caractères.";
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(id)) {
    return 'Identifiant invalide : lettres, chiffres, point, tiret ou underscore (sans espace).';
  }
  return null;
}

/** Validate a driver password. Returns a French error message, or null. */
export function validateDriverPassword(pw: string | null | undefined): string | null {
  if (!pw) return 'Le mot de passe est requis.';
  if (pw.length < 6) return 'Le mot de passe doit faire au moins 6 caractères.';
  return null;
}

/** Build the technical auth email for an admin-chosen identifiant. */
export function identifiantToEmail(raw: string | null | undefined): string {
  return `${normalizeIdentifiant(raw)}@${LIVREUR_EMAIL_DOMAIN}`;
}

/**
 * Resolve a driver login input to the auth email: a bare identifiant gets the
 * technical domain appended; a full e-mail (contains "@") is used as-is. This
 * keeps the login screen friendly while staying backward compatible.
 */
export function loginToEmail(raw: string | null | undefined): string {
  const v = (raw ?? '').trim();
  if (v.includes('@')) return v.toLowerCase();
  return identifiantToEmail(v);
}

/** Generate a readable strong password (no ambiguous chars like 0/O, 1/l/I). */
export function generatePassword(len = 10): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const buf =
    typeof crypto !== 'undefined' && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint32Array(len))
      : Array.from({ length: len }, () => Math.floor(Math.random() * 0xffffffff));
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}
