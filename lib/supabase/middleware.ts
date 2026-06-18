import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Routes reachable without a session. Everything else requires sign-in. */
const PUBLIC_PATHS = ['/onboarding', '/auth'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * Refreshes the Supabase auth session on every request (so Server Components
 * read a fresh token) and gates protected routes behind authentication.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

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

  // IMPORTANT: getUser() must be called to refresh the session token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    // Each surface has its own sign-in: admin, driver, else the customer onboarding.
    url.pathname = pathname.startsWith('/admin')
      ? '/auth/admin'
      : pathname.startsWith('/driver')
        ? '/auth/livreur'
        : '/onboarding';
    return NextResponse.redirect(url);
  }

  if (user && isPublic(pathname)) {
    const url = request.nextUrl.clone();
    // Send a signed-in user from a surface's sign-in to that surface.
    url.pathname = pathname.startsWith('/auth/admin')
      ? '/admin'
      : pathname.startsWith('/auth/livreur')
        ? '/driver'
        : '/';
    return NextResponse.redirect(url);
  }

  return response;
}
