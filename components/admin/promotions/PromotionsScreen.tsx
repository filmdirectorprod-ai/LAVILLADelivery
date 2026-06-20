'use client';
// Admin promo-code management: create / edit / activate / delete codes via the
// admin_upsert_promo + admin_delete_promo RPCs. A branch gérant only sees and
// manages their own agency's codes (RLS + RPC enforced).
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDH } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';
import type { Branch, Promotion } from '@/lib/types';

const field: React.CSSProperties = { fontFamily: 'var(--ui-font)', fontSize: 14, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 9, color: 'var(--ink)', width: '100%', background: '#fff' };
const label: React.CSSProperties = { fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, display: 'block' };

type Draft = {
  id: string | null;
  code: string;
  type: 'percent' | 'fixed';
  value: string;
  min: string;
  starts: string;
  ends: string;
  maxUses: string;
  maxPerUser: string;
  branchId: string;
  active: boolean;
};

const emptyDraft = (): Draft => ({ id: null, code: '', type: 'percent', value: '', min: '', starts: '', ends: '', maxUses: '', maxPerUser: '', branchId: '', active: true });

function toDraft(p: Promotion): Draft {
  return {
    id: p.id,
    code: p.code,
    type: p.type,
    value: String(p.value),
    min: p.min_order_dh ? String(p.min_order_dh) : '',
    starts: p.starts_at ? p.starts_at.slice(0, 16) : '',
    ends: p.ends_at ? p.ends_at.slice(0, 16) : '',
    maxUses: p.max_uses != null ? String(p.max_uses) : '',
    maxPerUser: p.max_uses_per_user != null ? String(p.max_uses_per_user) : '',
    branchId: p.branch_id ?? '',
    active: p.active,
  };
}

