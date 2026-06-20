'use client';
// Admin Fidélité: outstanding-points overview, tier distribution, top members, and
// manual point adjustments (admin_adjust_points) with a reason.
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loyaltyOverview, LOYALTY_TIERS, type LoyaltyMember, type LoyaltyTier } from '@/lib/admin-loyalty';

const TIER_COLOR: Record<LoyaltyTier, string> = {
  Gourmand: '#6b7280', Connaisseur: '#137c8b', Gourmet: '#0f9d6b', 'Cercle Villa': '#a07b1e',
};

export function LoyaltyAdminScreen({ members: initial }: { members: LoyaltyMember[] }) {
  const [members, setMembers] = useState<LoyaltyMember[]>(initial);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const o = useMemo(() => loyaltyOverview(members), [members]);
  const maxTier = Math.max(1, ...LOYALTY_TIERS.map((t) => o.byTier[t]));

  async function refetch() {
    const { data } = await createClient()
      .from('profiles').select('id, full_name, loyalty_points, loyalty_tier')
      .order('loyalty_points', { ascending: false });
    setMembers((data ?? []).map((p) => {
      const r = p as { id: string; full_name: string | null; loyalty_points: number | null; loyalty_tier: string | null };
      return { id: r.id, name: r.full_name?.trim() || 'Client', points: r.loyalty_points ?? 0, tier: r.loyalty_tier };
    }));
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

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1000 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Fidélité</h1>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>Programme de points & paliers · ajustements manuels.</p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', flex: 1, minWidth: 180 }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>Membres</div>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 24, fontWeight: 700, color: 'var(--ink)', marginTop: 6 }}>{o.totalMembers}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', flex: 1, minWidth: 180 }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>Points en circulation</div>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 24, fontWeight: 700, color: 'var(--brand)', marginTop: 6 }}>{o.totalPoints.toLocaleString('fr-FR')}</div>
        </div>
      </div>

      {/* Tier distribution */}
      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
        <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 16 }}>Répartition par palier</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LOYALTY_TIERS.map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 110, fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{t}</span>
              <div style={{ flex: 1, height: 16, background: 'var(--soft)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${(o.byTier[t] / maxTier) * 100}%`, height: '100%', background: TIER_COLOR[t], borderRadius: 999 }} />
              </div>
              <span style={{ width: 36, textAlign: 'right', fontFamily: 'var(--ui-font)', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{o.byTier[t]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top members + adjust */}
      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: 22 }}>
        <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 14 }}>Top membres</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {o.top.map((mb, i) => (
            <div key={mb.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 22, fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 13, color: 'var(--muted)' }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mb.name}</span>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, fontWeight: 700, color: TIER_COLOR[(LOYALTY_TIERS as readonly string[]).includes(mb.tier ?? '') ? (mb.tier as LoyaltyTier) : 'Gourmand'] }}>{mb.tier ?? 'Gourmand'}</span>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 700, color: 'var(--brand)', minWidth: 64, textAlign: 'right' }}>{mb.points} pts</span>
                <button onClick={() => { setAdjusting(adjusting === mb.id ? null : mb.id); setDelta(''); setReason(''); }} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--brand)', background: '#fff' }}>
                  Ajuster
                </button>
              </div>
              {adjusting === mb.id && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="+100 / -50" style={{ width: 110, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, fontFamily: 'var(--ui-font)', fontSize: 13 }} />
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (ex. geste commercial)" style={{ flex: 1, minWidth: 160, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, fontFamily: 'var(--ui-font)', fontSize: 13 }} />
                  <button onClick={() => applyAdjust(mb.id)} disabled={busy} style={{ border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 13, color: '#fff', background: 'var(--brand)', opacity: busy ? 0.6 : 1 }}>
                    {busy ? '…' : 'Valider'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
