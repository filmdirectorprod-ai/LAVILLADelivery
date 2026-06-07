// components/admin/zones/ZonesScreen.tsx
// Live container for the admin Zones de livraison screen. Renders the server
// snapshot, subscribes to postgres_changes on delivery_zones and refetches on any
// change, and drives create/edit/delete through the admin_upsert_zone /
// admin_delete_zone RPCs (0017). Sorting comes from lib/admin-zones.ts. Because
// zones feed the customer checkout fee/ETA, edits here reach the client app live.
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDH } from '@/lib/format';
import { sortZones, type ZoneDraft } from '@/lib/admin-zones';
import type { AdminZonesData } from '@/lib/queries';
import type { Zone } from '@/lib/types';
import { ZoneEditor } from './ZoneEditor';

type EditState = { mode: 'new' } | { mode: 'edit'; zone: Zone } | null;

export function ZonesScreen({ initial }: { initial: AdminZonesData }) {
  const [zones, setZones] = useState<Zone[]>(initial.zones);
  const [edit, setEdit] = useState<EditState>(null);
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from('delivery_zones').select('*').order('fee_dh');
    setZones((data ?? []) as Zone[]);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-zones')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_zones' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const onSave = useCallback(
    async (draft: ZoneDraft, id: string | null) => {
      setBusy(true);
      const supabase = createClient();
      await supabase.rpc('admin_upsert_zone', {
        p_id: id,
        p_name: draft.name,
        p_fee_dh: draft.fee_dh,
        p_eta_min: draft.eta_min,
        p_eta_max: draft.eta_max,
      });
      setBusy(false);
      setEdit(null);
      refetch();
    },
    [refetch],
  );

  const onDelete = useCallback(
    async (zone: Zone) => {
      setBusy(true);
      const supabase = createClient();
      await supabase.rpc('admin_delete_zone', { p_id: zone.id });
      setBusy(false);
      refetch();
    },
    [refetch],
  );

  const sorted = useMemo(() => sortZones(zones), [zones]);

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Zones de livraison</h1>
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
            {zones.length} zone{zones.length > 1 ? 's' : ''} configurée{zones.length > 1 ? 's' : ''}
          </p>
        </div>
        {edit === null && (
          <button
            type="button"
            onClick={() => setEdit({ mode: 'new' })}
            style={{ border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: '#fff', background: 'var(--brand)' }}
          >
            + Ajouter une zone
          </button>
        )}
      </div>

      {edit !== null && (
        <ZoneEditor
          zone={edit.mode === 'edit' ? edit.zone : null}
          busy={busy}
          onSave={onSave}
          onCancel={() => setEdit(null)}
        />
      )}

      {sorted.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: '40px 22px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
          Aucune zone de livraison.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
          {sorted.map((zone) => (
            <div
              key={zone.id}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto auto', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}
            >
              <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{zone.name}</div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{formatDH(zone.fee_dh)}</div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>{zone.eta_min}–{zone.eta_max} min</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEdit({ mode: 'edit', zone })}
                  style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 12px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', background: '#fff' }}
                >
                  Modifier
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDelete(zone)}
                  style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 12px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: '#c0392b', background: '#fff' }}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
