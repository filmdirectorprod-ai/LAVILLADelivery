'use client';
// Rafraîchissement léger d'un écran rendu par le serveur.
//
// Certains écrans affichent des données que les DEUX autres applications font
// bouger (l'historique du client : la cuisine passe « prête », le gérant annule,
// le livreur livre). Ouvrir un canal Realtime pour cela ferait entrer tout
// supabase-js (~60 ko) dans le bundle d'une simple liste. Ce hook obtient le
// même résultat ressenti pour zéro kilo-octet : il redemande la page au serveur
// quand l'écran redevient visible — le moment où l'utilisateur regarde — et,
// tant qu'il reste ouvert, à intervalle lent.
//
// Les écrans réellement temps réel (suivi de commande, course du livreur,
// tableaux de l'admin) gardent useRealtime : là, la seconde compte.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * @param enabled   false pour ne rien faire (rien d'actif à surveiller)
 * @param intervalMs 0 pour ne rafraîchir qu'au retour sur l'écran
 */
export function useLiveRefresh(enabled = true, intervalMs = 30000): void {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    // Onglet caché : on ne consomme ni réseau ni batterie.
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };

    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);

    let timer: ReturnType<typeof setInterval> | null = null;
    if (intervalMs > 0) timer = setInterval(refreshIfVisible, intervalMs);

    return () => {
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      if (timer) clearInterval(timer);
    };
  }, [enabled, intervalMs, router]);
}
