// Driver "Tournée" — daily performance + lifetime stats, all derived from real
// data: completed deliveries (driver_deliveries RPC) and client reviews
// (driver_reviews RPC). The driver earns each order's delivery_fee_dh (0 for
// retrait). Pure presentational + server-renderable: no hooks, no client state.
//
// Honest about the schema: there's no tip column, no per-order distance and no
// stored delivery duration, so this screen does NOT invent "pourboires",
// "distance" or "temps moyen" — it shows what we can actually compute.
import { formatDH } from '@/lib/format';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import type { DriverDelivery, DriverReview } from '@/lib/queries';

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
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
  // Hour-of-day distribution across all deliveries (real "à quelles heures je livre").
  const byHour = new Map<number, number>();
  for (const d of deliveries) {
    const fee = d.delivery_fee_dh ?? 0;
    const ts = Date.parse(d.delivered_at);
    total += fee;
    if (ts >= weekStart) week += fee;
    if (ts >= todayStart) {
      today += fee;
      todayCount += 1;
    }
    const h = new Date(ts).getHours();
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: `${SAFE_TOP + 6}px 16px 14px`, background: 'linear-gradient(150deg, var(--brand), var(--brand-d))' }}>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 21, color: '#fff', margin: 0 }}>
          Tournée
        </h1>
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
          {driverName}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `16px 16px ${SAFE_BOTTOM + 16}px` }}>
        {/* Hero — gains du jour */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, var(--brand-d), #2c6b6b)',
            borderRadius: 20,
            padding: '20px 22px',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -30,
              right: -20,
              width: 150,
              height: 150,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
            }}
          />
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'rgba(255,255,255,0.8)' }}>
            Gains du jour
          </div>
          <div
            style={{
              fontFamily: 'var(--ui-font)',
              fontWeight: 800,
              fontSize: 38,
              color: '#fff',
              lineHeight: 1.1,
              marginTop: 4,
            }}
          >
            {formatDH(today)}
          </div>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
            {todayCount} course{todayCount > 1 ? 's' : ''} aujourd’hui
          </div>
        </div>

        {/* Stat tiles */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <Tile icon="scooter" value={String(deliveries.length)} label="Courses" />
          <Tile icon="calendar" value={formatDH(week)} label="Cette semaine" />
          <Tile icon="cash" value={formatDH(total)} label="Total" />
        </div>

        {/* Courses par heure */}
        <Card>
          <CardTitle>Courses par heure</CardTitle>
          <HourChart byHour={byHour} />
        </Card>

        <div style={{ height: 16 }} />

        {/* Évaluations clients */}
        <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 17, color: 'var(--ink)', margin: '0 0 10px 2px' }}>
          Mes évaluations clients
        </h2>
        {reviews.length === 0 ? (
          <div
            style={{
              fontFamily: 'var(--ui-font)',
              fontSize: 13.5,
              color: 'var(--muted)',
              background: '#fff',
              border: '1px dashed var(--line)',
              borderRadius: 18,
              padding: '20px 16px',
              textAlign: 'center',
            }}
          >
            Aucune évaluation pour l’instant.
          </div>
        ) : (
          reviews.map((r) => <ReviewRow key={r.review_id} review={r} />)
        )}
      </div>
    </div>
  );
}

function Tile({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div style={{ flex: 1, background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: 13, boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)' }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: 'var(--soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={18} color="var(--brand)" />
      </div>
      <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 17, color: 'var(--ink)', marginTop: 9 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{label}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: 16, boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)' }}>{children}</div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 15, color: 'var(--ink)', margin: '0 0 14px' }}>
      {children}
    </h3>
  );
}

function HourChart({ byHour }: { byHour: Map<number, number> }) {
  const hours = Array.from(byHour.keys()).sort((a, b) => a - b);
  if (hours.length === 0) {
    return (
      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)', padding: '8px 0' }}>
        Pas encore de course livrée.
      </div>
    );
  }
  const max = Math.max(...Array.from(byHour.values()));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
      {hours.map((h) => {
        const count = byHour.get(h) ?? 0;
        const pct = max ? count / max : 0;
        return (
          <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--brand)' }}>
              {count}
            </span>
            <div
              style={{
                width: '100%',
                maxWidth: 30,
                height: Math.max(6, Math.round(pct * 84)),
                borderRadius: 7,
                background: 'var(--brand)',
                opacity: 0.45 + pct * 0.55,
              }}
            />
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)' }}>{h}h</span>
          </div>
        );
      })}
    </div>
  );
}

function ReviewRow({ review }: { review: DriverReview }) {
  const meta = [...review.tags, formatDate(review.created_at)].filter(Boolean).join(' · ');
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: 14,
        marginBottom: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: 'var(--soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="user" size={19} color="var(--muted)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>
          {review.customer_name}
        </div>
        <div
          style={{
            fontFamily: 'var(--ui-font)',
            fontSize: 12.5,
            color: 'var(--muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {meta}
        </div>
      </div>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: 'var(--ui-font)',
          fontWeight: 600,
          fontSize: 14,
          color: 'var(--ink)',
          flexShrink: 0,
        }}
      >
        <Icon name="star" size={15} color="var(--brand)" />
        {review.rating}
      </span>
    </div>
  );
}