export function PromotionsScreen({ initial, branches }: { initial: Promotion[]; branches: Branch[] }) {
  const [promos, setPromos] = useState<Promotion[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name.replace(/ —.*$/, '')])), [branches]);

  async function refetch() {
    const { data } = await createClient().from('promotions').select('*').order('created_at', { ascending: false });
    setPromos((data ?? []) as Promotion[]);
  }

  async function save() {
    if (!draft) return;
    setError(null);
    if (!draft.code.trim()) return setError('Le code est requis.');
    const value = Number(draft.value);
    if (!Number.isFinite(value) || value <= 0) return setError('Valeur invalide.');
    if (draft.type === 'percent' && value > 100) return setError('Un pourcentage ne peut dépasser 100.');
    setBusy(true);
    const { error: e } = await createClient().rpc('admin_upsert_promo', {
      p_id: draft.id,
      p_code: draft.code.trim().toUpperCase(),
      p_type: draft.type,
      p_value: value,
      p_min: draft.min ? Number(draft.min) : 0,
      p_starts: draft.starts || null,
      p_ends: draft.ends || null,
      p_max_uses: draft.maxUses ? Number(draft.maxUses) : null,
      p_max_per_user: draft.maxPerUser ? Number(draft.maxPerUser) : null,
      p_branch: draft.branchId || null,
      p_active: draft.active,
    });
    setBusy(false);
    if (e) return setError(e.message);
    setDraft(null);
    refetch();
  }

  async function toggleActive(p: Promotion) {
    await createClient().rpc('admin_upsert_promo', {
      p_id: p.id, p_code: p.code, p_type: p.type, p_value: p.value, p_min: p.min_order_dh,
      p_starts: p.starts_at, p_ends: p.ends_at, p_max_uses: p.max_uses, p_max_per_user: p.max_uses_per_user,
      p_branch: p.branch_id, p_active: !p.active,
    });
    refetch();
  }

  async function remove(p: Promotion) {
    if (!confirm(`Supprimer le code ${p.code} ?`)) return;
    await createClient().rpc('admin_delete_promo', { p_id: p.id });
    refetch();
  }

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Promotions</h1>
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
            Codes promo appliqués au paiement. {branches.length > 1 ? 'Vous pouvez limiter un code à une agence.' : ''}
          </p>
        </div>
        {!draft && (
          <button onClick={() => setDraft(emptyDraft())} style={{ border: 'none', borderRadius: 12, padding: '11px 18px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: '#fff', background: 'var(--brand)' }}>
            + Nouveau code
          </button>
        )}
      </div>

      {draft && (
        <div style={{ background: '#fff', border: '1px solid var(--brand)', borderRadius: 18, padding: 22 }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 14 }}>
            {draft.id ? 'Modifier le code' : 'Nouveau code'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <div>
              <label style={label}>Code</label>
              <input style={field} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="BIENVENUE10" />
            </div>
            <div>
              <label style={label}>Type</label>
              <select style={field} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as 'percent' | 'fixed' })}>
                <option value="percent">Pourcentage (%)</option>
                <option value="fixed">Montant fixe (DH)</option>
              </select>
            </div>
            <div>
              <label style={label}>{draft.type === 'percent' ? 'Valeur (%)' : 'Montant (DH)'}</label>
              <input style={field} type="number" min={0} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
            </div>
            <div>
              <label style={label}>Commande min. (DH)</label>
              <input style={field} type="number" min={0} value={draft.min} onChange={(e) => setDraft({ ...draft, min: e.target.value })} placeholder="0" />
            </div>
            <div>
              <label style={label}>Quota total</label>
              <input style={field} type="number" min={0} value={draft.maxUses} onChange={(e) => setDraft({ ...draft, maxUses: e.target.value })} placeholder="illimité" />
            </div>
            <div>
              <label style={label}>Quota / client</label>
              <input style={field} type="number" min={0} value={draft.maxPerUser} onChange={(e) => setDraft({ ...draft, maxPerUser: e.target.value })} placeholder="illimité" />
            </div>
            <div>
              <label style={label}>Début (option)</label>
              <input style={field} type="datetime-local" value={draft.starts} onChange={(e) => setDraft({ ...draft, starts: e.target.value })} />
            </div>
            <div>
              <label style={label}>Fin (option)</label>
              <input style={field} type="datetime-local" value={draft.ends} onChange={(e) => setDraft({ ...draft, ends: e.target.value })} />
            </div>
            <div>
              <label style={label}>Agence</label>
              <select style={field} value={draft.branchId} onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}>
                <option value="">Toutes les agences</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{branchName.get(b.id)}</option>)}
              </select>
            </div>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 14, cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)' }}>
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Actif
          </label>
          {error && <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: '#C0392B', fontWeight: 600, marginTop: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={save} disabled={busy} style={{ border: 'none', borderRadius: 10, padding: '11px 22px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: '#fff', background: 'var(--brand)', opacity: busy ? 0.6 : 1 }}>
              {busy ? '…' : 'Enregistrer'}
            </button>
            <button onClick={() => { setDraft(null); setError(null); }} disabled={busy} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '11px 22px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: '#fff' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
        {promos.length === 0 ? (
          <div style={{ padding: '40px 22px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>Aucun code promo.</div>
        ) : (
          promos.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(19,124,139,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="tag" size={18} color="var(--brand)" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', letterSpacing: 0.5 }}>{p.code}</div>
                <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                  {p.type === 'percent' ? `${p.value} %` : formatDH(p.value)}
                  {p.min_order_dh > 0 ? ` · min ${formatDH(p.min_order_dh)}` : ''}
                  {p.max_uses != null ? ` · ${p.max_uses} max` : ''}
                  {p.branch_id ? ` · ${branchName.get(p.branch_id) ?? 'agence'}` : ' · toutes agences'}
                </div>
              </div>
              <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: p.active ? 'rgba(35,158,111,0.12)' : 'rgba(0,0,0,0.06)', color: p.active ? '#1f7a49' : 'var(--muted)' }}>
                {p.active ? 'Actif' : 'Inactif'}
              </span>
              <button onClick={() => toggleActive(p)} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', background: '#fff' }}>
                {p.active ? 'Désactiver' : 'Activer'}
              </button>
              <button onClick={() => setDraft(toDraft(p))} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--brand)', background: '#fff' }}>
                Modifier
              </button>
              <button onClick={() => remove(p)} aria-label="Supprimer" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '7px 9px', cursor: 'pointer', background: '#fff' }}>
                <Icon name="x" size={15} color="#C0392B" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
