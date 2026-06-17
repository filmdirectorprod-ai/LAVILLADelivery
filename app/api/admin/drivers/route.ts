// POST /api/admin/drivers — staff-only driver account provisioning.
// Creates a Supabase auth user from an admin-chosen identifiant + password
// (technical email <identifiant>@livreur.lavilla.ma, auto-confirmed), then either
// links it to an existing drivers row (driver_id) or inserts a new one. Uses the
// service-role key (server-only) and is gated on lv_is_staff(). Rolls back the
// auth user if the drivers write fails, so no orphan accounts are left behind.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase/server';
import {
  validateIdentifiant,
  validateDriverPassword,
  identifiantToEmail,
  normalizeIdentifiant,
} from '@/lib/driver-credentials';

interface Body {
  identifiant?: string;
  password?: string;
  driver_id?: string | null;
  name?: string;
  phone?: string | null;
  vehicle?: string | null;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  // ── Validation ──
  const idErr = validateIdentifiant(body.identifiant);
  if (idErr) return NextResponse.json({ error: idErr }, { status: 400 });
  const pwErr = validateDriverPassword(body.password);
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

  const linking = Boolean(body.driver_id);
  const name = (body.name ?? '').trim();
  if (!linking && !name) {
    return NextResponse.json({ error: 'Le nom du livreur est requis.' }, { status: 400 });
  }

  // ── Authorization: caller must be staff ──
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { data: isStaff } = await supabase.rpc('lv_is_staff');
  if (!isStaff) return NextResponse.json({ error: 'Accès réservé au staff.' }, { status: 403 });

  const email = identifiantToEmail(body.identifiant);
  const svc = createServiceSupabase();

  // ── Create the auth account ──
  const { data: created, error: cErr } = await svc.auth.admin.createUser({
    email,
    password: body.password!,
    email_confirm: true,
    user_metadata: { full_name: linking ? undefined : name, role: 'driver' },
  });
  if (cErr || !created?.user) {
    const msg = cErr?.message ?? 'Création du compte échouée.';
    const taken = /already|registered|exist/i.test(msg);
    return NextResponse.json(
      { error: taken ? 'Cet identifiant est déjà pris.' : msg },
      { status: taken ? 409 : 400 },
    );
  }
  const userId = created.user.id;

  // ── Link to an existing driver, or create a new one ──
  let writeErr: string | null = null;
  if (linking) {
    const { data: updated, error } = await svc
      .from('drivers')
      .update({ user_id: userId })
      .eq('id', body.driver_id!)
      .is('user_id', null)
      .select('id')
      .maybeSingle();
    if (error) writeErr = error.message;
    else if (!updated) writeErr = 'Ce livreur a déjà un accès, ou est introuvable.';
  } else {
    const { error } = await svc.from('drivers').insert({
      name,
      phone: body.phone?.trim() || null,
      vehicle: body.vehicle?.trim() || null,
      user_id: userId,
    });
    if (error) writeErr = error.message;
  }

  // ── Rollback the auth user on failure (no orphans) ──
  if (writeErr) {
    await svc.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: writeErr }, { status: 400 });
  }

  return NextResponse.json(
    { ok: true, identifiant: normalizeIdentifiant(body.identifiant), email },
    { status: 201 },
  );
}
