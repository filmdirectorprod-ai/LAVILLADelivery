// Tournée — performance du jour et cumuls, dans la langue de l'admin. Tout est
// dérivé de données réelles : livraisons terminées (driver_deliveries) et avis
// clients (driver_reviews). Le livreur gagne les frais de livraison de chaque
// course (0 en retrait).
//
// Honnête sur le schéma : pas de colonne pourboire, pas de distance ni de durée
// stockée — cet écran n'invente donc ni « pourboires » ni « temps moyen ». Il
// ajoute en revanche, depuis 0054, les espèces encaissées à remettre à l'agence.
import { formatDH } from '@/lib/format';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import type { DriverDelivery, DriverReview } from '@/lib/queries';
import { EmptyLine, Figure, Notice, Panel, SectionTitle, StatTile, text } from '@/components/driver/ui/DriverUI';

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - day);
  return d.getTime();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function DriverEarningsScreen({
  driverName,
  deliveries,
  reviews,
}: {
  driverName: string;
  deliveries: DriverDelivery[];
  reviews: DriverReview[];
}) {
  const todayStart = startOfToday();
  const weekStart = startOfWeek();

  let today = 0;
  let week = 0;
  let total = 0;
  let todayCount = 0;
  // Espèces encaissées aujourd'hui : à remettre à l'agence en fin de tournée.
  let cashToday = 0;
  let cashCount = 0;
  const byHour = new Map<number, number>();

  for (const d of deliveries) {
    const fee = d.delivery_fee_dh ?? 0;
    const ts = Date.parse(d.delivered_at);
    total += fee;
    if (ts >= weekStart) week += fee;
    if (ts >= todayStart) {
      today += fee;
      todayCount += 1;
      if ((d.payment_method ?? 'cod') === 'cod') {
        cashToday += d.total_dh ?? 0;
        cashCount += 1;
      }
    }
    const h = new Date(ts).getHours();
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <div style={{ padding: `${SAFE_TOP + 10}px 16px 0` }}>
        <h1 style={{ ...text, margin: 0, fontWeight: 600, fontSize: 27, letterSpacing: '-0.02em', color: 'var(--a-text)' }}>Tournée</h1>
        <p style={{ ...text, fontSize: 13, color: 'var(--a-muted)', margin: '4px 0 0' }}>{driverName}</p>
      </div>

      <div style={{ display: 'flex', gap: 24, padding: '20px 16px 0', flexWrap: 'wrap' }}>
        <Figure label="Gains du jour" value={formatDH(today).replace(' DH', '')} unit="DH" />
        <Figure label="Courses du jour" value={String(todayCount)} />
      </div>

      <div style={{ padding: `18px 16px ${SAFE_BOTTOM + 16}px`, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {cashToday > 0 && (
          <Notice icon="cash">
            {formatDH(cashToday)} à remettre à l’agence — encaissé en espèces sur {cashCount} course{cashCount > 1 ? 's' : ''}.
          </Notice>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <StatTile label="Courses" value={String(deliveries.length)} />
          <StatTile label="Cette semaine" value={formatDH(week).replace(' DH', '')} unit="DH" />
          <StatTile label="Total" value={formatDH(total).replace(' DH', '')} unit="DH" />
        </div>

        <Panel>
          <SectionTitle>Courses par heure</SectionTitle>
          <HourChart byHour={byHour} />
        </Panel>

        <div>
          <SectionTitle aside={reviews.length ? `${reviews.length} avis` : undefined}>Mes évaluations clients</SectionTitle>
          {reviews.length === 0 ? (
            <EmptyLine title="Aucune évaluation pour l’instant." hint="Les avis des clients livrés apparaissent ici." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reviews.map((r) => (
                <ReviewRow key={r.review_id} review={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HourChart({ byHour }: { byHour: Map<number, number> }) {
  const hours = Array.from(byHour.keys()).sort((a, b) => a - b);
  if (hours.length === 0) {
    return <div style={{ ...text, fontSize: 13, color: 'var(--muted)', padding: '6px 0' }}>Pas encore de course livrée.</div>;
  }
  const max = Math.max(...Array.from(byHour.values()));
  const peak = hours.reduce((best, h) => ((byHour.get(h) ?? 0) > (byHour.get(best) ?? 0) ? h : best), hours[0]);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 130 }}>
      {hours.map((h) => {
        const count = byHour.get(h) ?? 0;
        const pct = max ? count / max : 0;
        return (
          <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ ...text, fontSize: 11.5, fontWeight: 600, color: 'var(--ink)' }}>{count}</span>
            <div
              style={{
                width: '100%',
                maxWidth: 28,
                height: Math.max(6, Math.round(pct * 84)),
                borderRadius: 7,
                background: h === peak ? 'var(--a-accent)' : 'rgba(255,255,255,0.55)',
              }}
            />
            <span style={{ ...text, fontSize: 11, color: 'var(--muted)' }}>{h}h</span>
          </div>
        );
      })}
    </div>
  );
}

function ReviewRow({ review }: { review: DriverReview }) {
  const meta = [...review.tags, formatDate(review.created_at)].filter(Boolean).join(' · ');
  return (
    <Panel style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="user" size={19} color="var(--muted)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...text, fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>{review.customer_name}</div>
        <div style={{ ...text, fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</div>
      </div>
      <span style={{ ...text, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 14, color: 'var(--ink)', flexShrink: 0 }}>
        <Icon name="star" size={15} color="var(--a-accent)" fill />
        {review.rating}
      </span>
    </Panel>
  );
}
