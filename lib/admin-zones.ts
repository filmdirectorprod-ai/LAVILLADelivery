// Pure, side-effect-free helpers for the admin Zones de livraison screen. Sorting
// and draft validation live here — the validation mirrors the admin_upsert_zone
// RPC (0017) so the form can gate its submit button with the same rules the server
// enforces. No React, no I/O.

import type { Zone } from '@/lib/types';

/** Zones ordered by delivery fee (cheapest first), then name. */
export function sortZones(zones: Zone[]): Zone[] {
  return [...zones].sort((a, b) => {
    if (a.fee_dh !== b.fee_dh) return a.fee_dh - b.fee_dh;
    return a.name.localeCompare(b.name);
  });
}

export interface ZoneDraft {
  name: string;
  fee_dh: number;
  eta_min: number;
  eta_max: number;
}

export interface ZoneValidation {
  ok: boolean;
  /** A French error message when invalid; undefined when ok. */
  error?: string;
}

/** Validate a zone draft with the same rules as admin_upsert_zone (0017). */
export function validateZoneDraft(draft: ZoneDraft): ZoneValidation {
  if (draft.name.trim() === '') return { ok: false, error: 'Le nom est requis.' };
  if (!Number.isFinite(draft.fee_dh) || draft.fee_dh < 0) {
    return { ok: false, error: 'Les frais doivent être positifs.' };
  }
  if (!Number.isFinite(draft.eta_min) || !Number.isFinite(draft.eta_max) || draft.eta_min < 0) {
    return { ok: false, error: 'Les délais doivent être positifs.' };
  }
  if (draft.eta_max < draft.eta_min) {
    return { ok: false, error: 'Le délai max doit être ≥ au délai min.' };
  }
  return { ok: true };
}
