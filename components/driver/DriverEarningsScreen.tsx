// Driver earnings — derived entirely from completed deliveries. The driver earns
// each order's delivery fee (delivery_fee_dh); retrait/pickup orders carry a 0
// fee and so contribute 0. We sum that fee bucketed by when the order was
// delivered (delivered_at) into today / this week / all-time. Presentational +
// server-renderable: no hooks, no client state.
import { formatDH } from '@/lib/format';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import type { DriverDelivery } from '@/lib/queries';

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Monday-based start of the current week.
function startOfWeek(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function DriverEarningsScreen({ deliveries }: { deliveries: DriverDelivery[] }) {
  const todayStart = startOfToday();
  const weekStart = startOfWeek();

  let today = 0;
  let week = 0;
  let total = 0;
  let todayCount = 0;
  for (const d of deliveries) {
    const fee = d.delivery_fee_dh ?? 0;
    const t = Date.parse(d.delivered_at);
    total += fee;
    if (t >= weekStart) week += fee;
    if (t >= todayStart) {
      today += fee;
      todayCount += 1;
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: `${SAFE_TOP + 6}px 16px 18px`, background: 'var(--brand-d)' }}>
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Livreur</div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 22, color: '#fff', margin: '2px 0 14px' }}>
          Gains
        </h1>

        {/* Hero — today */}
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: '16px 18px' }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>
            Aujourd’hui
          </div>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 800, fontSize: 32, color: '#fff', lineHeight: 1.1 }}>
            {formatDH(today)}
          </div>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            {todayCount} livraison{todayCount > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `16px 16px ${SAFE_BOTTOM + 16}px` }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <Card icon="calendar" label="Cette semaine" value={formatDH(week)} />
          <Card icon="cash" label="Total" value={formatDH(total)} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15.5, color: 'var(--ink)', margin: 0 }}>
            Livraisons
          </h2>
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>
            {deliveries.length}
          </span>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: '4px 16px',
          }}
        >
          <Row label="Livraisons terminées" value={String(deliveries.length)} />
          <Row
            label="Gain moyen / livraison"
            value={formatDH(deliveries.length ? total / deliveries.length : 0)}
            last
          />
        </div>

        <div
          style={{
            fontFamily: 'var(--ui-font)',
            fontSize: 11.5,
            color: 'var(--muted)',
            marginTop: 12,
            lineHeight: 1.5,
          }}
        >
          Les gains correspondent aux frais de livraison encaissés. Les commandes en retrait ne génèrent pas de
          frais de livraison.
        </div>
      </div>
    </div>
  );
}

function Card({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: 14 }}>
      <Icon name={icon} size={20} color="var(--brand)" />
      <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: 'var(--ink)', marginTop: 8 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: last ? 'none' : '1px solid var(--line)',
      }}
    >
      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}
