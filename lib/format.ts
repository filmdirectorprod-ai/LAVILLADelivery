// Currency + number formatting for La Villa (French / Moroccan Dirham).
// Ported verbatim from the prototype `formatDH` (data.jsx).

/** Format an amount in DH with French comma-decimal: 165 -> "165,00 DH". */
export const formatDH = (n: number): string =>
  n.toFixed(2).replace('.', ',') + ' DH';
