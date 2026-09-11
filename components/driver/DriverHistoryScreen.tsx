// Historique — toutes les livraisons terminées, de la plus récente à la plus
// ancienne (driver_deliveries). Présentationnel, rendu côté serveur : aucun
// état client. Depuis 0054, chaque ligne dit si la course a été encaissée en
// espèces — c'est ce qui alimente le total à remettre à l'agence.
import { formatDH } from '@/lib/format';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import type { DriverDelivery } from '@/lib/queries';
import { EmptyLine, Figure, Panel, Pill, text } from '@/components/driver/ui/DriverUI';

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function DriverHistoryScreen({ deliveries }: { deliveries: DriverDelivery[] }) {
  const gains = deliveries.reduce((n, d) => n + (d.delivery_fee_dh ?? 0), 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <div style={{ padding: `${SAFE_TOP + 10}px 16px 0` }}>
        <h1 style={{ ...text, margin: 0, fontWeight: 600, fontSize: 27, letterSpacing: '-0.02em', color: 'var(--a-text)' }}>Historique</h1>
        <p style={{ ...text, fontSize: 13, color: 'var(--a-muted)', margin: '4px 0 0' }}>Vos livraisons terminées.</p>
      </div>

      <div style={{ display: 'flex', gap: 24, padding: '20px 16px 0', flexWrap: 'wrap' }}>
        <Figure label="Livraisons" value={String(deliveries.length)} />
        <Figure label="Gains cumulés" value={formatDH(gains).replace(' DH', '')} unit="DH" />
      </div>

      <div style={{ padding: `18px 16px ${SAFE_BOTTOM + 16}px`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {deliveries.length === 0 ? (
          <EmptyLine title="Aucune livraison terminée." hint="Vos courses closes s’afficheront ici." />
        ) : (
          deliveries.map((d) => {
            const isDelivery = d.mode === 'livraison';
            // Un retrait est réglé en boutique : le livreur n'encaisse que les livraisons.
            const cash = isDelivery && (d.payment_method ?? 'cod') === 'cod';
            return (
              <Panel key={d.order_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 13, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={isDelivery ? 'scooter' : 'store'} size={19} color="var(--ink)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ ...text, fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{d.code}</span>
                    {cash && <Pill tone="accent">Espèces</Pill>}
                  </div>
                  <div style={{ ...text, fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {formatDay(d.delivered_at)} · {formatTime(d.delivered_at)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ ...text, fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{formatDH(d.total_dh)}</div>
                  <div style={{ ...text, fontSize: 12, color: 'var(--a-accent)', fontWeight: 600 }}>+{formatDH(d.delivery_fee_dh)}</div>
                </div>
              </Panel>
            );
          })
        )}
      </div>
    </div>
  );
}
