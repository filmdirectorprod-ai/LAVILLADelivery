'use client';
// Admin promo-code management, in the language of the Vue d'ensemble: headline
// figures (codes active now, uses, discount granted, revenue the codes brought
// in), each code with its state (active / scheduled / expired / exhausted /
// inactive), dates, usage gauge and an on/off switch, and the recent uses.
// Create / edit / delete go through admin_upsert_promo + admin_delete_promo. A
// branch gérant only sees and manages their own agency's codes (RLS + RPC).
import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatAmount, formatDH } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';
import type { Branch, Promotion } from '@/lib/types';
import { useRealtime } from '@/lib/use-realtime';
import {
  PROMO_STATE_LABEL,
  REDEMPTIONS_SELECT,
  promoKpis,
  promoState,
  recentRedemptions,
  toRedemptions,
  usageRatio,
  usesByPromo,
  visibleRedemptions,
  type PromoState,
  type Redemption,
} from '@/lib/admin-promotions';
import { lastSeenLabel } from '@/lib/admin-managers';
import { HeroStat } from '@/components/admin/overview/HeroStat';
import { EmptyState, GhostButton, GlassPanel, Meter, PageHeader, PanelTitle, PrimaryButton, Switch, fieldStyle, labelStyle } from '@/components/admin/ui/Glass';

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

// State pills in the palette: live codes are the white pill, codes that need a
// look (expired, exhausted) carry the gold, the rest recede.
const STATE_STYLE: Record<PromoState, CSSProperties> = {
  active: { background: '#ffffff', color: 'var(--a-on-white)', border: '1px solid #ffffff' },
  scheduled: { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--a-glass-line)' },
  expired: { background: 'transparent', color: 'var(--a-accent)', border: '1px solid var(--a-accent)' },
  exhausted: { background: 'transparent', color: 'var(--a-accent)', border: '1px solid var(--a-accent)' },
  inactive: { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)' },
};

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', timeZone: 'Africa/Casablanca' });

function period(p: Promotion): string {
  if (p.starts_at && p.ends_at) return `du ${shortDate(p.starts_at)} au ${shortDate(p.ends_at)}`;
  if (p.starts_at) return `à partir du ${shortDate(p.starts_at)}`;
  if (p.ends_at) return `jusqu'au ${shortDate(p.ends_at)}`;
  return 'sans date limite';
}

