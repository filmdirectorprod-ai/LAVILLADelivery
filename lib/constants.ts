// Catalog metadata ported verbatim from the prototype (data.jsx).

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
