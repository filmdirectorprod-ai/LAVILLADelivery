// components/admin/zones/ZonesScreen.tsx
// Live container for the admin Zones de livraison screen, in the language of the
// Vue d'ensemble: headline figures (zones, mean fee, fee range, mean delivery
// time), then the zones in a glass panel with their agency, whether a boundary is
// drawn, the fee against the most expensive zone and the delivery window. Drives
// create/edit/delete through the admin_upsert_zone / admin_delete_zone RPCs
// (0017), subscribes to postgres_changes on delivery_zones and refetches on any
// change. Zones feed the customer checkout fee/ETA, so edits here reach the client
// app live.
'use client';
import { useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { staffMessage } from '@/lib/order-error-messages';
import { formatDH } from '@/lib/format';
import { sortZones, zoneTotals, type ZoneDraft } from '@/lib/admin-zones';
import { useBranches } from '@/lib/use-branches';
import type { AdminZonesData } from '@/lib/queries';
import type { Zone } from '@/lib/types';
import { ZoneEditor } from './ZoneEditor';
import { useRealtime } from '@/lib/use-realtime';
import { revalidateCatalogue } from '@/lib/revalidate-catalogue';
import { Icon } from '@/components/ui/Icon';
import { HeroStat } from '@/components/admin/overview/HeroStat';
import { EmptyState, GhostButton, GlassPanel, IconTile, Meter, PageHeader, PanelTitle, Pill, PrimaryButton } from '@/components/admin/ui/Glass';

type EditState = { mode: 'new' } | { mode: 'edit'; zone: Zone } | null;
const text = { fontFamily: 'var(--ui-font)' } as const;

export function ZonesScreen({ initial }: { initial: AdminZonesData }) {
  const toast = useToast((t) => t.show);
  const [zones, setZones] = useState<Zone[]>(initial.zones);
  const [edit, setEdit] = useState<EditState>(null);
  const [busy, setBusy] = useState(false);
  const branches = useBranches();

  const refetch = useCallback(async () => {
    const { data } = await createClient().from('delivery_zones').select('*').order('fee_dh');
    setZones((data ?? []) as Zone[]);
  }, []);

  useRealtime('admin-zones', [{ table: 'delivery_zones' }], refetch);

  const onSave = useCallback(
    async (draft: ZoneDraft, id: string | null) => {
      setBusy(true);
      // L'éditeur se fermait même quand l'enregistrement échouait : la zone
      // restait inchangée et la saisie était perdue.
      const { error } = await createClient().rpc('admin_upsert_zone', { p_id: id, p_name: draft.name, p_fee_dh: draft.fee_dh, p_eta_min: draft.eta_min, p_eta_max: draft.eta_max });
      setBusy(false);
      if (error) {
        toast(staffMessage(error.message), 'alert');
        return;
      }
      setEdit(null);
      revalidateCatalogue();
      refetch();
    },
    [refetch, toast],
  );

  const onDelete = useCallback(
    async (zone: Zone) => {
      if (!window.confirm(`Supprimer la zone « ${zone.name} » ? Les clients de ce quartier ne pourront plus être livrés.`)) return;
      setBusy(true);
      const { error } = await createClient().rpc('admin_delete_zone', { p_id: zone.id });
      setBusy(false);
      if (error) toast(staffMessage(error.message), 'alert');
      revalidateCatalogue();
      refetch();
    },
    [refetch, toast],
  );

  const sorted = useMemo(() => sortZones(zones), [zones]);
  const totals = useMemo(() => zoneTotals(zones), [zones]);
  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name.replace(/ —.*$/, '')])), [branches]);

  return (
    <div style={{ padding: '30px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Zones de livraison"
        subtitle="Frais et délais affichés au client au moment de commander."
        actions={edit === null ? <PrimaryButton onClick={() => setEdit({ mode: 'new' })}>+ Ajouter une zone</PrimaryButton> : undefined}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 56px' }}>
        <HeroStat label="Zones" value={String(totals.count)} />
        <HeroStat label="Frais moyens" value={String(totals.avgFee)} unit="DH" />
        <HeroStat label="Du moins cher au plus cher" value={totals.count ? `${totals.minFee}–${totals.maxFee}` : '—'} unit={totals.count ? 'DH' : undefined} />
        <HeroStat label="Délai moyen" value={totals.count ? `~${totals.avgEta}` : '—'} unit={totals.count ? 'min' : undefined} />
      </div>

      {edit !== null && <ZoneEditor zone={edit.mode === 'edit' ? edit.zone : null} busy={busy} onSave={onSave} onCancel={() => setEdit(null)} />}

      <GlassPanel padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px 22px 6px' }}>
          <PanelTitle aside="du moins cher au plus cher">Zones</PanelTitle>
        </div>
        {sorted.length === 0 ? (
          <EmptyState title="Aucune zone de livraison." hint="Sans zone, les clients ne peuvent pas choisir la livraison." />
        ) : (
          sorted.map((zone) => (
            <div key={zone.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(120px, 1fr) 110px auto', alignItems: 'center', gap: 18, padding: '16px 22px', borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <IconTile name="pin" size={40} />
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ ...text, margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{zone.name}</h3>
                  <div style={{ ...text, fontSize: 12, color: 'var(--muted)', marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {branches.length > 1 && <span>{zone.branch_id ? branchName.get(zone.branch_id) ?? 'Agence' : 'Sans agence'}</span>}
                    {zone.polygon && zone.polygon.length > 2 ? <Pill tone="outline">Tracé sur la carte</Pill> : <Pill tone="muted">Sans tracé</Pill>}
                  </div>
                </div>
              </div>
              <div>
                <div style={{ ...text, fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{formatDH(zone.fee_dh)}</div>
                <Meter ratio={totals.maxFee > 0 ? zone.fee_dh / totals.maxFee : 0} label={`${zone.name} : ${zone.fee_dh} DH de frais`} />
              </div>
              <div style={{ ...text, fontSize: 13, color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="clock" size={14} color="var(--muted)" />
                {zone.eta_min}–{zone.eta_max} min
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <GhostButton disabled={busy} onClick={() => setEdit({ mode: 'edit', zone })} aria-label={`Modifier la zone ${zone.name}`}>
                  Modifier
                </GhostButton>
                <GhostButton disabled={busy} onClick={() => onDelete(zone)} aria-label={`Supprimer la zone ${zone.name}`} style={{ padding: '8px 11px' }}>
                  <Icon name="x" size={14} color="var(--ink)" />
                </GhostButton>
              </div>
            </div>
          ))
        )}
      </GlassPanel>
    </div>
  );
}
