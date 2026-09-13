// Les décisions d'aiguillage du middleware, isolées et pures.
//
// Le middleware s'exécute à CHAQUE requête des trois applications : c'est le
// seul endroit du projet où quelques millisecondes se paient partout à la fois.
// Le sortir de la logique métier permet de l'éprouver par des tests plutôt que
// par des allers-retours sur le téléphone.

/** Routes atteignables sans session. Tout le reste demande une connexion. */
export const PUBLIC_PATHS = ['/onboarding', '/auth', '/parrain'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * Les routes d'API ne sont jamais redirigées.
 *
 * Le middleware leur renvoyait une redirection 307 vers une page HTML de
 * connexion. Pour du code qui attend du JSON, c'est incompréhensible : la
 * requête « réussit » avec un corps HTML, et l'erreur se manifeste plus loin
 * sous une forme sans rapport (« Unexpected token '<' »). Chaque route d'API
 * porte sa propre vérification et répond 401 ou 403 correctement — sauf la clé
 * publique des notifications, qui est publique par nature.
 */
export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
}

/** Où envoyer un visiteur non connecté : chaque application a son écran. */
export function signInPathFor(pathname: string): string {
  if (pathname.startsWith('/admin')) return '/auth/admin';
  if (pathname.startsWith('/driver')) return '/auth/livreur';
  return '/onboarding';
}

/** Où envoyer quelqu'un de déjà connecté qui rouvre un écran de connexion. */
export function landingPathFor(pathname: string): string {
  if (pathname.startsWith('/auth/admin')) return '/admin';
  if (pathname.startsWith('/auth/livreur')) return '/driver';
  return '/';
}

/**
 * Y a-t-il seulement un jeton de session dans cette requête ?
 *
 * Le middleware appelait `supabase.auth.getUser()` sur chaque requête — et cet
 * appel part sur le RÉSEAU vérifier le jeton auprès de Supabase. Pour un
 * visiteur sans session, cet aller-retour ne pouvait rien apprendre : il n'y a
 * pas de jeton à valider. On l'évite en regardant d'abord les cookies.
 *
 * Supabase (ssr) nomme son cookie `sb-<projet>-auth-token`, éventuellement
 * découpé en `.0`, `.1` quand il dépasse la taille d'un cookie.
 */
export function hasAuthCookie(cookieNames: string[]): boolean {
  return cookieNames.some((n) => /^sb-.+-auth-token(\.\d+)?$/.test(n));
}
