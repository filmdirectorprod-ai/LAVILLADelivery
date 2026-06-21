'use client';
// PROGRAMME DE FIDÉLITÉ — paliers de statut + paliers de paiement + récompenses
// + historique. Ported from the prototype (screens-account.jsx Loyalty), driven
// by the real profile balance, the rewards catalog, and the loyalty ledger.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { LoyaltyLedgerEntry, Profile, Reward } from '@/lib/types';
import { LOYALTY_TIERS, LOYALTY_BENEFITS, REDEEM_OPTIONS, tierFor, nextTierFor } from '@/lib/constants';
import { useToast } from '@/lib/toast-store';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { Btn } from '@/components/ui/Btn';
import { SectionHead } from '@/components/ui/SectionHead';

export interface LoyaltyScreenProps {
  profile: Profile | null;
  rewards: Reward[];
  ledger: LoyaltyLedgerEntry[];
  reviewOrderId: string | null;
}

function whenLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function ledgerIcon(e: LoyaltyLedgerEntry): string {
  if (e.delta_pts < 0) return 'tag';
  if (/avis|bonus|parrain/i.test(e.reason)) return 'gift';
  return 'receipt';
}

export function LoyaltyScreen({ profile, rewards, ledger, reviewOrderId }: LoyaltyScreenProps) {
  const router = useRouter();
  const toast = useToast((s) => s.show);

  // Live points + activity: profiles & loyalty_ledger are published to Realtime
  // (0047), so a new order / admin adjustment / review bonus reflects instantly.
  const [liveProfile, setLiveProfile] = useState<Profile | null>(profile);
  const [liveLedger, setLiveLedger] = useState<LoyaltyLedgerEntry[]>(ledger);
  useEffect(() => {
    const uid = profile?.id;
    if (!uid) return;
    const supabase = createClient();
    const channel = supabase
      .channel('loyalty-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` }, (payload) => {
        setLiveProfile((p) => ({ ...(p as Profile), ...(payload.new as Partial<Profile>) }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'loyalty_ledger', filter: `user_id=eq.${uid}` }, (payload) => {
        const e = payload.new as LoyaltyLedgerEntry;
        setLiveLedger((l) => (l.some((x) => x.id === e.id) ? l : [e, ...l]));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const pts = liveProfile?.loyalty_points ?? 0;
  const tier = tierFor(pts);
  const next = nextTierFor(pts);
  const toNext = next ? next.min - pts : 0;
  const span = next ? next.min - tier.min : 1;
  const prog = next ? Math.min(1, (pts - tier.min) / span) : 1;

  const referralCode = liveProfile?.referral_code ?? '';
  async function shareReferral() {
    if (!referralCode) return;
    const link = `${window.location.origin}/parrain/${referralCode}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'La Villa', text: 'Rejoins La Villa avec mon lien et profite de La Villa !', url: link });
      } else {
        await navigator.clipboard.writeText(link);
        toast('Lien de parrainage copié !');
      }
    } catch {
      /* share cancelled */
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: `${SAFE_TOP + 4}px 16px 12px`, background: 'var(--brand-d)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/profile')} style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.16)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="left" size={20} color="#fff" />
        </button>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 19, color: '#fff', margin: 0 }}>Programme de fidélité</h1>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* points hero */}
        <div style={{ background: 'var(--brand-d)', padding: '4px 18px 26px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -20, right: -10, width: 130, height: 130, borderRadius: 999, background: 'rgba(168,151,35,0.18)' }} />
          <div style={{ position: 'relative', textAlign: 'center', padding: '10px 0 4px' }}>
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>Votre solde de points</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: 54, color: '#fff', lineHeight: 1.05, margin: '2px 0' }}>{pts.toLocaleString('fr-FR')}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, background: 'rgba(168,151,35,0.22)', border: '1px solid rgba(168,151,35,0.5)' }}>
              <Icon name="star" size={14} color="var(--gold)" fill />
              <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13, color: '#F0E4A8' }}>Palier {tier.label}</span>
            </div>
          </div>
        </div>

        {/* tier ladder */}
        <div style={{ padding: '0 18px', marginTop: -14, position: 'relative' }}>
          <div style={{ background: '#fff', borderRadius: 18, border: '1px solid var(--line)', boxShadow: '0 10px 26px -16px rgba(0,0,0,0.3)', padding: '16px 16px' }}>
            {next ? (
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)', marginBottom: 12 }}>
                Plus que <b style={{ color: 'var(--brand)' }}>{toNext} pts</b> pour le palier <b>{next.label}</b>
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)', marginBottom: 12 }}>Vous avez atteint le palier le plus élevé 🎉</div>
            )}
            <div style={{ position: 'relative', height: 6, borderRadius: 999, background: 'var(--soft)', margin: '0 6px 16px' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${prog * 100}%`, borderRadius: 999, background: 'linear-gradient(90deg, var(--gold), var(--brand))' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {LOYALTY_TIERS.map((tr) => {
                const reached = pts >= tr.min;
                const isCur = tr.label === tier.label;
                return (
                  <div key={tr.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: reached ? tr.color : 'var(--soft)', border: isCur ? '2px solid var(--ink)' : '2px solid transparent', boxShadow: isCur ? '0 0 0 3px rgba(19,124,139,0.12)' : 'none' }}>
                      <Icon name={reached ? 'star' : 'bookmark'} size={17} color={reached ? '#fff' : 'var(--muted)'} fill={reached} />
                    </div>
                    <span style={{ fontFamily: 'var(--ui-font)', fontSize: 10.5, fontWeight: isCur ? 700 : 500, color: reached ? 'var(--ink)' : 'var(--muted)', textAlign: 'center' }}>{tr.label}</span>
                    <span style={{ fontFamily: 'var(--ui-font)', fontSize: 9.5, color: 'var(--muted)' }}>{tr.min === 0 ? '0' : tr.min.toLocaleString('fr-FR')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* payer avec vos points */}
        <div style={{ padding: '22px 18px 0' }}>
          <SectionHead title="Payer avec vos points" />
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', margin: '4px 0 12px' }}>Convertissez vos points en réduction directe, dès le paiement.</p>
          <div style={{ display: 'flex', gap: 11 }}>
            {REDEEM_OPTIONS.map((r) => {
              const ok = pts >= r.pts;
              return (
                <div key={r.pts} style={{ flex: 1, borderRadius: 16, border: `1.5px solid ${r.best ? 'var(--gold)' : 'var(--line)'}`, background: r.best ? 'rgba(168,151,35,0.06)' : '#fff', padding: '14px 8px', textAlign: 'center', position: 'relative', opacity: ok ? 1 : 0.5 }}>
                  {r.best && <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', background: 'var(--gold)', color: '#fff', fontFamily: 'var(--ui-font)', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>MEILLEUR</div>}
                  <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: r.best ? 'var(--gold)' : 'var(--brand)' }}>{r.label}</div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{r.pts} pts</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 13 }}>
            <Btn full variant="gold" onClick={() => router.push('/cart')}>Utiliser au prochain paiement</Btn>
          </div>
        </div>

        {/* parrainage */}
        {referralCode && (
          <div style={{ padding: '24px 18px 0' }}>
            <SectionHead title="Parrainez vos amis" />
            <div style={{ marginTop: 12, background: 'linear-gradient(120deg, rgba(19,124,139,0.06), rgba(168,151,35,0.08))', border: '1px solid rgba(19,124,139,0.18)', borderRadius: 18, padding: '16px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(168,151,35,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="gift" size={22} color="var(--gold)" fill />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Gagnez 5 points par filleul</div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.45 }}>
                    Partagez votre lien. Dès que votre filleul reçoit sa <b>première commande</b>, vous gagnez <b style={{ color: 'var(--gold)' }}>+5 pts</b>.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
                <div style={{ flex: 1, fontFamily: 'ui-monospace, monospace', fontSize: 13, color: 'var(--ink)', background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '11px 13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  /parrain/{referralCode}
                </div>
                <Btn variant="gold" onClick={shareReferral}>Partager</Btn>
              </div>
            </div>
          </div>
        )}

        {/* récompenses */}
        {rewards.length > 0 && (
          <div style={{ padding: '24px 18px 0' }}>
            <SectionHead title="Récompenses" />
            <p style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', margin: '4px 0 13px' }}>Échangez vos points contre des gourmandises et des avantages.</p>
            <div style={{ display: 'flex', gap: 13, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
              {rewards.map((r) => {
                const ok = pts >= r.cost_pts;
                return (
                  <div key={r.id} style={{ flexShrink: 0, width: 158, background: '#fff', borderRadius: 18, border: '1px solid var(--line)', boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)', padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(19,124,139,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="gift" size={22} color="var(--brand)" fill />
                    </div>
                    <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.25, minHeight: 34 }}>{r.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <Icon name="star" size={14} color="var(--gold)" fill />
                      <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{r.cost_pts}</span>
                      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)' }}>pts</span>
                    </div>
                    <Btn size="sm" full variant={ok ? 'primary' : 'ghost'} disabled={!ok} onClick={() => toast('Échange bientôt disponible')}>
                      {ok ? 'Échanger' : 'Pts manquants'}
                    </Btn>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* laisser un avis */}
        <div style={{ padding: '22px 18px 0' }}>
          <button
            onClick={() => router.push(reviewOrderId ? `/review/${reviewOrderId}` : '/orders')}
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(168,151,35,0.4)', background: 'linear-gradient(110deg, rgba(168,151,35,0.08), rgba(19,124,139,0.05))', borderRadius: 18, padding: '16px 16px', display: 'flex', alignItems: 'center', gap: 14 }}
          >
            <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(168,151,35,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="star" size={24} color="var(--gold)" fill />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>Laisser un avis</div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>
                Notez votre dernière commande et gagnez <b style={{ color: 'var(--gold)' }}>+50 pts</b>
              </div>
            </div>
            <Icon name="right" size={18} color="var(--muted)" />
          </button>
        </div>

        {/* avantages */}
        <div style={{ padding: '22px 18px 0' }}>
          <SectionHead title="Vos avantages" />
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', marginTop: 12 }}>
            {LOYALTY_BENEFITS.map((b, i) => {
              const tierMin = LOYALTY_TIERS.find((t) => t.label === b.tier)?.min ?? 0;
              const active = pts >= tierMin;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? 'rgba(19,124,139,0.08)' : 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={b.icon} size={18} color={active ? 'var(--brand)' : 'var(--muted)'} fill={b.icon === 'star' && active} />
                  </div>
                  <span style={{ flex: 1, fontFamily: 'var(--ui-font)', fontSize: 13.5, color: active ? 'var(--ink)' : 'var(--muted)' }}>{b.label}</span>
                  {active ? (
                    <Icon name="check" size={18} color="var(--brand)" strokeWidth={2.4} />
                  ) : (
                    <span style={{ fontFamily: 'var(--ui-font)', fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', background: 'var(--soft)', padding: '3px 8px', borderRadius: 999 }}>{b.tier}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* historique */}
        {liveLedger.length > 0 && (
          <div style={{ padding: '22px 18px 0' }}>
            <SectionHead title="Activité des points" />
            <div style={{ marginTop: 8 }}>
              {liveLedger.map((h, i) => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 2px', borderBottom: i < liveLedger.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={ledgerIcon(h)} size={16} color={h.delta_pts < 0 ? 'var(--muted)' : 'var(--brand)'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.reason}</div>
                    <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)' }}>{whenLabel(h.created_at)}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: h.delta_pts < 0 ? 'var(--muted)' : 'var(--gold)' }}>{h.delta_pts > 0 ? '+' : ''}{h.delta_pts}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ height: SAFE_BOTTOM + 14 }} />
      </div>
    </div>
  );
}
