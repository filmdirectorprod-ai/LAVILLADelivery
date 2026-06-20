// POST /api/admin/managers — super-admin-only branch gérant provisioning.
// Creates a Supabase auth user from a chosen identifiant + password (technical
// email <identifiant>@gerant.lavilla.ma, auto-confirmed), then promotes its
// auto-created profile to staff bound to a branch (is_staff + branch_id). Gated on
// the caller being a SUPER-ADMIN (staff with no branch). Rolls back the auth user
// if the profile write fails, so no orphan accounts are left behind.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase/server';
import {
  validateIdentifiant,
  validateDriverPassword,
  gerantIdentifiantToEmail,
  normalizeIdentifiant,
} from '@/lib/driver-credentials';

interface Body {
  identifiant?: string;
  password?: string;
  name?: string;
  branch_id?: string;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const idErr = validateIdentifiant(body.identifiant);
  if (idErr) return NextResponse.json({ error: idErr }, { status: 400 });
  const pwErr = validateDriverPassword(body.password);
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
  const name = (body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Le nom du gérant est requis.' }, { status: 400 });
  if (!body.branch_id) return NextResponse.json({ error: 'Choisissez une agence.' }, { status: 400 });

  // Authorization: caller must be a SUPER-ADMIN (staff with no branch).
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { data: isStaff } = await supabase.rpc('lv_is_staff');
  if (!isStaff) return NextResponse.json({ error: 'Accès réservé au staff.' }, { status: 403 });
  const { data: callerBranch } = await supabase.rpc('lv_staff_branch');
  if (callerBranch) {
    return NextResponse.json({ error: 'Réservé au super-admin.' }, { status: 403 });
  }

  const svc = createServiceSupabase();
  // Branch must exist.
  const { data: branch } = await svc.from('branches').select('id').eq('id', body.branch_id).maybeSingle();
  if (!branch) return NextResponse.json({ error: 'Agence introuvable.' }, { status: 400 });

  const email = gerantIdentifiantToEmail(body.identifiant);
  const { data: created, error: cErr } = await svc.auth.admin.createUser({
    email,
    password: body.password!,
    email_confirm: true,
    user_metadata: { full_name: name, role: 'manager' },
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

  // The handle_new_user trigger created the profile; promote it to a branch gérant.
  const { error: pErr } = await svc
    .from('profiles')
    .update({ full_name: name, is_staff: true, branch_id: body.branch_id })
    .eq('id', userId);
  if (pErr) {
    await svc.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: pErr.message }, { status: 400 });
  }

  return NextResponse.json(
    { ok: true, identifiant: normalizeIdentifiant(body.identifiant), email },
    { status: 201 },
  );
}