export function PromotionsScreen({ initial, branches, redemptions: initialRedemptions }: { initial: Promotion[]; branches: Branch[]; redemptions: Redemption[] }) {
  const [promos, setPromos] = useState<Promotion[]>(initial);
  const [redemptions, setRedemptions] = useState<Redemption[]>(initialRedemptions);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const { data } = await createClient().from('promotions').select('*').order('created_at', { ascending: false });
    setPromos((data ?? []) as Promotion[]);
  }, []);

  const refetchRedemptions = useCallback(async () => {
    const { data } = await createClient().from('promo_redemptions').select(REDEMPTIONS_SELECT).order('created_at', { ascending: false }).limit(500);
    setRedemptions(toRedemptions(data));
  }, []);

  // Code edits and new uses arrive live. A burst of uses at the dinner rush
  // collapses into one re-read of the redemptions (default debounce).
  useRealtime('admin-promotions', [{ table: 'promotions' }], refetch);
  useRealtime('admin-promo-redemptions', [{ table: 'promo_redemptions', event: 'INSERT' }], refetchRedemptions);

  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name.replace(/ —.*$/, '')])), [branches]);
  const uses = useMemo(() => usesByPromo(visibleRedemptions(promos, redemptions)), [promos, redemptions]);
  const kpis = useMemo(() => promoKpis(promos, redemptions), [promos, redemptions]);
  const recent = useMemo(() => recentRedemptions(promos, redemptions, 12), [promos, redemptions]);
  const codeById = useMemo(() => new Map(promos.map((p) => [p.id, p.code])), [promos]);

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

  async function toggleActive(p: Promotion, next: boolean) {
    setRowBusy(p.id);
    setPromos((list) => list.map((x) => (x.id === p.id ? { ...x, active: next } : x)));
    const { error: e } = await createClient().rpc('admin_upsert_promo', {
      p_id: p.id,
      p_code: p.code,
      p_type: p.type,
      p_value: p.value,
      p_min: p.min_order_dh,
      p_starts: p.starts_at,
      p_ends: p.ends_at,
      p_max_uses: p.max_uses,
      p_max_per_user: p.max_uses_per_user,
      p_branch: p.branch_id,
      p_active: next,
    });
    setRowBusy(null);
    if (e) setPromos((list) => list.map((x) => (x.id === p.id ? { ...x, active: p.active } : x)));
    refetch();
  }

  async function remove(p: Promotion) {
    if (!confirm(`Supprimer le code ${p.code} ?`)) return;
    await createClient().rpc('admin_delete_promo', { p_id: p.id });
    refetch();
  }

  return (
    <div style={{ padding: '30px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Promotions"
        subtitle={`Codes promo appliqués au paiement.${branches.length > 1 ? ' Un code peut être limité à une agence.' : ''}`}
        actions={!draft ? <PrimaryButton onClick={() => setDraft(emptyDraft())}>+ Nouveau code</PrimaryButton> : undefined}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 56px' }}>
        <HeroStat label={`Codes actifs · ${promos.length} au total`} value={String(kpis.active)} />
        <HeroStat label="Utilisations" value={formatAmount(kpis.uses)} />
        <HeroStat label="Remise accordée" value={formatAmount(kpis.discount)} unit="DH" />
        <HeroStat label="CA généré par les codes" value={formatAmount(kpis.revenue)} unit="DH" />
      </div>

      {draft && (
        <GlassPanel>
          <PanelTitle>{draft.id ? 'Modifier le code' : 'Nouveau code'}</PanelTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div>
              <label style={labelStyle} htmlFor="promo-code">Code</label>
              <input id="promo-code" style={fieldStyle} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="BIENVENUE10" />
            </div>
            <div>
              <label style={labelStyle} htmlFor="promo-type">Type</label>
              <select id="promo-type" style={fieldStyle} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as 'percent' | 'fixed' })}>
                <option value="percent">Pourcentage (%)</option>
                <option value="fixed">Montant fixe (DH)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle} htmlFor="promo-value">{draft.type === 'percent' ? 'Valeur (%)' : 'Montant (DH)'}</label>
              <input id="promo-value" style={fieldStyle} type="number" min={0} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="promo-min">Commande min. (DH)</label>
              <input id="promo-min" style={fieldStyle} type="number" min={0} value={draft.min} onChange={(e) => setDraft({ ...draft, min: e.target.value })} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle} htmlFor="promo-max">Quota total</label>
              <input id="promo-max" style={fieldStyle} type="number" min={0} value={draft.maxUses} onChange={(e) => setDraft({ ...draft, maxUses: e.target.value })} placeholder="illimité" />
            </div>
            <div>
              <label style={labelStyle} htmlFor="promo-max-user">Quota / client</label>
              <input id="promo-max-user" style={fieldStyle} type="number" min={0} value={draft.maxPerUser} onChange={(e) => setDraft({ ...draft, maxPerUser: e.target.value })} placeholder="illimité" />
            </div>
            <div>
              <label style={labelStyle} htmlFor="promo-starts">Début (option)</label>
              <input id="promo-starts" style={fieldStyle} type="datetime-local" value={draft.starts} onChange={(e) => setDraft({ ...draft, starts: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="promo-ends">Fin (option)</label>
              <input id="promo-ends" style={fieldStyle} type="datetime-local" value={draft.ends} onChange={(e) => setDraft({ ...draft, ends: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="promo-branch">Agence</label>
              <select id="promo-branch" style={fieldStyle} value={draft.branchId} onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}>
                <option value="">Toutes les agences</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {branchName.get(b.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
            <Switch checked={draft.active} onChange={(next) => setDraft({ ...draft, active: next })} label="Code actif" />
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)' }}>{draft.active ? "Actif dès l'enregistrement" : 'Enregistré inactif'}</span>
          </div>
          {error && (
            <div role="alert" style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--a-accent)', marginTop: 12 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <PrimaryButton onClick={save} disabled={busy}>
              {busy ? '…' : 'Enregistrer'}
            </PrimaryButton>
            <GhostButton
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
              disabled={busy}
            >
              Annuler
            </GhostButton>
          </div>
        </GlassPanel>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: 22, alignItems: 'start' }}>
        <GlassPanel padding={0}>
          <div style={{ padding: '20px 22px 6px' }}>
            <PanelTitle aside={`${promos.length} code${promos.length > 1 ? 's' : ''}`}>Codes</PanelTitle>
          </div>
          {promos.length === 0 ? (
            <EmptyState title="Aucun code promo." hint="Créez un premier code — par exemple BIENVENUE10 pour 10 % sur une première commande." />
          ) : (
            promos.map((p) => {
              const n = uses[p.id] ?? 0;
              const state = promoState(p, n);
              const ratio = usageRatio(n, p.max_uses);
              return (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 170px auto', alignItems: 'center', gap: 16, padding: '16px 22px', borderTop: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="tag" size={18} color="var(--ink)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, letterSpacing: 0.6, color: 'var(--ink)' }}>{p.code}</span>
                        <span style={{ ...STATE_STYLE[state], fontFamily: 'var(--ui-font)', fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999 }}>{PROMO_STATE_LABEL[state]}</span>
                      </div>
                      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.type === 'percent' ? `${p.value} %` : formatDH(p.value)}
                        {p.min_order_dh > 0 ? ` · dès ${formatDH(p.min_order_dh)}` : ''} · {period(p)} · {p.branch_id ? branchName.get(p.branch_id) ?? 'agence' : 'toutes agences'}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>
                      {n}
                      {p.max_uses != null ? ` / ${p.max_uses}` : ''} utilisation{n > 1 ? 's' : ''}
                      {ratio === null ? ' · illimité' : ''}
                    </div>
                    {ratio !== null && <Meter ratio={ratio} label={`${p.code} : ${n} sur ${p.max_uses} utilisations`} />}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Switch checked={p.active} onChange={(next) => toggleActive(p, next)} label={`${p.active ? 'Désactiver' : 'Activer'} le code ${p.code}`} disabled={rowBusy === p.id} />
                    <GhostButton onClick={() => setDraft(toDraft(p))}>Modifier</GhostButton>
                    <GhostButton onClick={() => remove(p)} aria-label={`Supprimer le code ${p.code}`} style={{ padding: '8px 10px' }}>
                      <Icon name="x" size={14} color="var(--ink)" />
                    </GhostButton>
                  </div>
                </div>
              );
            })
          )}
        </GlassPanel>

        <GlassPanel>
          <PanelTitle>Utilisations récentes</PanelTitle>
          {recent.length === 0 ? (
            <EmptyState title="Aucune utilisation pour l'instant." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recent.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 2px', borderTop: '1px solid var(--line)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {codeById.get(r.promotionId) ?? 'Code'} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>· {r.orderCode ?? 'commande'}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>
                      {lastSeenLabel(r.createdAt)}
                      {r.orderTotal != null ? ` · ${formatDH(r.orderTotal)}` : ''}
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--a-accent)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>−{formatDH(r.discount)}</span>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
