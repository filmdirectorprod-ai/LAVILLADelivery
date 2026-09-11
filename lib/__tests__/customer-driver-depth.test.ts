// Calculs derrière les améliorations client / livreur : arrivée mesurée depuis
// la position réelle, itinéraire, et créneaux de commande à l'heure de Fès.
import { describe, it, expect } from 'vitest';
import { CITY_SPEED_KMH, directionsUrl, distanceKm, liveEta, minutesFor, minutesUntil } from '@/lib/eta';
import { isSameBusinessDay, isScheduledLater, nextSlotInstant, slotLabel, slotOptions, slotShortLabel } from '@/lib/checkout-slots';

describe('eta', () => {
  const villa = { lat: 34.0261, lng: -5.0139 }; // La Villa Riad, Fès
  const client = { lat: 34.0389, lng: -4.9986 }; // ~2 km au nord-est

  it('mesure une distance plausible entre deux points de Fès', () => {
    const km = distanceKm(villa, client);
    expect(km).toBeGreaterThan(1.5);
    expect(km).toBeLessThan(2.5);
    expect(distanceKm(villa, villa)).toBe(0);
  });

  it('convertit la distance en minutes, remise comprise', () => {
    expect(minutesFor(0)).toBe(1);
    expect(minutesFor(6, CITY_SPEED_KMH)).toBe(22); // 6 km à 18 km/h = 20 min + 2
  });

  it('mesure quand les deux positions existent, sinon retombe sur l’estimation', () => {
    const real = liveEta(villa, client, 28);
    expect(real).toMatchObject({ real: true });
    expect(real!.km).toBeGreaterThan(1.5);

    expect(liveEta(null, client, 28)).toEqual({ km: 0, minutes: 28, real: false });
    expect(liveEta(null, null, null)).toBeNull();
  });

  it('compte les minutes restantes avant une heure', () => {
    const now = new Date('2026-09-11T12:00:00Z');
    expect(minutesUntil('2026-09-11T12:25:00Z', now)).toBe(25);
    expect(minutesUntil('2026-09-11T11:00:00Z', now)).toBe(0);
    expect(minutesUntil(null, now)).toBeNull();
  });

  it('construit un itinéraire avec les coordonnées, sinon avec l’adresse', () => {
    expect(directionsUrl(client, null)).toContain('destination=34.0389%2C-4.9986');
    expect(directionsUrl(null, '12 derb Sidi Ahmed, Fès')).toContain('derb%20Sidi%20Ahmed');
  });
});

describe('créneaux', () => {
  // 09:00 UTC = 10:00 à Fès (UTC+1).
  const morning = new Date('2026-09-11T09:00:00Z');
  // 13:00 UTC = 14:00 à Fès : midi est passé.
  const afternoon = new Date('2026-09-11T13:00:00Z');

  it('vise la prochaine occurrence de l’heure, à Fès', () => {
    expect(nextSlotInstant('lunch', morning).toISOString()).toBe('2026-09-11T11:30:00.000Z');
    expect(nextSlotInstant('eve', morning).toISOString()).toBe('2026-09-11T18:00:00.000Z');
    // Midi est passé → le créneau bascule au lendemain.
    expect(nextSlotInstant('lunch', afternoon).toISOString()).toBe('2026-09-12T11:30:00.000Z');
  });

  it('propose trois choix, avec le bon jour', () => {
    const opts = slotOptions(morning, 25);
    expect(opts.map((o) => o.id)).toEqual(['asap', 'lunch', 'eve']);
    expect(opts[0]).toMatchObject({ at: null, hint: '~25 min' });
    expect(opts[1].hint).toBe("Aujourd'hui");
    expect(slotLabel(opts[1])).toBe("Aujourd'hui 12:30");
    expect(slotLabel(opts[0])).toBeNull();

    const later = slotOptions(afternoon, 25);
    expect(later[1].hint).toBe('Demain');
  });

  it('sait si deux instants tombent le même jour à Fès', () => {
    // 23:30 à Fès le 11 = 22:30 UTC ; 00:30 le 12 à Fès = 23:30 UTC le 11.
    expect(isSameBusinessDay(new Date('2026-09-11T22:30:00Z'), morning)).toBe(true);
    expect(isSameBusinessDay(new Date('2026-09-11T23:30:00Z'), morning)).toBe(false);
  });

  it('retient une commande programmée loin de son heure', () => {
    const now = new Date('2026-09-11T09:00:00Z');
    expect(isScheduledLater('2026-09-11T11:30:00Z', now)).toBe(true); // dans 2 h 30
    expect(isScheduledLater('2026-09-11T09:20:00Z', now)).toBe(false); // dans 20 min
    expect(isScheduledLater(null, now)).toBe(false);
  });

  it('résume le créneau à côté du code de commande', () => {
    const now = new Date('2026-09-11T09:00:00Z');
    expect(slotShortLabel('2026-09-11T11:30:00Z', now)).toBe('pour 12:30');
    expect(slotShortLabel('2026-09-12T18:00:00Z', now)).toBe('pour demain 19:00');
    expect(slotShortLabel(null, now)).toBeNull();
  });
});
