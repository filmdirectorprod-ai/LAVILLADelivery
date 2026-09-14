// Fusion d'un fil de discussion venu de plusieurs sources.
//
// Les quatre fils du projet — client ↔ livreur, livreur ↔ gérant — n'affichaient
// un message que lorsque Supabase Realtime le leur renvoyait. Un fil de
// discussion ne peut pas dépendre de ça : le 14 septembre, un client a appuyé
// SEPT fois sur la même réponse rapide en sept secondes parce que rien
// n'apparaissait. Les sept messages étaient bien partis.
//
// Un fil se remplit désormais de trois côtés : la ligne renvoyée par l'envoi
// (affichage immédiat), les événements temps réel, et une relecture régulière
// tant que l'écran est ouvert. Les trois peuvent livrer le même message — d'où
// cette fusion.

export interface MessageLike {
  id: string;
  created_at: string;
}

/**
 * Réunit deux listes de messages sans doublon, du plus ancien au plus récent.
 *
 * L'identifiant fait foi : c'est celui de la base, y compris pour le message
 * qu'on vient d'envoyer, puisqu'on affiche la ligne telle que la base l'a
 * écrite. Un message déjà connu est remplacé par sa version la plus récente —
 * la relecture fait ainsi autorité sur l'affichage optimiste.
 */
export function mergeMessages<T extends MessageLike>(existants: T[], nouveaux: T[]): T[] {
  if (nouveaux.length === 0) return existants;

  const parId = new Map<string, T>();
  for (const m of existants) parId.set(m.id, m);
  for (const m of nouveaux) parId.set(m.id, m);

  return Array.from(parId.values()).sort((a, b) => {
    const ta = Date.parse(a.created_at);
    const tb = Date.parse(b.created_at);
    // Deux messages à la même milliseconde : l'identifiant tranche, pour que
    // l'ordre reste le même d'un rendu à l'autre.
    if (ta === tb || Number.isNaN(ta) || Number.isNaN(tb)) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    return ta - tb;
  });
}
