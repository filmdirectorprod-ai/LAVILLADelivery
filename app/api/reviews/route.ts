// POST /api/reviews — server-authoritative review submission.
// Validates the request and resolves the signed-in user, then delegates the
// insert + loyalty award to the submit_review RPC (which verifies the order is
// owned + delivered and awards the fixed +50 bonus). Returns the new balance.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

interface ReviewBody {
  order_id: string;
  rating: number;
  tags?: string[];
  comment?: string;
  photo_url?: string | null;
}

export async function POST(request: NextRequest) {
  let body: ReviewBody;
  try {
    body = (await request.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.order_id) {
    return NextResponse.json({ error: 'Commande manquante' }, { status: 400 });
  }
  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
    return NextResponse.json({ error: 'Note invalide' }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { data, error } = await supabase.rpc('submit_review', {
    p_user: user.id,
    p_order: body.order_id,
    p_rating: body.rating,
    p_tags: body.tags ?? [],
    p_comment: body.comment ?? '',
    p_photo_url: body.photo_url ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ balance: data as number }, { status: 201 });
}
