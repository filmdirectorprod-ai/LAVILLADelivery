import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasAuthCookie, isApiPath, isPublicPath, landingPathFor, signInPathFor } from '@/lib/auth-routing';

/**
 * Rafraîchit la session Supabase (pour que les Server Components lisent un
 * jeton valide) et garde les routes protégées derrière la connexion.
 *
 * Les décisions d'aiguillage vivent dans lib/auth-routing.ts, où elles sont
 * testées : ce fichier ne fait que les appliquer.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // Une route d'API ne se redirige pas : elle répond elle-même, avec le bon
  // code et du JSON. La rediriger renvoyait du HTML à du code qui attend des
  // données.
  if (isApiPath(pathname)) return response;

  // When Supabase isn't configured (e.g. CI / a fresh checkout without
  // .env.local), there's no session to refresh and no way to gate routes —
  // pass through so the statically-prerendered public pages still render.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    anonKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() part sur le RÉSEAU valider le jeton auprès de Supabase. Sans
  // cookie de session, cet aller-retour ne peut rien apprendre — il n'y a pas
  // de jeton à valider — et il s'ajoutait pourtant à chaque page ouverte par un
  // visiteur non connecté. On le saute.
  const user = hasAuthCookie(request.cookies.getAll().map((c) => c.name))
    ? (await supabase.auth.getUser()).data.user
    : null;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = signInPathFor(pathname);
    return NextResponse.redirect(url);
  }

  if (user && isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = landingPathFor(pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
