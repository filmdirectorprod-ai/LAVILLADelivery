// POST /api/orders — server-authoritative order placement.
// Validates the request, resolves the signed-in user, and delegates ALL money
// + loyalty math to the place_order RPC (which recomputes from authoritative
// product prices). The client total is never trusted.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

interface OrderItemInput {
  product_id: string;
  qty: number;
  size_mult?: number;
  customization?: Record<string, unknown>;
}

interface PlaceOrderBody {
  items: OrderItemInput[];
  mode: 'livraison' | 'retrait';
  address?: string | null;
  phone?: string | null;
  branch_slug?: string | null;
  zone_id?: string | null;
  promo?: boolean;
  redeem_pts?: number;
  redeem_dh?: number;
}

export async function POST(request: NextRequest) {
  let body: PlaceOrderBody;
  try {
    body = (await request.json()) as PlaceOrderBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Panier vide' }, { status: 400 });
  }
  if (body.mode !== 'livraison' && body.mode !== 'retrait') {
    return NextResponse.json({ error: 'Mode invalide' }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { data, error } = await supabase.rpc('place_order', {
    p_user: user.id,
    p_items: body.items,
    p_mode: body.mode,
    p_address: body.address ?? null,
    p_zone: body.zone_id ?? null,
    p_promo: body.promo ?? false,
    p_redeem_pts: body.redeem_pts ?? 0,
    p_redeem_dh: body.redeem_dh ?? 0,
    p_phone: body.phone ?? null,
    p_branch_slug: body.branch_slug ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ order_id: data as string }, { status: 201 });
}
