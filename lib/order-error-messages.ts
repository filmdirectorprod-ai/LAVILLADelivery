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
  if (raw.includes('invalid slot')) return "Ce créneau n'est plus disponible. Choisissez-en un autre.";
  if (raw.includes('invalid payment')) return 'Moyen de paiement invalide.';
  // Côté livreur (0054) : la course se clôt avec le code du client ou une photo.
  if (raw.includes('bad delivery code')) return 'Code incorrect. Demandez au client le code affiché sur son suivi, ou prenez une photo du dépôt.';
  if (raw.includes('forbidden')) return 'Session expirée. Reconnectez-vous puis réessayez.';
  // Anything unmapped stays as-is rather than hiding a real fault behind a
  // vague message — the server logs keep the original either way.
  return raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les mêmes exceptions, mais pour un gérant.
//
// Les écrans de l'admin lançaient leurs RPC sans jamais regarder l'erreur :
// « Marquer prête », « Confirmer », « Annuler », « Assigner un livreur »
// pouvaient ne rien faire, et l'écran se rechargeait comme si tout s'était bien
// passé. Le gérant croyait la commande partie ; le livreur, lui, ne voyait
// jamais rien arriver.
//
// Les gardes de statut (not_pending, not_ready…) ne sont pas des pannes : elles
// signifient presque toujours que quelqu'un d'autre a agi entre-temps, sur un
// autre écran. Elles méritent donc un message qui dit quoi faire, pas un code.

export function staffMessage(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('forbidden') || r.includes('permission denied')) {
    return 'Action refusée : votre session a expiré, ou ce compte n’a pas les droits. Reconnectez-vous.';
  }
  if (r.includes('not_found') || r.includes('unknown order')) {
    return 'Commande introuvable — elle vient peut-être d’être supprimée.';
  }
  if (r.includes('unknown driver')) return 'Ce livreur n’existe plus.';
  if (r.includes('unavailable')) return 'Ce livreur n’est pas disponible.';
  if (r.includes('not_pending')) return 'Déjà confirmée : quelqu’un est passé avant vous.';
  if (r.includes('not_preparing')) return 'Cette commande n’est plus en préparation. Rafraîchissez l’écran.';
  if (r.includes('not_ready')) return 'Cette commande n’est pas encore prête.';
  if (r.includes('not_cancellable')) return 'Trop tard pour annuler : la course est déjà partie.';
  if (r.includes('invalid status') || r.includes('invalid stage')) {
    return 'Ce changement d’état n’est pas possible depuis l’étape actuelle.';
  }
  if (r.includes('failed to fetch') || r.includes('networkerror')) {
    return 'Connexion perdue. Vérifiez le réseau, puis réessayez.';
  }
  // Rien de reconnu : on montre le message brut plutôt que de masquer une vraie
  // panne derrière une phrase vague.
  return `L’action a échoué : ${raw}`;
}
