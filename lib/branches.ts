// lib/branches.ts — La Villa's physical shops. Used for pickup ("retrait") point
// selection at checkout and for the contact/help screen. Coordinates double as the
// delivery origin (the Ville Nouvelle shop).
export interface Branch {
  id: string;
  name: string;
  address: string;
  /** Google Plus Code, when that's the most precise reference. */
  plusCode?: string;
  lat: number;
  lng: number;
}

export const LA_VILLA_BRANCHES: Branch[] = [
  {
    id: 'bahnini',
    name: 'La Villa — Ville Nouvelle',
    address: '117 Av. Mohammed Bahnini, Fès',
    lat: 34.0261,
    lng: -5.014,
  },
  {
    id: 'badie',
    name: 'La Villa Badie — Saïss',
    address: 'XXQP+WJ8, Fès (Saïss)',
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
