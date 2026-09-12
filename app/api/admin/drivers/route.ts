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
  branch_id?: string | null;
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

  // Multi-agences: a new driver must belong to exactly one branch so they only ever
  // see that agency's orders. A branch gérant can only create drivers for their own
  // agency (forced server-side); a super-admin picks the agency in the modal.
  const { data: callerBranch } = await supabase.rpc('lv_staff_branch');
  const branchId = (callerBranch as string | null) ?? (body.branch_id || null);
  if (!linking && !branchId) {
    return NextResponse.json({ error: 'Choisissez une agence pour le livreur.' }, { status: 400 });
  }

  const email = identifiantToEmail(body.identifiant);
  const svc = createServiceSupabase();

  if (branchId) {
    // L'agence doit exister. On distingue les deux causes : une requête qui
    // ÉCHOUE (clé de service absente ou refusée, base injoignable) renvoyait le
    // même « Agence introuvable » qu'une agence réellement absente — un message
    // qui accusait la saisie du gérant pour un problème d'installation, et qui a
    // coûté une soirée de recherche. Chacune dit maintenant ce qu'elle est.
    const { data: branch, error: branchErr } = await svc
      .from('branches')
      .select('id')
      .eq('id', branchId)
      .maybeSingle();
    if (branchErr) {
      console.error('[api/admin/drivers] lecture de branches impossible :', branchErr.message);
      return NextResponse.json(
        {
          error:
            "La base de données n'a pas répondu. C'est une erreur d'installation, pas de saisie : " +
            'vérifiez que SUPABASE_SERVICE_ROLE_KEY est bien définie pour cet environnement.',
        },
        { status: 500 },
      );
    }
    if (!branch) return NextResponse.json({ error: 'Agence introuvable.' }, { status: 400 });
  }

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
      branch_id: branchId,
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
