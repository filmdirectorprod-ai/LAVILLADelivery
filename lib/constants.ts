// Catalog metadata ported verbatim from the prototype (data.jsx).
import type { LoyaltyTier } from '@/lib/types';

/** Tags that render with the gold "premium" treatment. */
export const GOLD_TAGS = ['Chef', 'Édition limitée', 'Ramadan'];

/** Cake size options for customizable patisserie (price multiplier). */
export const CAKE_SIZES = [
  { id: 'ind', label: 'Individuel', parts: '1 part', mult: 0.25 },
  { id: '4-6', label: '4 – 6 pers.', parts: '6 parts', mult: 1 },
  { id: '8-10', label: '8 – 10 pers.', parts: '10 parts', mult: 1.6 },
];

export const CAKE_FLAVORS = [
  'Vanille',
  'Chocolat',
  'Pistache',
  'Fruits rouges',
  'Caramel',
];

/** 5-step delivery tracking timeline. */
export const TRACK_STEPS = [
  { id: 1, label: 'Commande confirmée', sub: 'Reçue à 13:20' },
  { id: 2, label: 'En préparation', sub: "Nos chefs s'en occupent" },
  { id: 3, label: 'Récupérée par le livreur', sub: 'Karim a votre commande' },
  { id: 4, label: 'En route', sub: 'Arrive vers 13:32' },
  { id: 5, label: 'Livrée', sub: 'Bon appétit !' },
];

/** Loyalty STATUS tiers (thresholds in lifetime points). Mirrors LoyaltyTier. */
export interface LoyaltyTierMeta {
  label: LoyaltyTier;
  min: number;
  perk: string;
  color: string;
}

export const LOYALTY_TIERS: LoyaltyTierMeta[] = [
  { label: 'Gourmand', min: 0, perk: '1 pt / DH', color: '#B07D4A' },
  { label: 'Connaisseur', min: 500, perk: 'Livraison -50 %', color: '#9AA1A3' },
  { label: 'Gourmet', min: 1000, perk: 'Livraison offerte', color: '#A89723' },
  { label: 'Cercle Villa', min: 1500, perk: 'Cadeau chef mensuel', color: '#137C8B' },
];

/** Highest tier whose threshold `points` has reached. */
export function tierFor(points: number): LoyaltyTierMeta {
  let t = LOYALTY_TIERS[0];
  for (const x of LOYALTY_TIERS) if (points >= x.min) t = x;
  return t;
}

/** Next tier above `points`, or null if already at the top. */
export function nextTierFor(points: number): LoyaltyTierMeta | null {
  return LOYALTY_TIERS.find((x) => x.min > points) ?? null;
}

/** Per-tier benefits shown on the loyalty screen. */
export const LOYALTY_BENEFITS: { tier: LoyaltyTier; icon: string; label: string }[] = [
  { tier: 'Connaisseur', icon: 'scooter', label: 'Frais de livraison réduits de 50 %' },
  { tier: 'Gourmet', icon: 'scooter', label: 'Livraison toujours offerte' },
  { tier: 'Gourmet', icon: 'gift', label: 'Pâtisserie offerte le jour de votre anniversaire' },
  { tier: 'Cercle Villa', icon: 'star', label: 'Accès prioritaire aux éditions limitées' },
  { tier: 'Cercle Villa', icon: 'gift', label: 'Création du chef offerte chaque mois' },
];

/** Redemption paliers (points → direct discount) shown on loyalty + checkout. */
export const REDEEM_OPTIONS: { pts: number; dh: number; label: string; best?: boolean; popular?: boolean }[] = [
  { pts: 100, dh: 10, label: '-10 DH' },
  { pts: 250, dh: 25, label: '-25 DH' },
  { pts: 500, dh: 60, label: '-60 DH', popular: true },
  { pts: 1000, dh: 130, label: '-130 DH', best: true },
];

/** Review criteria chips. */
export const REVIEW_TAGS = [
  'Fraîcheur',
  'Présentation',
  'Goût',
  'Livraison rapide',
  'Bon rapport qualité-prix',
  'Emballage soigné',
];

/** Points awarded for leaving a review. */
export const REVIEW_POINTS = 50;
