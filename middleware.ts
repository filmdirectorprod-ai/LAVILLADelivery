import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on all routes except Next internals, the OAuth callback, the PWA service
  // worker / manifests, and static assets. The SW and *.webmanifest must reach
  // logged-out visitors raw (otherwise the auth redirect breaks install).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
  ],
};
