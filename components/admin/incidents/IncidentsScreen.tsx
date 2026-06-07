// components/admin/incidents/IncidentsScreen.tsx
// Live container for the admin Incidents screen. Renders the server snapshot,
// subscribes to postgres_changes on incidents and refetches the same shapes on any
// change, and writes through the staff RLS (0018): inserting a new incident and
// flipping one to resolved. Ordering/joins come from lib/admin-incidents.ts.
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { buildIncidentRows, openIncidentCount } from '@/lib/admin-incidents';
import type { AdminIncidentsData } from '@/lib/queries';
import type { Incident } from '@/lib/types';
import { IncidentCard } from './IncidentCard';
import { IncidentForm, type IncidentDraft } from './IncidentForm';

export function IncidentsScreen({ initial }: { initial: AdminIncidentsData }) {
  const [rows, setRows] = useState<AdminIncidentsData['rows']>(initial.rows);
  const [drivers, setDrivers] = useState(initial.drivers);
  const [orders, setOrders] = useState(initial.orders);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const [incidentsRes, driversRes, ordersRes] = await Promise.all([
      supabase.from('incidents').select('*').order('created_at', { ascending: false }),
      supabase.from('drivers').select('id, name').order('name'),
      supabase.from('orders').select('id, code').order('placed_at', { ascending: false }).limit(100),
    ]);
    const d = (driversRes.data ?? []) as { id: string; name: string }[];
    const o = (ordersRes.data ?? []) as { id: string; code: string }[];
    setDrivers(d);
    setOrders(o);
    setRows(buildIncidentRows((incidentsRes.data ?? []) as Incident[], d, o));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-incidents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const onCreate = useCallback(
    async (draft: IncidentDraft) => {
      setBusy(true);
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from('incidents').insert({
        title: draft.title,
        kind: draft.kind,
        severity: draft.severity,
        detail: draft.detail,
        driver_id: draft.driver_id,
        order_id: draft.order_id,
        created_by: auth.user?.id ?? null,
      });
      setBusy(false);
      setShowForm(false);
      refetch();
    },
    [refetch],
  );

  const onResolve = useCallback(
    async (id: string) => {
      setBusy(true);
      const supabase = createClient();
      await supabase.from('incidents').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id);
      setBusy(false);
      refetch();
    },
    [refetch],
  );

  const openCount = useMemo(() => openIncidentCount(rows.map((r) => r.incident)), [rows]);

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Incidents</h1>
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
            {openCount} ouvert{openCount > 1 ? 's' : ''} · {rows.length} au total
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            style={{ border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: '#fff', background: 'var(--brand)' }}
          >
            + Signaler un incident
          </button>
        )}
      </div>

      {showForm && (
        <IncidentForm drivers={drivers} orders={orders} busy={busy} onCreate={onCreate} onCancel={() => setShowForm(false)} />
      )}

      {rows.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: '40px 22px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
          Aucun incident. Tout roule.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18, alignItems: 'start' }}>
          {rows.map((row) => (
            <IncidentCard key={row.incident.id} row={row} busy={busy} onResolve={onResolve} />
          ))}
        </div>
      )}
    </div>
  );
}
