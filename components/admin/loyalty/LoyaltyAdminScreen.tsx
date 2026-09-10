'use client';
// Admin Fidélité, in the language of the Vue d'ensemble: headline figures, the
// points earned vs spent over 30 days, the tier distribution, a searchable and
// tier-filtered member list with manual adjustments (admin_adjust_points), the
// recent points movements, and the rewards catalogue with an on/off switch.
//
// The ledger reads go through admin_loyalty_activity / admin_loyalty_flow (0053):
// loyalty_ledger is owner-only under RLS. Until 0053 is applied those sections
// say so rather than showing zero. The rewards catalogue is shared by both
// agencies, so only the super-admin can switch a reward (admin_set_reward_active).
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatAmount } from '@/lib/format';
import {
  LOYALTY_TIERS,
  TIER_THRESHOLDS,
  filterMembers,
  flowTotals,
  loyaltyOverview,
  normaliseTier,
  toFlow,
  toLedgerEntries,
  type FlowDay,
  type LedgerEntry,
  type LoyaltyMember,
  type LoyaltyTier,
} from '@/lib/admin-loyalty';
import { lastSeenLabel } from '@/lib/admin-managers';
import type { Reward } from '@/lib/types';
import { HeroStat } from '@/components/admin/overview/HeroStat';
import {
  Chip,
  EmptyState,
  GhostButton,
  GlassPanel,
  Meter,
  PageHeader,
  PanelTitle,
  PrimaryButton,
  SubPanel,
  Switch,
  fieldStyle,
} from '@/components/admin/ui/Glass';

const PAGE = 20;
const MIGRATION_HINT = 'Disponible après la migration 0053.';

export interface LoyaltyAdminScreenProps {
  members: LoyaltyMember[];
  activity: LedgerEntry[];
  flow: FlowDay[];
  rewards: Reward[];
  /** False when the 0053 ledger RPCs are not on the database yet. */
  ledgerReady: boolean;
  /** Only the super-admin may edit the shared rewards catalogue. */
  canEditRewards: boolean;
}

function Swatch({ color }: { color: string }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, marginRight: 5 }} />;
}

