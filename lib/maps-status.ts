// Pourquoi la vraie carte ne s'affiche pas — dit en clair, au lieu du silence.
//
// Trois écrans affichent une carte Google : le suivi du client, la course du
// livreur, le suivi des livreurs du gérant. Tous les trois retombaient sans un
// mot sur un dessin simplifié quand quelque chose clochait — clé absente, clé
// refusée, API non activée. On voyait « des points » et l'on cherchait un bug
// dans l'application, alors que la réponse était dans la console Google.
//
// Ces messages nomment la cause ET le geste qui la répare.

/** Ce que Google renvoie quand il refuse une clé, traduit et assorti du remède. */
const CAUSES: { motif: RegExp; message: string }[] = [
  {
    motif: /RefererNotAllowed/i,
    message:
      'Google refuse la clé pour ce domaine. Ajoutez-le aux référents autorisés de la clé (Google Cloud → Identifiants → votre clé → Restrictions).',
  },
  {
    motif: /ApiNotActivated|ApiTargetBlocked/i,
    message:
      'L’API « Maps JavaScript » n’est pas activée pour cette clé, ou la clé est restreinte à d’autres API. Activez Maps JavaScript, Directions et Geocoding dans Google Cloud.',
  },
  {
    motif: /BillingNotEnabled/i,
    message: 'La facturation n’est pas activée sur le projet Google Cloud. Google bloque la carte tant qu’elle ne l’est pas.',
  },
  {
    motif: /InvalidKey|MissingKeyMapError/i,
    message: 'Google ne reconnaît pas cette clé. Vérifiez qu’elle a été copiée en entier, sans espace.',
  },
  {
    motif: /ExpiredKey|OverQuota|QuotaExceeded/i,
    message: 'La clé a expiré ou son quota est atteint. Vérifiez son état dans Google Cloud.',
  },
];

/** Message à afficher quand la clé n'est pas configurée du tout. */
export const MAPS_KEY_ABSENTE =
  'Aucune clé Google Maps n’est arrivée jusqu’au navigateur. Vérifiez la variable NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, puis reconstruisez : les variables NEXT_PUBLIC_ sont figées au moment de la construction.';

/**
 * Traduit l'échec du chargement de Google Maps.
 *
 * `raw` est le message de l'erreur, ou le nom de l'erreur d'authentification
 * que Google écrit dans la console. Une cause inconnue est rendue telle quelle
 * plutôt que masquée — c'est elle qu'on cherchera dans la documentation.
 */
export function mapsErrorMessage(raw: string): string {
  for (const { motif, message } of CAUSES) {
    if (motif.test(raw)) return message;
  }
  const propre = raw.trim();
  return propre
    ? `La carte n’a pas pu se charger : ${propre}`
    : 'La carte n’a pas pu se charger. Vérifiez la clé Google Maps et ses restrictions.';
}

/** La clé est-elle réellement exploitable ? Une chaîne vide n'en est pas une. */
export function hasMapsKey(key: string | undefined | null): boolean {
  return typeof key === 'string' && key.trim().length > 0;
}
