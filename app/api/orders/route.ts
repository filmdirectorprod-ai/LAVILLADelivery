// POST /api/orders — server-authoritative order placement.
// Validates the request, resolves the signed-in user, and delegates ALL money
// + loyalty math to the place_order RPC (which recomputes from authoritative
// product prices). The client total is never trusted.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { customerMessage } from '@/lib/order-error-messages';

interface OrderItemInput {
  product_id: string;
  qty: number;
  size_mult?: number;
  customization?: Record<string, unknown>;
}

/** Moyens de paiement acceptés (0054). Seul 'cod' encaisse réellement pour
 *  l'instant ; les autres restent des intentions, enregistrées telles quelles. */
const PAYMENT_METHODS = ['cod', 'cmi', 'hps', 'cashplus', 'virement'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

interface PlaceOrderBody {
  items: OrderItemInput[];
  mode: 'livraison' | 'retrait';
  address?: string | null;
  phone?: string | null;
  branch_slug?: string | null;
  zone_id?: string | null;
  promo?: boolean;
  promo_code?: string | null;
  redeem_pts?: number;
  redeem_dh?: number;
  /** Moyen de paiement choisi ; 'cod' par défaut (0054). */
  payment?: string | null;
  /** Créneau choisi : instant ISO, null = au plus vite (0054). */
  slot_at?: string | null;
  slot_label?: string | null;
  /** Coordonnées de l'adresse choisie, pour une arrivée mesurée (0054). */
  dest_lat?: number | null;
  dest_lng?: number | null;
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

  // Moyen de paiement : validé ici, revalidé par la RPC. Une valeur inconnue
  // retombe sur les espèces plutôt que de faire échouer la commande.
  const payment = (PAYMENT_METHODS as readonly string[]).includes(body.payment ?? '')
    ? (body.payment as PaymentMethod)
    : 'cod';

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
    p_promo_code: body.promo_code ?? null,
    p_payment: payment,
    p_slot_at: body.slot_at ?? null,
    p_slot_label: body.slot_label ?? null,
    p_dest_lat: body.dest_lat ?? null,
    p_dest_lng: body.dest_lng ?? null,
  });

  if (error) {
    return NextResponse.json({ error: customerMessage(error.message) }, { status: 400 });
  }

  return NextResponse.json({ order_id: data as string }, { status: 201 });
}
