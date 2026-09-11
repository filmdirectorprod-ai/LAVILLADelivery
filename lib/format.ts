// Currency + number formatting for La Villa (French / Moroccan Dirham).
// Ported verbatim from the prototype `formatDH` (data.jsx).

/** Format an amount in DH with French comma-decimal: 165 -> "165,00 DH". */
export const formatDH = (n: number): string =>
  n.toFixed(2).replace('.', ',') + ' DH';

/** Whole-dirham figure for large stats, French digit grouping: 12345.6 -> "12 346". */
export const formatAmount = (n: number): string =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n));
