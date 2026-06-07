// components/admin/reviews/ReviewsScreen.tsx
// Live container for the admin Avis clients screen. Renders the server snapshot of
// joined reviews, subscribes to postgres_changes on reviews and refetches the
// same raw shapes on any change, and offers a star-rating filter. All joins and
// the rating filter/distribution come from lib/admin-reviews.ts so server and
// client agree.
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/ui/Icon';
import {
  buildReviewRows,
  filterReviewsByRating,
  ratingDistribution,
  averageRating,
} from '@/lib/admin-reviews';
import type { AdminReviewsData } from '@/lib/queries';
import type { Review } from '@/lib/types';
import { ReviewCard } from './ReviewCard';

export function ReviewsScreen({ initial }: { initial: AdminReviewsData }) {
  const [rows, setRows] = useState<AdminReviewsData['rows']>(initial.rows);
  const [rating, setRating] = useState<number | null>(null);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data: reviews } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });
    const list = (reviews ?? []) as Review[];
    const [profilesRes, ordersRes, trackingRes, driversRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name'),
      supabase.from('orders').select('id, code'),
      supabase.from('order_tracking').select('order_id, driver_id').not('driver_id', 'is', null),
      supabase.from('drivers').select('id, name'),
    ]);
    setRows(
      buildReviewRows(
        list,
        (profilesRes.data ?? []) as { id: string; full_name: string | null }[],
        (ordersRes.data ?? []) as { id: string; code: string }[],
        (trackingRes.data ?? []) as { order_id: string; driver_id: string | null }[],
        (driversRes.data ?? []) as { id: string; name: string }[],
      ),
    );
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-reviews')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const allReviews = useMemo(() => rows.map((r) => r.review), [rows]);
  const distribution = useMemo(() => ratingDistribution(allReviews), [allReviews]);
  const avg = useMemo(() => averageRating(allReviews), [allReviews]);
  const maxBucket = useMemo(() => distribution.reduce((m, b) => Math.max(m, b.count), 0), [distribution]);
  const visible = useMemo(() => filterReviewsByRating(rows, rating), [rows, rating]);

  const chip = (active: boolean): React.CSSProperties => ({
    fontFamily: 'var(--ui-font)',
    fontSize: 13,
    fontWeight: 600,
    padding: '7px 14px',
    borderRadius: 999,
    border: '1px solid var(--line)',
    cursor: 'pointer',
    background: active ? 'var(--brand)' : '#fff',
    color: active ? '#fff' : 'var(--ink)',
  });

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Avis clients</h1>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
          {allReviews.length === 0
            ? 'Aucun avis pour le moment'
            : `Note moyenne ${avg.toFixed(1)} / 5 · ${allReviews.length} avis`}
        </p>
      </div>

      {/* Summary: big average + distribution bars */}
      {allReviews.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)', padding: '20px 24px', display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 28, alignItems: 'center' }}>
          <div style={{ textAlign: 'center', minWidth: 120 }}>
            <div style={{ fontFamily: 'var(--font-display, var(--ui-font))', fontWeight: 700, fontSize: 46, lineHeight: 1, color: 'var(--ink)' }}>{avg.toFixed(1)}</div>
            <div style={{ display: 'inline-flex', gap: 2, marginTop: 8 }} aria-label={`${avg.toFixed(1)} sur 5`}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Icon key={i} name="star" size={16} color={i <= Math.round(avg) ? 'var(--gold)' : 'var(--line)'} fill={i <= Math.round(avg)} />
              ))}
            </div>
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
              {allReviews.length} avis
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {distribution.map((b) => (
              <div key={b.rating} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', width: 26 }}>{b.rating}★</span>
                <div style={{ flex: 1, height: 9, borderRadius: 999, background: 'var(--soft)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, background: 'var(--gold)', width: maxBucket > 0 ? `${(b.count / maxBucket) * 100}%` : '0%' }} />
                </div>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', width: 28, textAlign: 'right' }}>{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" onClick={() => setRating(null)} style={chip(rating === null)}>
          Tous
        </button>
        {distribution.map((b) => (
          <button key={b.rating} type="button" onClick={() => setRating(b.rating)} style={chip(rating === b.rating)}>
            {b.rating}★ ({b.count})
          </button>
        ))}
      </div>

      {allReviews.length > 0 && (
        <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', margin: '2px 0 0' }}>
          Évaluations des clients par les livreurs
        </h2>
      )}

      {visible.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: '40px 22px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
          Aucun avis {rating !== null ? `à ${rating} étoile${rating > 1 ? 's' : ''}` : ''}.
        </div>
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
