// components/admin/reviews/ReviewCard.tsx
// One review row: star rating, customer + order code + driver, the comment, and
// any tags. Pure presentational — all data is prop-driven.
import { Icon } from '@/components/ui/Icon';
import type { ReviewRow } from '@/lib/admin-reviews';

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }} aria-label={`${rating} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={15} color={i <= rating ? 'var(--gold)' : 'var(--line)'} />
      ))}
    </span>
  );
}

export interface ReviewCardProps {
  row: ReviewRow;
}

export function ReviewCard({ row }: ReviewCardProps) {
  const { review, customerName, orderCode, driverName } = row;
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 18,
        boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Stars rating={review.rating} />
        <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>{dateLabel(review.created_at)}</span>
      </div>

      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{customerName || 'Client'}</span>
        {orderCode && <span>· {orderCode}</span>}
        {driverName && <span>· Livré par {driverName}</span>}
      </div>

      {review.comment && (
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>
          {review.comment}
        </p>
      )}

      {review.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {review.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontFamily: 'var(--ui-font)',
                fontSize: 11.5,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 999,
                background: 'var(--soft)',
                color: 'var(--brand-d)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
