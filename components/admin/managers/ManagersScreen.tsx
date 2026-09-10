'use client';
// Super-admin Gérants d'agence, in the language of the Vue d'ensemble: one glass
// card per agency (address, phone, today's orders and revenue, its gérants), the
// creation form (identifiant → <id>@gerant.lavilla.ma + masked password + agency)
// via POST /api/admin/managers, and the existing gérants with their last sign-in,
// edit (admin_update_manager), password reset (PATCH) and delete (DELETE).
//
// Emails and last sign-in come from the auth admin API on the server (page.tsx):
// the browser can only read profiles, so a client refetch keeps what it knew.
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/ui/Icon';
import { formatAmount } from '@/lib/format';
import { generatePassword, validateIdentifiant, validateDriverPassword, GERANT_EMAIL_DOMAIN } from '@/lib/driver-credentials';
import { credentialsText, lastSeenLabel, type BranchActivity } from '@/lib/admin-managers';
import type { Branch } from '@/lib/types';
import { HeroStat, MiniStat } from '@/components/admin/overview/HeroStat';
import { EmptyState, GhostButton, GlassPanel, PageHeader, PanelTitle, PrimaryButton, SubPanel, fieldStyle, labelStyle } from '@/components/admin/ui/Glass';

export type ManagerRow = {
  id: string;
  full_name: string | null;
  branch_id: string | null;
  email: string | null;
  last_sign_in_at: string | null;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const shortName = (name: string) => name.replace(/ —.*$/, '');
const text = { fontFamily: 'var(--ui-font)' } as const;

/** The Clipboard API only exists on https / localhost; the admin is often opened
 *  over the LAN in plain http, so fall back to a hidden textarea. */
async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to the textarea
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function CopyButton({ value }: { value: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'ko'>('idle');
  return (
    <GhostButton onClick={async () => setState((await copyText(value)) ? 'ok' : 'ko')}>
      {state === 'ok' ? 'Copié ✓' : state === 'ko' ? 'Copie impossible' : 'Copier les identifiants'}
    </GhostButton>
  );
}

/** Masked by default: the super-admin may be sharing their screen. */
function PasswordField({ id, label, value, onChange, onRegenerate }: { id: string; label: string; value: string; onChange: (v: string) => void; onRegenerate: () => void }) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label style={labelStyle} htmlFor={id}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          autoComplete="new-password"
          spellCheck={false}
          style={{ ...fieldStyle, flex: 1, width: 'auto', minWidth: 0 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <GhostButton onClick={() => setShown((s) => !s)} aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
          {shown ? 'Masquer' : 'Afficher'}
        </GhostButton>
        <GhostButton onClick={onRegenerate}>Régénérer</GhostButton>
      </div>
    </div>
  );
}

function Alert({ children }: { children: string }) {
  return (
    <div role="alert" style={{ ...text, fontSize: 12.5, fontWeight: 600, color: 'var(--a-accent)', marginTop: 12 }}>
      {children}
    </div>
  );
}

export function ManagersScreen({ branches, managers: initial, activity }: { branches: Branch[]; managers: ManagerRow[]; activity: Record<string, BranchActivity> }) {
  const [managers, setManagers] = useState<ManagerRow[]>(initial);
  // Creation form.
  const [identifiant, setIdentifiant] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState(generatePassword);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; email: string; password: string } | null>(null);
  // Row edit / reset / delete.
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetDone, setResetDone] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, shortName(b.name)])), [branches]);
  const todayOrders = useMemo(() => Object.values(activity).reduce((n, a) => n + a.orders, 0), [activity]);
  const recentlySeen = useMemo(() => {
    const now = Date.now();
    return managers.filter((m) => m.last_sign_in_at && now - Date.parse(m.last_sign_in_at) < WEEK_MS).length;
  }, [managers]);

  async function refetchManagers(created?: { id: string; email: string }) {
    const { data } = await createClient().from('profiles').select('id, full_name, branch_id').eq('is_staff', true).not('branch_id', 'is', null);
    setManagers((prev) => {
      const known = new Map(prev.map((m) => [m.id, m]));
      return (data ?? []).map((p) => {
        const r = p as { id: string; full_name: string | null; branch_id: string | null };
        const k = known.get(r.id);
        return {
          ...r,
          email: k?.email ?? (created?.id === r.id ? created.email : null),
          last_sign_in_at: k?.last_sign_in_at ?? null,
        };
      });
    });
  }

  function openEdit(m: ManagerRow) {
    setResetId(null);
    setRowError(null);
    if (editId === m.id) return setEditId(null);
    setEditId(m.id);
    setEditName(m.full_name ?? '');
    setEditBranch(m.branch_id ?? branches[0]?.id ?? '');
  }

  function openReset(m: ManagerRow) {
    setEditId(null);
    setRowError(null);
    setResetDone(null);
    if (resetId === m.id) return setResetId(null);
    setResetId(m.id);
    setResetPassword(generatePassword());
  }

  async function saveEdit() {
    if (!editId || !editName.trim() || !editBranch) return;
    setRowBusy(true);
    const { error: e } = await createClient().rpc('admin_update_manager', { p_user: editId, p_name: editName.trim(), p_branch: editBranch });
    setRowBusy(false);
    if (e) return setRowError('La modification a échoué.');
    setEditId(null);
    refetchManagers();
  }

  async function saveReset(m: ManagerRow) {
    setRowError(null);
    const pwErr = validateDriverPassword(resetPassword);
    if (pwErr) return setRowError(pwErr);
    setRowBusy(true);
    const res = await fetch('/api/admin/managers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: m.id, password: resetPassword }),
    });
    setRowBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return setRowError(j.error ?? 'Le mot de passe n’a pas pu être changé.');
    }
    setResetDone(resetPassword);
  }

  async function deleteManager(m: ManagerRow) {
    if (!confirm(`Supprimer le gérant ${m.full_name || ''} ? Son accès sera révoqué.`)) return;
    setRowError(null);
    setRowBusy(true);
    const res = await fetch('/api/admin/managers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: m.id }),
    });
    setRowBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      return setRowError(j.error ?? 'Suppression échouée.');
    }
    setManagers((list) => list.filter((x) => x.id !== m.id));
  }

  async function create() {
    setError(null);
    setDone(null);
    const idErr = validateIdentifiant(identifiant);
    if (idErr) return setError(idErr);
    if (!name.trim()) return setError('Le nom du gérant est requis.');
    const pwErr = validateDriverPassword(password);
    if (pwErr) return setError(pwErr);
    if (!branchId) return setError('Choisissez une agence.');
    setBusy(true);
    const res = await fetch('/api/admin/managers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiant, name, password, branch_id: branchId }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; user_id?: string; email?: string; error?: string };
    setBusy(false);
    if (!res.ok || !json.ok) return setError(json.error ?? 'Création échouée.');
    setDone({ name: name.trim(), email: json.email!, password });
    refetchManagers(json.user_id ? { id: json.user_id, email: json.email! } : undefined);
    setIdentifiant('');
    setName('');
    setPassword(generatePassword());
  }

  return (
    <div style={{ padding: '30px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader title="Gérants d'agence" subtitle="Chaque gérant est lié à une agence et ne voit que ses commandes et ses livreurs." />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 56px' }}>
        <HeroStat label="Agences" value={String(branches.length)} />
        <HeroStat label="Gérants" value={String(managers.length)} />
        <HeroStat label="Connectés · 7 jours" value={String(recentlySeen)} />
        <HeroStat label="Commandes aujourd'hui" value={formatAmount(todayOrders)} />
      </div>

      {branches.length === 0 ? (
        <GlassPanel>
          <EmptyState title="Aucune agence active." />
        </GlassPanel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
          {branches.map((b) => {
            const act = activity[b.id] ?? { orders: 0, revenue: 0 };
            const team = managers.filter((m) => m.branch_id === b.id);
            return (
              <GlassPanel key={b.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="store" size={20} color="var(--ink)" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ ...text, margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{shortName(b.name)}</h3>
                    {b.address && <div style={{ ...text, fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.address}</div>}
                  </div>
                </div>
                {b.phone && (
                  <a href={`tel:${b.phone.replace(/\s+/g, '')}`} style={{ ...text, display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13, color: 'var(--ink)', textDecoration: 'none' }}>
                    <Icon name="phone" size={14} color="var(--ink)" />
                    {b.phone}
                  </a>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 18 }}>
                  <MiniStat label="Commandes aujourd'hui" value={String(act.orders)} />
                  <MiniStat label="CA aujourd'hui" value={formatAmount(act.revenue)} unit="DH" />
                </div>
                <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 12 }}>
                  <div style={{ ...labelStyle, marginBottom: 8 }}>{team.length > 1 ? 'Gérants' : 'Gérant'}</div>
                  {team.length === 0 ? (
                    <div style={{ ...text, fontSize: 13, color: 'var(--muted)' }}>Aucun gérant — créez-en un ci-dessous.</div>
                  ) : (
                    team.map((m) => (
                      <div key={m.id} style={{ ...text, fontSize: 13.5, color: 'var(--ink)', fontWeight: 600, padding: '2px 0' }}>
                        {m.full_name || '—'} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>· {lastSeenLabel(m.last_sign_in_at)}</span>
                      </div>
                    ))
                  )}
                </div>
              </GlassPanel>
            );
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 22, alignItems: 'start' }}>
        <GlassPanel>
          <PanelTitle aside="Connexion sur /auth/admin">Nouveau gérant</PanelTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle} htmlFor="mgr-identifiant">
                Identifiant
              </label>
              <input id="mgr-identifiant" style={fieldStyle} value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} placeholder="gerant.badie" autoComplete="off" />
              <div style={{ ...text, fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>
                Connexion : {identifiant ? `${identifiant.trim().toLowerCase()}@${GERANT_EMAIL_DOMAIN}` : `…@${GERANT_EMAIL_DOMAIN}`}
              </div>
            </div>
            <div>
              <label style={labelStyle} htmlFor="mgr-name">
                Nom du gérant
              </label>
              <input id="mgr-name" style={fieldStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom complet" />
            </div>
            <PasswordField id="mgr-password" label="Mot de passe" value={password} onChange={setPassword} onRegenerate={() => setPassword(generatePassword())} />
            <div>
              <label style={labelStyle} htmlFor="mgr-branch">
                Agence
              </label>
              <select id="mgr-branch" style={fieldStyle} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {shortName(b.name)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <Alert>{error}</Alert>}
          {done && (
            <SubPanel style={{ marginTop: 14, border: '1px solid var(--a-glass-line)' }}>
              <div style={{ ...text, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>
                Compte créé pour <strong>{done.name}</strong>. Identifiant : <strong>{done.email}</strong>. Transmettez-lui ses identifiants.
              </div>
              <div style={{ marginTop: 10 }}>
                <CopyButton value={credentialsText(done.email, done.password)} />
              </div>
            </SubPanel>
          )}

          <div style={{ marginTop: 18 }}>
            <PrimaryButton onClick={create} disabled={busy}>
              {busy ? '…' : 'Créer le gérant'}
            </PrimaryButton>
          </div>
        </GlassPanel>

        <GlassPanel>
          <PanelTitle aside={`${managers.length} gérant${managers.length > 1 ? 's' : ''}`}>Gérants existants</PanelTitle>
          {rowError && <Alert>{rowError}</Alert>}
          {managers.length === 0 ? (
            <EmptyState title="Aucun gérant d'agence pour l'instant." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {managers.map((m) => (
                <div key={m.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="user" size={17} color="var(--ink)" />
                    </div>
                    <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                      <div style={{ ...text, fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.full_name || '—'} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>· {branchName.get(m.branch_id ?? '') ?? '—'}</span>
                      </div>
                      {m.email && <div style={{ ...text, fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>}
                      <div style={{ ...text, fontSize: 12, color: 'var(--muted)' }}>Dernière connexion : {lastSeenLabel(m.last_sign_in_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <GhostButton onClick={() => openEdit(m)}>Modifier</GhostButton>
                      <GhostButton onClick={() => openReset(m)}>Nouveau mot de passe</GhostButton>
                      <GhostButton onClick={() => deleteManager(m)} disabled={rowBusy} aria-label={`Supprimer ${m.full_name || 'le gérant'}`} style={{ padding: '8px 10px' }}>
                        <Icon name="x" size={14} color="var(--ink)" />
                      </GhostButton>
                    </div>
                  </div>

                  {editId === m.id && (
                    <SubPanel style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom" aria-label="Nom du gérant" style={{ ...fieldStyle, flex: '1 1 160px', width: 'auto' }} />
                      <select value={editBranch} onChange={(e) => setEditBranch(e.target.value)} aria-label="Agence du gérant" style={{ ...fieldStyle, width: 'auto', cursor: 'pointer' }}>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {shortName(b.name)}
                          </option>
                        ))}
                      </select>
                      <PrimaryButton onClick={saveEdit} disabled={rowBusy}>
                        {rowBusy ? '…' : 'Enregistrer'}
                      </PrimaryButton>
                      <GhostButton onClick={() => setEditId(null)}>Annuler</GhostButton>
                    </SubPanel>
                  )}

                  {resetId === m.id && (
                    <SubPanel style={{ marginTop: 12 }}>
                      <PasswordField
                        id={`reset-${m.id}`}
                        label={`Nouveau mot de passe pour ${m.full_name || 'ce gérant'}`}
                        value={resetPassword}
                        onChange={(v) => {
                          setResetPassword(v);
                          setResetDone(null);
                        }}
                        onRegenerate={() => {
                          setResetPassword(generatePassword());
                          setResetDone(null);
                        }}
                      />
                      {resetDone ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                          <span style={{ ...text, fontSize: 13, color: 'var(--ink)' }}>Mot de passe mis à jour.</span>
                          <CopyButton value={credentialsText(m.email ?? `…@${GERANT_EMAIL_DOMAIN}`, resetDone)} />
                          <GhostButton onClick={() => setResetId(null)}>Fermer</GhostButton>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <PrimaryButton onClick={() => saveReset(m)} disabled={rowBusy}>
                            {rowBusy ? '…' : 'Enregistrer le mot de passe'}
                          </PrimaryButton>
                          <GhostButton onClick={() => setResetId(null)}>Annuler</GhostButton>
                        </div>
                      )}
                    </SubPanel>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
