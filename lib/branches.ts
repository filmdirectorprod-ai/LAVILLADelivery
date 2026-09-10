// lib/branches.ts — La Villa's physical shops. Used for pickup ("retrait") point
// selection at checkout and for the contact/help screen. Coordinates double as the
// delivery origin (the Ville Nouvelle shop).
export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  /** Google Plus Code, when that's the most precise reference. */
  plusCode?: string;
  /** Google Maps place id — opens the exact business listing. */
  placeId?: string;
  lat: number;
  lng: number;
}

export const LA_VILLA_BRANCHES: Branch[] = [
  {
    id: 'riad',
    name: 'La Villa Riad — Ville Nouvelle',
    address: '117 Av. Mohammed Bahnini, Fès',
    phone: '05 35 60 44 66',
    placeId: 'ChIJK3tB3x6Lnw0R81mMhdl8gek',
    lat: 34.0260997,
    lng: -5.0139426,
  },
  {
    id: 'badie',
    name: 'La Villa Badie — Aïn Chkef',
    address: 'Rocade Sud, Jardin Al Badie, Lotissement, Aïn Chkef, Fès 30000',
    phone: '05 35 69 15 61',
    plusCode: 'XXQP+WJ8',
    placeId: 'ChIJjRfUfgCLnw0RrVm57kvbQM0',
    lat: 33.9890278,
    lng: -5.0132778,
  },
];

/** Default shop (delivery origin + pre-selected pickup point). */
export const DEFAULT_BRANCH = LA_VILLA_BRANCHES[0];

export function findBranch(id: string | null | undefined): Branch {
  return LA_VILLA_BRANCHES.find((b) => b.id === id) ?? DEFAULT_BRANCH;
}

/** One-line address stored on a pickup order. */
export function branchPickupLabel(b: Branch): string {
  return `Retrait boutique — ${b.name}, ${b.address}`;
}

/** Google Maps link to a shop. Best: open the exact Google business listing via
 *  its place id (the `query` text is the required fallback). Otherwise drop a pin
 *  on the precise coordinates. */
export function branchMapsUrl(b: Branch): string {
  if (b.placeId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.name)}&query_place_id=${b.placeId}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`;
}

/** tel: href for a shop's phone (digits only). */
export function branchTelHref(b: Branch): string {
  return `tel:${b.phone.replace(/[^0-9+]/g, '')}`;
}
