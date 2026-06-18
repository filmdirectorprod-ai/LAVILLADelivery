// GET /api/places — server-side proxy for Places API (New). Keeps the Google key
// off the client: the key lives in app_config (service-role only) and the call is
// made here. Gated to signed-in users (the address autocomplete is customer-only)
// to protect the quota. Two actions:
//   ?action=autocomplete&input=…  → [{ placeId, text }]
//   ?action=details&placeId=…     → { formatted, lat, lng }
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase/server';

const FES = { latitude: 34.0261, longitude: -5.014 };

let cachedKey: string | null = null;
async function placesKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  const svc = createServiceSupabase();
  const { data } = await svc.from('app_config').select('value').eq('name', 'google_places_key').maybeSingle();
  cachedKey = (data?.value as string) ?? null;
  return cachedKey;
}

export async function GET(request: NextRequest) {
  // Only signed-in users may use the proxy (quota protection).
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const key = await placesKey();
  if (!key) return NextResponse.json({ error: 'Clé Places absente' }, { status: 500 });

  const action = request.nextUrl.searchParams.get('action');

  try {
    if (action === 'autocomplete') {
      const input = request.nextUrl.searchParams.get('input') ?? '';
      if (input.trim().length < 3) return NextResponse.json({ suggestions: [] });
      const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
        body: JSON.stringify({
          input,
          includedRegionCodes: ['ma'],
          locationBias: { circle: { center: FES, radius: 25000 } },
        }),
      });
      const data = await res.json();
      const suggestions = (data.suggestions ?? [])
        .map((x: { placePrediction?: { placeId?: string; text?: { text?: string } } }) => ({
          placeId: x.placePrediction?.placeId ?? '',
          text: x.placePrediction?.text?.text ?? '',
        }))
        .filter((s: { placeId: string; text: string }) => s.placeId && s.text);
      return NextResponse.json({ suggestions });
    }

    if (action === 'details') {
      const placeId = request.nextUrl.searchParams.get('placeId') ?? '';
      if (!placeId) return NextResponse.json({ error: 'placeId requis' }, { status: 400 });
      const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'formattedAddress,location' },
      });
      const p = await res.json();
      return NextResponse.json({
        formatted: p.formattedAddress ?? '',
        lat: p.location?.latitude ?? null,
        lng: p.location?.longitude ?? null,
      });
    }

    return NextResponse.json({ error: 'action invalide' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Places indisponible' }, { status: 502 });
  }
}
