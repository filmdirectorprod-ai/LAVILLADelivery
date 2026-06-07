import { describe, it, expect } from 'vitest';
import {
  buildReviewRows,
  filterReviewsByRating,
  ratingDistribution,
  averageRating,
} from '@/lib/admin-reviews';
import type { Review } from '@/lib/types';

function review(over: Partial<Review> & { id: string }): Review {
  return {
    order_id: 'o1',
    user_id: 'u1',
    rating: 5,
    tags: [],
    comment: '',
    photo_url: null,
    points_awarded: 0,
    created_at: '2026-06-07T10:00:00Z',
    ...over,
  };
}

const profiles = [
  { id: 'u1', full_name: 'Salma' },
  { id: 'u2', full_name: null },
];
const orders = [
  { id: 'o1', code: 'LV-001' },
  { id: 'o2', code: 'LV-002' },
];
const tracking = [
  { order_id: 'o1', driver_id: 'd1' },
  { order_id: 'o2', driver_id: null },
];
const drivers = [{ id: 'd1', name: 'Karim' }];

describe('buildReviewRows', () => {
  it('joins customer, order code and driver, newest first', () => {
    const reviews = [
      review({ id: 'r1', order_id: 'o2', user_id: 'u2', created_at: '2026-06-07T09:00:00Z' }),
      review({ id: 'r2', order_id: 'o1', user_id: 'u1', created_at: '2026-06-07T11:00:00Z' }),
    ];
    const rows = buildReviewRows(reviews, profiles, orders, tracking, drivers);
    expect(rows.map((r) => r.review.id)).toEqual(['r2', 'r1']); // newest first
    expect(rows[0]).toMatchObject({ customerName: 'Salma', orderCode: 'LV-001', driverName: 'Karim' });
    expect(rows[1]).toMatchObject({ customerName: null, orderCode: 'LV-002', driverName: null });
  });

  it('resolves missing links to null without dropping the review', () => {
    const reviews = [review({ id: 'r1', order_id: 'unknown', user_id: 'ghost' })];
    const rows = buildReviewRows(reviews, profiles, orders, tracking, drivers);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ customerName: null, orderCode: null, driverName: null });
  });
});

describe('filterReviewsByRating', () => {
  const rows = buildReviewRows(
    [review({ id: 'r1', rating: 5 }), review({ id: 'r2', rating: 3 }), review({ id: 'r3', rating: 5 })],
    profiles,
    orders,
    tracking,
    drivers,
  );

  it('keeps all rows when rating is null', () => {
    expect(filterReviewsByRating(rows, null)).toHaveLength(3);
  });

  it('keeps only rows of the given rating', () => {
    expect(filterReviewsByRating(rows, 5).map((r) => r.review.id).sort()).toEqual(['r1', 'r3']);
    expect(filterReviewsByRating(rows, 3)).toHaveLength(1);
    expect(filterReviewsByRating(rows, 1)).toHaveLength(0);
  });
});

describe('ratingDistribution', () => {
  it('returns five buckets from 5 down to 1', () => {
    const reviews = [review({ id: 'r1', rating: 5 }), review({ id: 'r2', rating: 5 }), review({ id: 'r3', rating: 2 })];
    expect(ratingDistribution(reviews)).toEqual([
      { rating: 5, count: 2 },
      { rating: 4, count: 0 },
      { rating: 3, count: 0 },
      { rating: 2, count: 1 },
      { rating: 1, count: 0 },
    ]);
  });
});

describe('averageRating', () => {
  it('averages all ratings', () => {
    expect(averageRating([review({ id: 'r1', rating: 5 }), review({ id: 'r2', rating: 3 })])).toBeCloseTo(4, 5);
  });
  it('returns 0 with no reviews', () => {
    expect(averageRating([])).toBe(0);
  });
});
