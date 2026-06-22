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
  lat: number;
  lng: number;
}

export const LA_VILLA_BRANCHES: Branch[] = [
  {
    id: 'riad',
    name: 'La Villa Riad — Ville Nouvelle',
    address: '117 Av. Mohammed Bahnini, Fès',
    phone: '05 35 60 44 66',
    lat: 34.0261,
    lng: -5.014,
  },
  {
    id: 'badie',
    name: 'La Villa Badie — Aïn Chkef',
    address: 'Rocade Sud, Jardin Al Badie, Lotissement, Aïn Chkef, Fès 30000',
    phone: '05 35 69 15 61',
    plusCode: 'XXQP+WJ8',
    lat: 33.9898,
    lng: -5.0134,
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

/** Google Maps link to a shop. Prefer the Plus Code when we have one (it's the
 *  authoritative address — Google resolves it to the exact point); otherwise fall
 *  back to the stored coordinates. */
export function branchMapsUrl(b: Branch): string {
  if (b.plusCode) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.plusCode} Fès, Maroc`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`;
}

/** tel: href for a shop's phone (digits only). */
export function branchTelHref(b: Branch): string {
  return `tel:${b.phone.replace(/[^0-9+]/g, '')}`;
}
