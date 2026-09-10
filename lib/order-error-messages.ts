// Turns place_order's developer-facing exceptions into something a customer can
// act on. Pure, no I/O — the route handler is a thin wrapper over it.
//
// place_order raises in English, for developers, and /api/orders used to hand
// `error.message` straight to the customer: a rupture de stock surfaced as
// "product Tarte au citron out of stock at branch" inside a French checkout.
// The stock case is the one a customer can actually hit — availability is
// re-checked authoritatively at order time, and the catalogue badge they tapped
// may be a few moments stale (it is served from a cached read).

export function customerMessage(raw: string): string {
  const outOfStock = /product (.+) out of stock at branch/.exec(raw);
  if (outOfStock) return `« ${outOfStock[1]} » n'est plus disponible. Retirez-le du panier pour continuer.`;
  if (raw.includes('invalid promo code')) return "Ce code promo n'est pas valide.";
  if (raw.includes('unknown product')) return "Un article du panier n'existe plus. Videz le panier et réessayez.";
  if (raw.includes('empty order')) return 'Votre panier est vide.';
  if (raw.includes('invalid mode')) return 'Mode de commande invalide.';
  if (raw.includes('forbidden')) return 'Session expirée. Reconnectez-vous puis réessayez.';
  // Anything unmapped stays as-is rather than hiding a real fault behind a
  // vague message — the server logs keep the original either way.
  return raw;
}
