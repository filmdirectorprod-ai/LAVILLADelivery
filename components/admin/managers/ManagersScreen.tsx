'use client';
// Super-admin screen: create a branch gérant (identifiant → <id>@gerant.lavilla.ma
// + password + agency) via POST /api/admin/managers, and list existing gérants.
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/ui/Icon';
import { generatePassword, validateIdentifiant, validateDriverPassword, GERANT_EMAIL_DOMAIN } from '@/lib/driver-credentials';
import type { Branch } from '@/lib/types';

type Manager = { id: string; full_name: string | null; branch_id: string | null };

const field: React.CSSProperties = { fontFamily: 'var(--ui-font)', fontSize: 14, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)', width: '100%', background: '#fff' };
const label: React.CSSProperties = { fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, marginBottom: 5, display: 'block' };

export function ManagersScreen({ branches, managers: initial }: { branches: Branch[]; managers: Manager[] }) {
  const [managers, setManagers] = useState<Manager[]>(initial);
  const [identifiant, setIdentifiant] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState(generatePassword());
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ identifiant: string; email: string } | null>(null);
  // Row edit / delete state.
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [rowBusy, setRowBusy] = useState(false);

  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  async function refetchManagers() {
    const { data } = await createClient()
      .from('profiles')
      .select('id, full_name, branch_id')
      .eq('is_staff', true)
      .not('branch_id', 'is', null);
    setManagers((data ?? []) as Manager[]);
  }

  function startEdit(m: Manager) {
    setEditId(m.id);
    setEditName(m.full_name ?? '');
    setEditBranch(m.branch_id ?? branches[0]?.id ?? '');
  }

  async function saveEdit() {
    if (!editId || !editName.trim() || !editBranch) return;
    setRowBusy(true);
    await createClient().rpc('admin_update_manager', { p_user: editId, p_name: editName.trim(), p_branch: editBranch });
    setRowBusy(false);
    setEditId(null);
    refetchManagers();
  }

  async function deleteManager(m: Manager) {
    if (!confirm(`Supprimer le gérant ${m.full_name || ''} ? Son accès sera révoqué.`)) return;
    setRowBusy(true);
    const res = await fetch('/api/admin/managers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: m.id }),
    });
    setRowBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(j.error ?? 'Suppression échouée.');
      return;
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
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; identifiant?: string; email?: string; error?: string };
    setBusy(false);
    if (!res.ok || !json.ok) return setError(json.error ?? 'Création échouée.');
    setDone({ identifiant: json.identifiant!, email: json.email! });
    refetchManagers();
    setIdentifiant('');
    setName('');
    setPassword(generatePassword());
  }

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 920 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Gérants d&apos;agence</h1>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
          Créez un accès gérant lié à une agence. Le gérant ne verra que les commandes et livreurs de son agence.
        </p>
      </div>

      {/* Creation form */}
      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={label}>Identifiant</label>
            <input style={field} value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} placeholder="gerant.badie" />
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
              Connexion : {identifiant ? `${identifiant.trim().toLowerCase()}@${GERANT_EMAIL_DOMAIN}` : `…@${GERANT_EMAIL_DOMAIN}`}
            </div>
          </div>
          <div>
            <label style={label}>Nom du gérant</label>
            <input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom complet" />
          </div>
          <div>
            <label style={label}>Mot de passe</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={field} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setPassword(generatePassword())} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '0 12px', cursor: 'pointer', background: '#fff', color: 'var(--brand)', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                Régénérer
              </button>
            </div>
          </div>
          <div>
            <label style={label}>Agence</label>
            <select style={field} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: '#C0392B', fontWeight: 600, marginTop: 14 }}>{error}</div>}
        {done && (
          <div style={{ marginTop: 14, background: 'rgba(35,178,109,0.1)', border: '1px solid rgba(35,178,109,0.4)', borderRadius: 12, padding: '12px 14px', fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)' }}>
            ✅ Compte créé. Connexion sur <strong>/auth/admin</strong> avec <strong>{done.email}</strong>. Communiquez le mot de passe au gérant.
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <button onClick={create} disabled={busy} style={{ border: 'none', borderRadius: 12, padding: '12px 22px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: '#fff', background: 'var(--brand)', opacity: busy ? 0.6 : 1 }}>
            {busy ? '…' : 'Créer le gérant'}
          </button>
        </div>
      </div>

      {/* Existing gérants */}
      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
        <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 12 }}>Gérants existants</div>
        {managers.length === 0 ? (
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>Aucun gérant d&apos;agence pour l&apos;instant.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {managers.map((m) => (
              <div key={m.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 999, background: 'rgba(19,124,139,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="user" size={17} color="var(--brand)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.full_name || '—'}</div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--brand)', fontWeight: 600 }}>{branchName.get(m.branch_id ?? '')?.replace(/ —.*$/, '') ?? '—'}</div>
                  <button onClick={() => (editId === m.id ? setEditId(null) : startEdit(m))} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--brand)', background: '#fff' }}>
                    Modifier
                  </button>
                  <button onClick={() => deleteManager(m)} disabled={rowBusy} aria-label="Supprimer" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 9px', cursor: 'pointer', background: '#fff' }}>
                    <Icon name="x" size={15} color="#C0392B" />
                  </button>
                </div>
                {editId === m.id && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom" style={{ ...field, flex: 1, minWidth: 160, width: 'auto' }} />
                    <select value={editBranch} onChange={(e) => setEditBranch(e.target.value)} style={{ ...field, width: 'auto', cursor: 'pointer' }}>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name.replace(/ —.*$/, '')}</option>)}
                    </select>
                    <button onClick={saveEdit} disabled={rowBusy} style={{ border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 13, color: '#fff', background: 'var(--brand)', opacity: rowBusy ? 0.6 : 1 }}>
                      {rowBusy ? '…' : 'Enregistrer'}
                    </button>
                    <button onClick={() => setEditId(null)} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', background: '#fff' }}>
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
