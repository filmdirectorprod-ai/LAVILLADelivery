// Driver delivery history — a flat, reverse-chronological list of every
// completed delivery (from getDriverDeliveries / driver_deliveries RPC).
// Presentational + server-renderable: no hooks, no client state.
import { formatDH } from '@/lib/format';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import type { DriverDelivery } from '@/lib/queries';

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function DriverHistoryScreen({ deliveries }: { deliveries: DriverDelivery[] }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: `${SAFE_TOP + 6}px 16px 16px`, background: 'linear-gradient(150deg, var(--brand), var(--brand-d))' }}>
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Livreur</div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 22, color: '#fff', margin: '2px 0 0' }}>
          Historique
        </h1>
        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
          {deliveries.length} livraison{deliveries.length > 1 ? 's' : ''} terminée{deliveries.length > 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `16px 16px ${SAFE_BOTTOM + 16}px` }}>
        {deliveries.length === 0 ? (
          <div
            style={{
              fontFamily: 'var(--ui-font)',
              fontSize: 13.5,
              color: 'var(--muted)',
              background: '#fff',
              border: '1px dashed var(--line)',
              borderRadius: 18,
              padding: '26px 16px',
              textAlign: 'center',
            }}
          >
            Aucune livraison terminée pour l’instant.
          </div>
        ) : (
          deliveries.map((d) => {
            const isDelivery = d.mode === 'livraison';
            return (
              <div
                key={d.order_id}
                style={{
                  background: '#fff',
                  border: '1px solid var(--line)',
                  borderRadius: 18,
                  padding: 14,
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)',
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: 'var(--soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={isDelivery ? 'scooter' : 'store'} size={20} color="var(--brand)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
                    {d.code}
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
                    {formatDay(d.delivered_at)} · {formatTime(d.delivered_at)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                    {formatDH(d.total_dh)}
                  </div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--brand)', fontWeight: 600 }}>
                    +{formatDH(d.delivery_fee_dh)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
