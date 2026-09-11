// components/admin/reviews/ReviewCard.tsx
// One review: star rating, date, customer + order code + driver, the comment, and
// any tags. Pure presentational — all data is prop-driven.
import { Icon } from '@/components/ui/Icon';
import type { ReviewRow } from '@/lib/admin-reviews';
import { GlassPanel, Pill } from '@/components/admin/ui/Glass';

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Casablanca' });
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }} role="img" aria-label={`${rating} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={15} color={i <= rating ? 'var(--a-accent)' : 'rgba(255, 255, 255, 0.25)'} fill={i <= rating} />
      ))}
    </span>
  );
}

export interface ReviewCardProps {
  row: ReviewRow;
}

export function ReviewCard({ row }: ReviewCardProps) {
  const { review, customerName, orderCode, driverName } = row;
  const text = { fontFamily: 'var(--ui-font)' } as const;
  return (
    <GlassPanel style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Stars rating={review.rating} />
        <span style={{ ...text, fontSize: 12, color: 'var(--muted)' }}>{dateLabel(review.created_at)}</span>
      </div>

      <div style={{ ...text, fontSize: 13, color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{customerName || 'Client'}</span>
        {orderCode && <span>· {orderCode}</span>}
        {driverName && <span>· Livré par {driverName}</span>}
      </div>

      {review.comment && <p style={{ ...text, fontSize: 14, color: 'var(--ink)', margin: 0, lineHeight: 1.55 }}>« {review.comment} »</p>}

      {review.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {review.tags.map((tag) => (
            <Pill key={tag} tone="outline">
              {tag}
            </Pill>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}
