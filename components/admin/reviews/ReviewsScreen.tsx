// components/admin/reviews/ReviewsScreen.tsx
// Live container for the admin Avis clients screen, in the language of the Vue
// d'ensemble: headline figures (average rating, reviews, share of 4-5★, reviews
// with a comment), the rating distribution, the tags customers use most (click to
// filter), the best-rated drivers, star chips and the review cards. Subscribes to
// postgres_changes on reviews and refetches the same raw shapes on any change. All
// joins and aggregates come from lib/admin-reviews.ts so server and client agree.
'use client';
import { useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/ui/Icon';
import { averageRating, buildReviewRows, driverRatings, filterReviews, positiveShare, ratingDistribution, topTags } from '@/lib/admin-reviews';
import type { AdminReviewsData } from '@/lib/queries';
import type { Review } from '@/lib/types';
import { ReviewCard } from './ReviewCard';
import { useRealtime } from '@/lib/use-realtime';
import { fetchAllIn } from '@/lib/fetch-in-chunks';
import { HeroStat } from '@/components/admin/overview/HeroStat';
import { Chip, EmptyState, GlassPanel, PageHeader, PanelTitle } from '@/components/admin/ui/Glass';

const oneDecimal = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const text = { fontFamily: 'var(--ui-font)' } as const;

export function ReviewsScreen({ initial }: { initial: AdminReviewsData }) {
  const [rows, setRows] = useState<AdminReviewsData['rows']>(initial.rows);
  const [rating, setRating] = useState<number | null>(null);
  const [tag, setTag] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data: reviews } = await supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(200);
    const list = (reviews ?? []) as Review[];
    // Bornées aux 200 avis affichés. Les requêtes ouvertes d'avant (« toutes les
    // commandes », « tous les clients ») étaient tronquées en silence à 1000
    // lignes : passé ce cap, un avis récent perdait son code de commande et son
    // livreur. Même requête que le serveur (lib/queries.ts).
    const orderIds = Array.from(new Set(list.map((r) => r.order_id).filter(Boolean)));
    const userIds = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean)));
    const [profiles, orders, tracking, driversRes] = await Promise.all([
      fetchAllIn<{ id: string; full_name: string | null }>(supabase, 'profiles', 'id, full_name', 'id', userIds),
      fetchAllIn<{ id: string; code: string }>(supabase, 'orders', 'id, code', 'id', orderIds),
      fetchAllIn<{ order_id: string; driver_id: string | null }>(
        supabase,
        'order_tracking',
        'order_id, driver_id',
        'order_id',
        orderIds,
      ),
      supabase.from('drivers').select('id, name'),
    ]);
    setRows(buildReviewRows(list, profiles, orders, tracking, (driversRes.data ?? []) as { id: string; name: string }[]));
  }, []);

  useRealtime('admin-reviews', [{ table: 'reviews' }], refetch);

  const allReviews = useMemo(() => rows.map((r) => r.review), [rows]);
  const distribution = useMemo(() => ratingDistribution(allReviews), [allReviews]);
  const avg = useMemo(() => averageRating(allReviews), [allReviews]);
  const positive = useMemo(() => positiveShare(allReviews), [allReviews]);
  const withComment = useMemo(() => allReviews.filter((r) => (r.comment ?? '').trim() !== '').length, [allReviews]);
  const tags = useMemo(() => topTags(allReviews, 10), [allReviews]);
  const drivers = useMemo(() => driverRatings(rows).slice(0, 5), [rows]);
  const maxBucket = useMemo(() => distribution.reduce((m, b) => Math.max(m, b.count), 0), [distribution]);
  const visible = useMemo(() => filterReviews(rows, rating, tag), [rows, rating, tag]);

  return (
    <div style={{ padding: '30px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader title="Avis clients" subtitle="Ce que les clients disent de leurs commandes et de leurs livraisons." />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 56px' }}>
        <HeroStat label="Note moyenne" value={allReviews.length ? oneDecimal(avg) : '—'} unit={allReviews.length ? '/ 5' : undefined} />
        <HeroStat label="Avis" value={String(allReviews.length)} />
        <HeroStat label="Avis positifs · 4 et 5★" value={positive === null ? '—' : String(positive)} unit={positive === null ? undefined : '%'} />
        <HeroStat label="Avec commentaire" value={String(withComment)} />
      </div>

      {allReviews.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 22, alignItems: 'start' }}>
          <GlassPanel>
            <PanelTitle aside={`${allReviews.length} avis`}>Répartition des notes</PanelTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {distribution.map((b) => (
                <button
                  key={b.rating}
                  type="button"
                  onClick={() => setRating(rating === b.rating ? null : b.rating)}
                  aria-label={`${b.rating} étoile${b.rating > 1 ? 's' : ''} : ${b.count} avis`}
                  aria-pressed={rating === b.rating}
                  style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr) 34px', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                >
                  <span style={{ ...text, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    {b.rating}
                    <Icon name="star" size={12} color="var(--a-accent)" fill />
                  </span>
                  <span style={{ height: 8, borderRadius: 999, background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', borderRadius: 999, background: rating === b.rating ? 'var(--a-accent)' : '#ffffff', width: maxBucket > 0 ? `${(b.count / maxBucket) * 100}%` : '0%' }} />
                  </span>
                  <span style={{ ...text, fontSize: 12.5, color: 'var(--muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{b.count}</span>
                </button>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel>
            <PanelTitle aside={tag ? 'Cliquer à nouveau pour retirer' : undefined}>Ce qui revient</PanelTitle>
            {tags.length === 0 ? (
              <EmptyState title="Aucun mot-clé pour l'instant." />
            ) : (
              <div role="group" aria-label="Filtrer par mot-clé" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tags.map((t) => (
                  <Chip key={t.tag} on={tag === t.tag} onClick={() => setTag(tag === t.tag ? null : t.tag)} count={t.count}>
                    {t.tag}
                  </Chip>
                ))}
              </div>
            )}
          </GlassPanel>

          <GlassPanel>
            <PanelTitle>Livreurs les mieux notés</PanelTitle>
            {drivers.length === 0 ? (
              <EmptyState title="Pas encore d'avis liés à un livreur." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {drivers.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <span style={{ ...text, width: 18, fontSize: 12.5, color: 'var(--muted)' }}>{i + 1}</span>
                    <span style={{ ...text, flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                    <span style={{ ...text, fontSize: 12, color: 'var(--muted)' }}>{d.count} avis</span>
                    <span style={{ ...text, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600, color: 'var(--ink)', minWidth: 46, justifyContent: 'flex-end' }}>
                      {oneDecimal(d.average)}
                      <Icon name="star" size={12} color="var(--a-accent)" fill />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        </div>
      )}

      <div role="group" aria-label="Filtrer par note" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Chip on={rating === null} onClick={() => setRating(null)} count={allReviews.length}>
          Toutes les notes
        </Chip>
        {distribution.map((b) => (
          <Chip key={b.rating} on={rating === b.rating} onClick={() => setRating(b.rating)} count={b.count}>
            {b.rating}★
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <GlassPanel>
          <EmptyState
            title={allReviews.length === 0 ? 'Aucun avis pour le moment.' : 'Aucun avis ne correspond.'}
            hint={rating !== null || tag ? 'Retirez un filtre pour voir plus d’avis.' : undefined}
          />
        </GlassPanel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18, alignItems: 'start' }}>
          {visible.map((row) => (
            <ReviewCard key={row.review.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
