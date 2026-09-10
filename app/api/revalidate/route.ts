// POST /api/revalidate — drops a cached tag (today: the catalogue).
//
// The admin screens mutate through SECURITY DEFINER RPCs from the browser, so
// nothing on the server knows the catalogue changed; they call this route right
// after, and the next customer request rebuilds the cached rows. Staff only —
// the caller's session is checked against profiles.is_staff before anything is
// invalidated, so a visitor cannot flush the cache in a loop.
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { CATALOGUE_TAG } from '@/lib/catalogue';

const ALLOWED = new Set([CATALOGUE_TAG]);

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('is_staff').eq('id', user.id).maybeSingle();
  if (!profile?.is_staff) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { tag?: string };
  const tag = body.tag ?? CATALOGUE_TAG;
  if (!ALLOWED.has(tag)) return NextResponse.json({ error: 'unknown tag' }, { status: 400 });

  revalidateTag(tag);
  return NextResponse.json({ revalidated: tag });
}
