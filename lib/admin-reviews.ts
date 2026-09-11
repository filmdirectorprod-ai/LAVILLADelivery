// Pure, side-effect-free helpers for the admin Avis clients screen. Reviews are
// joined to their customer, order code and delivering driver here, plus the
// star-rating filter and distribution — so the same logic serves the server
// first-paint and the client realtime refetch, and stays unit testable. No React,
// no I/O.

import type { Review } from '@/lib/types';

interface NamedProfile {
  id: string;
  full_name: string | null;
}
interface CodedOrder {
  id: string;
  code: string;
}
interface TrackingLink {
  order_id: string;
  driver_id: string | null;
}
interface NamedDriver {
  id: string;
  name: string;
}

export interface ReviewRow {
  review: Review;
  customerName: string | null;
  orderCode: string | null;
  driverName: string | null;
}

/** Join every review to its customer, order code and delivering driver, newest
 *  first. Missing links resolve to null rather than dropping the review. */
export function buildReviewRows(
  reviews: Review[],
  profiles: NamedProfile[],
  orders: CodedOrder[],
  tracking: TrackingLink[],
  drivers: NamedDriver[],
): ReviewRow[] {
  const nameByUser = new Map(profiles.map((p) => [p.id, p.full_name]));
  const codeByOrder = new Map(orders.map((o) => [o.id, o.code]));
  const driverByOrder = new Map<string, string>();
  for (const t of tracking) {
    if (t.driver_id) driverByOrder.set(t.order_id, t.driver_id);
  }
  const nameByDriver = new Map(drivers.map((d) => [d.id, d.name]));

  return reviews
    .map((review) => {
      const driverId = driverByOrder.get(review.order_id);
      return {
        review,
        customerName: nameByUser.get(review.user_id) ?? null,
        orderCode: codeByOrder.get(review.order_id) ?? null,
        driverName: driverId ? nameByDriver.get(driverId) ?? null : null,
      };
    })
    .sort((a, b) => Date.parse(b.review.created_at) - Date.parse(a.review.created_at));
}

/** Keep only rows with the given star rating; `null` keeps all. */
export function filterReviewsByRating(rows: ReviewRow[], rating: number | null): ReviewRow[] {
  if (rating == null) return rows;
  return rows.filter((r) => r.review.rating === rating);
}

export interface RatingBucket {
  rating: number;
  count: number;
}

/** Count of reviews per star value, from 5 down to 1 (always five buckets). */
export function ratingDistribution(reviews: Review[]): RatingBucket[] {
  const counts = new Map<number, number>();
  for (const r of reviews) counts.set(r.rating, (counts.get(r.rating) ?? 0) + 1);
  return [5, 4, 3, 2, 1].map((rating) => ({ rating, count: counts.get(rating) ?? 0 }));
}

/** Average of all review ratings, 0 when there are none. */
export function averageRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}

/** Share of 4★ and 5★ reviews, rounded %; null without reviews. */
export function positiveShare(reviews: Review[]): number | null {
  if (reviews.length === 0) return null;
  return Math.round((reviews.filter((r) => r.rating >= 4).length / reviews.length) * 100);
}

/** Most frequent tags, most used first. */
export function topTags(reviews: Review[], n = 8): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of reviews) for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, n);
}

/** Average rating per delivering driver, best first (ties: more reviews first). */
export function driverRatings(rows: ReviewRow[]): { name: string; average: number; count: number }[] {
  const acc = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    if (!r.driverName) continue;
    const cur = acc.get(r.driverName) ?? { sum: 0, count: 0 };
    cur.sum += r.review.rating;
    cur.count += 1;
    acc.set(r.driverName, cur);
  }
  return Array.from(acc.entries())
    .map(([name, v]) => ({ name, average: Math.round((v.sum / v.count) * 10) / 10, count: v.count }))
    .sort((a, b) => b.average - a.average || b.count - a.count || a.name.localeCompare(b.name));
}

/** Rows matching a rating (null = all) and, optionally, a tag. */
export function filterReviews(rows: ReviewRow[], rating: number | null, tag: string | null): ReviewRow[] {
  return filterReviewsByRating(rows, rating).filter((r) => !tag || (r.review.tags ?? []).includes(tag));
}