export function LoyaltyAdminScreen({ members: initialMembers, activity: initialActivity, flow: initialFlow, rewards: initialRewards, ledgerReady, canEditRewards }: LoyaltyAdminScreenProps) {
  const [members, setMembers] = useState<LoyaltyMember[]>(initialMembers);
  const [activity, setActivity] = useState<LedgerEntry[]>(initialActivity);
  const [flow, setFlow] = useState<FlowDay[]>(initialFlow);
  const [rewards, setRewards] = useState<Reward[]>(initialRewards);
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<LoyaltyTier | 'all'>('all');
  const [limit, setLimit] = useState(PAGE);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [rewardError, setRewardError] = useState<string | null>(null);

  const o = useMemo(() => loyaltyOverview(members), [members]);
  const totals = useMemo(() => flowTotals(flow), [flow]);
  const filtered = useMemo(() => filterMembers(members, query, tier), [members, query, tier]);
  const rank = useMemo(
    () => new Map<string, number>([...members].sort((a, b) => b.points - a.points).map((m, i) => [m.id, i + 1] as [string, number])),
    [members],
  );
  const maxFlow = Math.max(1, ...flow.map((d) => Math.max(d.earned, d.spent)));

  async function refetch() {
    const supabase = createClient();
    const [profilesRes, activityRes, flowRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, loyalty_points, loyalty_tier').order('loyalty_points', { ascending: false }),
      supabase.rpc('admin_loyalty_activity', { p_limit: 30 }),
      supabase.rpc('admin_loyalty_flow', { p_days: 30 }),
    ]);
    setMembers(
      (profilesRes.data ?? []).map((p) => {
        const r = p as { id: string; full_name: string | null; loyalty_points: number | null; loyalty_tier: string | null };
        return { id: r.id, name: r.full_name?.trim() || 'Client', points: r.loyalty_points ?? 0, tier: r.loyalty_tier };
      }),
    );
    if (!activityRes.error) setActivity(toLedgerEntries(activityRes.data));
    if (!flowRes.error) setFlow(toFlow(flowRes.data));
  }

  async function applyAdjust(userId: string) {
    const d = parseInt(delta, 10);
    if (!Number.isFinite(d) || d === 0) return;
    setBusy(true);
    await createClient().rpc('admin_adjust_points', { p_user: userId, p_delta: d, p_reason: reason });
    setBusy(false);
    setAdjusting(null);
    setDelta('');
    setReason('');
    refetch();
  }

  async function toggleReward(r: Reward, next: boolean) {
    setRewardError(null);
    setRewards((list) => list.map((x) => (x.id === r.id ? { ...x, active: next } : x)));
    const { error } = await createClient().rpc('admin_set_reward_active', { p_id: r.id, p_active: next });
    if (error) {
      setRewards((list) => list.map((x) => (x.id === r.id ? { ...x, active: r.active } : x)));
      setRewardError("La récompense n'a pas pu être modifiée.");
    }
  }

  const activeRewards = rewards.filter((r) => r.active).length;

  return (
    <div style={{ padding: '30px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader title="Fidélité" subtitle="Programme de points, paliers et récompenses — avec les ajustements manuels." />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 56px' }}>
        <HeroStat label="Membres" value={String(o.totalMembers)} />
        <HeroStat label="Points en circulation" value={formatAmount(o.totalPoints)} unit="pts" />
        <HeroStat label="Distribués · 30 jours" value={ledgerReady ? formatAmount(totals.earned) : '—'} unit={ledgerReady ? 'pts' : undefined} />
        <HeroStat label="Utilisés · 30 jours" value={ledgerReady ? formatAmount(totals.spent) : '—'} unit={ledgerReady ? 'pts' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: 22, alignItems: 'start' }}>
        <GlassPanel>
          <PanelTitle
            aside={
              ledgerReady ? (
                <span style={{ display: 'inline-flex', gap: 12 }}>
                  <span>
                    <Swatch color="rgba(255, 255, 255, 0.7)" />
                    gagnés
                  </span>
                  <span>
                    <Swatch color="var(--a-accent)" />
                    utilisés
                  </span>
                </span>
              ) : undefined
            }
          >
            Points gagnés vs utilisés · 30 jours
          </PanelTitle>
          {!ledgerReady ? (
            <EmptyState title={MIGRATION_HINT} />
          ) : totals.earned + totals.spent === 0 ? (
            <EmptyState title="Aucun mouvement de points sur 30 jours." />
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 180 }}>
              {flow.map((d) => (
                <div
                  key={d.day}
                  title={`${d.day.slice(8, 10)}/${d.day.slice(5, 7)} · +${d.earned} / −${d.spent} pts`}
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2, height: '100%' }}
                >
                  <div style={{ width: '45%', height: `${d.earned > 0 ? Math.max(4, (d.earned / maxFlow) * 170) : 2}px`, borderRadius: 4, background: d.earned > 0 ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.08)' }} />
                  <div style={{ width: '45%', height: `${d.spent > 0 ? Math.max(4, (d.spent / maxFlow) * 170) : 2}px`, borderRadius: 4, background: d.spent > 0 ? 'var(--a-accent)' : 'rgba(255, 255, 255, 0.08)' }} />
                </div>
              ))}
            </div>
          )}
        </GlassPanel>

        <GlassPanel>
          <PanelTitle>Répartition par palier</PanelTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {LOYALTY_TIERS.map((t) => (
              <div key={t}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6, fontFamily: 'var(--ui-font)', fontSize: 13 }}>
                  <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
                    {t} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· dès {formatAmount(TIER_THRESHOLDS[t])} pts</span>
                  </span>
                  <span style={{ color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{o.byTier[t]}</span>
                </div>
                <Meter ratio={o.totalMembers ? o.byTier[t] / o.totalMembers : 0} label={`${t} : ${o.byTier[t]} membre${o.byTier[t] > 1 ? 's' : ''}`} />
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: 22, alignItems: 'start' }}>
        <GlassPanel>
          <PanelTitle aside={`${filtered.length} membre${filtered.length > 1 ? 's' : ''}`}>Membres</PanelTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="Rechercher un membre…"
              aria-label="Rechercher un membre"
              style={{ ...fieldStyle, width: 'auto', flex: '1 1 220px' }}
            />
            <div role="group" aria-label="Filtrer par palier" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Chip
                on={tier === 'all'}
                onClick={() => {
                  setTier('all');
                  setLimit(PAGE);
                }}
              >
                Tous
              </Chip>
              {LOYALTY_TIERS.map((t) => (
                <Chip
                  key={t}
                  on={tier === t}
                  count={o.byTier[t]}
                  onClick={() => {
                    setTier(t);
                    setLimit(PAGE);
                  }}
                >
                  {t}
                </Chip>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="Aucun membre ne correspond." hint="Essayez un autre nom ou un autre palier." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filtered.slice(0, limit).map((mb) => (
                <div key={mb.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 26, fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{rank.get(mb.id)}</span>
                    <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mb.name}</span>
                    <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{normaliseTier(mb.tier)}</span>
                    <span style={{ minWidth: 78, textAlign: 'right', fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {formatAmount(mb.points)} pts
                    </span>
                    <GhostButton
                      onClick={() => {
                        setAdjusting(adjusting === mb.id ? null : mb.id);
                        setDelta('');
                        setReason('');
                      }}
                    >
                      Ajuster
                    </GhostButton>
                  </div>
                  {adjusting === mb.id && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="+100 / -50" aria-label="Points à ajouter ou retirer" style={{ ...fieldStyle, width: 120 }} />
                      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (ex. geste commercial)" aria-label="Motif" style={{ ...fieldStyle, width: 'auto', flex: '1 1 180px' }} />
                      <PrimaryButton onClick={() => applyAdjust(mb.id)} disabled={busy}>
                        {busy ? '…' : 'Valider'}
                      </PrimaryButton>
                    </div>
                  )}
                </div>
              ))}
              {filtered.length > limit && (
                <div style={{ paddingTop: 12, textAlign: 'center' }}>
                  <GhostButton onClick={() => setLimit((n) => n + PAGE)}>Voir plus ({filtered.length - limit})</GhostButton>
                </div>
              )}
            </div>
          )}
        </GlassPanel>

        <GlassPanel>
          <PanelTitle>Mouvements récents</PanelTitle>
          {!ledgerReady ? (
            <EmptyState title={MIGRATION_HINT} />
          ) : activity.length === 0 ? (
            <EmptyState title="Aucun mouvement pour l'instant." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 520, overflowY: 'auto' }}>
              {activity.map((e) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 2px', borderTop: '1px solid var(--line)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
                    <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.reason} · {lastSeenLabel(e.createdAt)}
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: e.delta >= 0 ? 'var(--ink)' : 'var(--a-accent)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {e.delta >= 0 ? '+' : '−'}
                    {formatAmount(Math.abs(e.delta))} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>

      <GlassPanel>
        <PanelTitle aside={canEditRewards ? `${activeRewards} active${activeRewards > 1 ? 's' : ''} sur ${rewards.length}` : 'Modifiable par le super-admin'}>
          Catalogue des récompenses
        </PanelTitle>
        {rewardError && (
          <div role="alert" style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--a-accent)', marginBottom: 12 }}>
            {rewardError}
          </div>
        )}
        {rewards.length === 0 ? (
          <EmptyState title="Aucune récompense au catalogue." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {rewards.map((r) => (
              <SubPanel key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: r.active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{r.title}</span>
                  <Switch checked={r.active} onChange={(next) => toggleReward(r, next)} label={`${r.active ? 'Désactiver' : 'Activer'} « ${r.title} »`} disabled={!canEditRewards} />
                </div>
                <div style={{ fontFamily: 'var(--ui-font)', fontSize: 28, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatAmount(r.cost_pts)} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>pts</span>
                </div>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>{r.active ? 'Échangeable' : 'Désactivée'}</span>
              </SubPanel>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
