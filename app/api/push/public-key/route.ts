// GET /api/push/public-key — serves the VAPID public key so the client can
// subscribe to Web Push without a build-time env var. The public key is safe to
// expose (only the private key, kept in app_config + the edge function, is secret).
import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase/server';

let cached: string | null = null;

export async function GET() {
  if (!cached) {
    const svc = createServiceSupabase();
    const { data } = await svc.from('app_config').select('value').eq('name', 'vapid_public_key').maybeSingle();
    cached = (data?.value as string) ?? null;
  }
  if (!cached) return NextResponse.json({ error: 'VAPID absent' }, { status: 500 });
  return NextResponse.json({ publicKey: cached });
}
