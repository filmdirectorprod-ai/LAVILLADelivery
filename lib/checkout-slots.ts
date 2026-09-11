// lib/checkout-slots.ts — Les créneaux proposés au paiement.
//
// L'écran offrait « Au plus vite / 12:30 / 19:00 » mais n'envoyait rien : une
// commande pour 19:00 partait en cuisine immédiatement. Ici, chaque créneau
// devient un instant réel, calculé à l'heure de Fès (lib/timezone), que la
// commande transporte (slot_at) et que la cuisine peut respecter. Pur, testable.

import { BUSINESS_TZ, zoneOffsetMs } from '@/lib/timezone';

export type SlotId = 'asap' | 'lunch' | 'eve';

/** Heures d'ouverture proposées, en heure de Fès. */
export const SLOT_HOURS: Record<Exclude<SlotId, 'asap'>, { h: number; m: number }> = {
  lunch: { h: 12, m: 30 },
  eve: { h: 19, m: 0 },
};

/** Marge sous laquelle un créneau du jour est déjà trop proche : on bascule à demain. */
export const SLOT_MIN_LEAD_MIN = 30;

/** Une commande programmée n'entre en cuisine que ce nombre de minutes avant l'heure. */
export const KITCHEN_LEAD_MIN = 45;

export interface SlotChoice {
  id: SlotId;
  /** Libellé court du bouton. */
  label: string;
  /** Deuxième ligne : « Aujourd'hui », « Demain », ou le délai. */
  hint: string;
  /** Instant visé, ou null pour « au plus vite ». */
  at: Date | null;
}

/** Parties de date (année, mois, jour, heure, minute) lues à l'heure de Fès. */
function wallParts(at: Date, tz: string) {
  const wall = new Date(at.getTime() + zoneOffsetMs(at, tz));
  return {
    y: wall.getUTCFullYear(),
    mo: wall.getUTCMonth(),
    d: wall.getUTCDate(),
    h: wall.getUTCHours(),
    mi: wall.getUTCMinutes(),
  };
}

/** L'instant où l'horloge de Fès affichera h:m, aujourd'hui ou demain. */
export function nextSlotInstant(id: Exclude<SlotId, 'asap'>, now: Date = new Date(), tz: string = BUSINESS_TZ): Date {
  const { h, m } = SLOT_HOURS[id];
  const p = wallParts(now, tz);
  const offset = zoneOffsetMs(now, tz);
  let target = Date.UTC(p.y, p.mo, p.d, h, m) - offset;
  if (target - now.getTime() < SLOT_MIN_LEAD_MIN * 60000) {
    target = Date.UTC(p.y, p.mo, p.d + 1, h, m) - offset;
  }
  // Un changement d'heure entre-temps (Ramadan au Maroc) déplace l'instant.
  const offsetThen = zoneOffsetMs(new Date(target), tz);
  return new Date(offsetThen === offset ? target : target + offset - offsetThen);
}

/** Est-ce que `at` tombe le même jour (heure de Fès) que `now` ? */
export function isSameBusinessDay(at: Date, now: Date = new Date(), tz: string = BUSINESS_TZ): boolean {
  const a = wallParts(at, tz);
  const b = wallParts(now, tz);
  return a.y === b.y && a.mo === b.mo && a.d === b.d;
}

/** Les trois choix affichés au paiement. `etaMinutes` sert au libellé d'« au plus vite ». */
export function slotOptions(now: Date = new Date(), etaMinutes = 30, tz: string = BUSINESS_TZ): SlotChoice[] {
  const lunch = nextSlotInstant('lunch', now, tz);
  const eve = nextSlotInstant('eve', now, tz);
  const day = (at: Date) => (isSameBusinessDay(at, now, tz) ? "Aujourd'hui" : 'Demain');
  return [
    { id: 'asap', label: 'Au plus vite', hint: `~${etaMinutes} min`, at: null },
    { id: 'lunch', label: '12:30', hint: day(lunch), at: lunch },
    { id: 'eve', label: '19:00', hint: day(eve), at: eve },
  ];
}

/** Ce qu'on écrit sur la commande : « Aujourd'hui 12:30 », « Demain 19:00 ». */
export function slotLabel(choice: SlotChoice): string | null {
  if (!choice.at) return null;
  return `${choice.hint} ${choice.label}`;
}

/** Une commande programmée dont l'heure n'approche pas encore : la cuisine attend. */
export function isScheduledLater(slotAt: string | null | undefined, now: Date = new Date(), leadMin = KITCHEN_LEAD_MIN): boolean {
  if (!slotAt) return false;
  const t = Date.parse(slotAt);
  if (Number.isNaN(t)) return false;
  return t - now.getTime() > leadMin * 60000;
}

/** « pour 19:00 » / « pour demain 12:30 » — à côté du code de commande. */
export function slotShortLabel(slotAt: string | null | undefined, now: Date = new Date(), tz: string = BUSINESS_TZ): string | null {
  if (!slotAt) return null;
  const t = Date.parse(slotAt);
  if (Number.isNaN(t)) return null;
  const at = new Date(t);
  const hhmm = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(at);
  return isSameBusinessDay(at, now, tz) ? `pour ${hhmm}` : `pour demain ${hhmm}`;
}
