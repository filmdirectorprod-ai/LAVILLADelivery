'use client';
// Filtre les événements order_tracking qui ne sont qu'un déplacement GPS.
//
// Pendant une livraison, l'application livreur écrit sa position dans
// order_tracking toutes les 4 secondes. Les écrans admin abonnés à cette table
// rechargeaient donc leur tableau entier — 200 commandes et leurs lignes — au
// même rythme, pour un point de carte qu'ils n'affichent même pas. Sur une
// soirée à cinq livreurs, cela faisait plus de 4 000 rechargements complets.
//
// Supabase n'envoie pas l'ancienne version de la ligne (sauf REPLICA IDENTITY
// FULL), on ne peut donc pas comparer avant / après côté serveur. Cette porte
// retient l'empreinte MÉTIER de chaque ligne déjà vue — le livreur, la prise en
// charge, l'étape, l'heure annoncée — et ne laisse passer que ce qui la change.
// La position, elle, ne fait pas partie de l'empreinte.
//
// Les écrans qui affichent vraiment la position (la carte de la Vue d'ensemble)
// n'utilisent pas cette porte : ils s'abonnent à part, avec une requête légère.
import type { RealtimeChangePayload } from '@/lib/use-realtime';

interface TrackingRow {
  order_id?: unknown;
  driver_id?: unknown;
  manual?: unknown;
  stage?: unknown;
  eta_at?: unknown;
}

/**
 * Renvoie un prédicat à appeler avec la charge utile Realtime. `true` = quelque
 * chose de significatif a changé, il faut recharger.
 *
 * Un état par porte : créez-la une fois par écran (useMemo/useRef), pas à
 * chaque rendu.
 */
export function createTrackingGate(): (payload: RealtimeChangePayload) => boolean {
  const seen = new Map<string, string>();

  return (payload) => {
    // Suppression, ou forme inattendue : on ne prend pas le risque de rater un
    // changement réel.
    if (payload.eventType === 'DELETE') return true;
    const row = payload.new as TrackingRow | undefined;
    const orderId = row?.order_id;
    if (typeof orderId !== 'string') return true;

    const signature = [row?.driver_id, row?.manual, row?.stage, row?.eta_at]
      .map((v) => (v == null ? '' : String(v)))
      .join('|');

    const previous = seen.get(orderId);
    seen.set(orderId, signature);
    // Première vue de cette commande : on recharge, on ne sait pas ce qu'on a manqué.
    return previous === undefined || previous !== signature;
  };
}
