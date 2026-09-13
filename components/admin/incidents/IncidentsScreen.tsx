// components/admin/incidents/IncidentsScreen.tsx
// Live container for the admin Incidents screen, in the language of the Vue
// d'ensemble: headline figures (open, high severity, resolved over 7 days, mean
// time to resolve), a notice for high-severity incidents, severity and type chips,
// then "À traiter" and "Résolus" panels. Subscribes to postgres_changes on
// incidents and refetches on any change; writes go through the staff RLS (0018):
// inserting a new incident and flipping one to resolved. Ordering/joins come from
// lib/admin-incidents.ts.
'use client';
import { useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { staffMessage } from '@/lib/order-error-messages';
import { INCIDENT_KIND_LABEL, SEVERITY_LABEL, buildIncidentRows, filterIncidentRows, incidentTotals, partitionIncidentRows } from '@/lib/admin-incidents';
import type { AdminIncidentsData } from '@/lib/queries';
import type { Incident, IncidentSeverity } from '@/lib/types';
import { IncidentCard } from './IncidentCard';
import { IncidentForm, type IncidentDraft } from './IncidentForm';
import { useRealtime } from '@/lib/use-realtime';
import { HeroStat } from '@/components/admin/overview/HeroStat';
import { Chip, EmptyState, GlassPanel, Notice, PageHeader, PanelTitle, PrimaryButton } from '@/components/admin/ui/Glass';

const SEVERITIES: IncidentSeverity[] = ['haute', 'moyenne', 'basse'];
const oneDecimal = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export function IncidentsScreen({ initial }: { initial: AdminIncidentsData }) {
  const toast = useToast((t) => t.show);
  const [rows, setRows] = useState<AdminIncidentsData['rows']>(initial.rows);
  const [drivers, setDrivers] = useState(initial.drivers);
  const [orders, setOrders] = useState(initial.orders);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [severity, setSeverity] = useState<IncidentSeverity | 'all'>('all');
  const [kind, setKind] = useState('all');

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

  useRealtime('admin-incidents', [{ table: 'incidents' }], refetch);

  const onCreate = useCallback(
    async (draft: IncidentDraft) => {
      setBusy(true);
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('incidents').insert({
        title: draft.title,
        kind: draft.kind,
        severity: draft.severity,
        detail: draft.detail,
        driver_id: draft.driver_id,
        order_id: draft.order_id,
        created_by: auth.user?.id ?? null,
      });
      setBusy(false);
      // Le formulaire se fermait même en cas d'échec : l'incident n'était nulle
      // part, et le texte saisi était perdu.
      if (error) {
        toast(staffMessage(error.message), 'alert');
        return;
      }
      setShowForm(false);
      refetch();
    },
    [refetch, toast],
  );

  const onResolve = useCallback(
    async (id: string) => {
      setBusy(true);
      const { error } = await createClient()
        .from('incidents')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', id);
      setBusy(false);
      if (error) toast(staffMessage(error.message), 'alert');
      refetch();
    },
    [refetch, toast],
  );

  const totals = useMemo(() => incidentTotals(rows), [rows]);
  const kinds = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) seen.set(r.incident.kind, (seen.get(r.incident.kind) ?? 0) + 1);
    return Array.from(seen.entries());
  }, [rows]);
  const severityCounts = useMemo(() => {
    const c: Record<IncidentSeverity, number> = { haute: 0, moyenne: 0, basse: 0 };
    for (const r of rows) c[r.incident.severity] += 1;
    return c;
  }, [rows]);
  const { open, resolved } = useMemo(() => partitionIncidentRows(filterIncidentRows(rows, severity, kind)), [rows, severity, kind]);

  return (
    <div style={{ padding: '30px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Incidents"
        subtitle="Retards, litiges et accidents signalés sur les livraisons."
        actions={!showForm ? <PrimaryButton onClick={() => setShowForm(true)}>+ Signaler un incident</PrimaryButton> : undefined}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 56px' }}>
        <HeroStat label={`Ouverts · ${rows.length} au total`} value={String(totals.open)} />
        <HeroStat label="Gravité haute" value={String(totals.high)} />
        <HeroStat label="Résolus · 7 jours" value={String(totals.resolvedWeek)} />
        <HeroStat label="Délai moyen de résolution" value={totals.avgResolutionHours === null ? '—' : oneDecimal(totals.avgResolutionHours)} unit={totals.avgResolutionHours === null ? undefined : 'h'} />
      </div>

      {totals.high > 0 && (
        <Notice icon="flame">
          {totals.high} incident{totals.high > 1 ? 's' : ''} de gravité haute à traiter.
        </Notice>
      )}

      {showForm && <IncidentForm drivers={drivers} orders={orders} busy={busy} onCreate={onCreate} onCancel={() => setShowForm(false)} />}

      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div role="group" aria-label="Filtrer par gravité" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Chip on={severity === 'all'} onClick={() => setSeverity('all')} count={rows.length}>
              Toutes gravités
            </Chip>
            {SEVERITIES.map((s) => (
              <Chip key={s} on={severity === s} onClick={() => setSeverity(s)} count={severityCounts[s]}>
                {SEVERITY_LABEL[s]}
              </Chip>
            ))}
          </div>
          <div role="group" aria-label="Filtrer par type" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Chip on={kind === 'all'} onClick={() => setKind('all')}>
              Tous types
            </Chip>
            {kinds.map(([k, n]) => (
              <Chip key={k} on={kind === k} onClick={() => setKind(k)} count={n}>
                {INCIDENT_KIND_LABEL[k] ?? k}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <GlassPanel>
        <PanelTitle aside={`${open.length} incident${open.length > 1 ? 's' : ''}`}>À traiter</PanelTitle>
        {open.length === 0 ? (
          <EmptyState title="Aucun incident ouvert." hint={severity !== 'all' || kind !== 'all' ? 'Pour ces filtres.' : 'Tout est sous contrôle.'} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, alignItems: 'start' }}>
            {open.map((row) => (
              <IncidentCard key={row.incident.id} row={row} busy={busy} onResolve={onResolve} />
            ))}
          </div>
        )}
      </GlassPanel>

      {resolved.length > 0 && (
        <GlassPanel>
          <PanelTitle aside={`${resolved.length} incident${resolved.length > 1 ? 's' : ''}`}>Résolus</PanelTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, alignItems: 'start' }}>
            {resolved.map((row) => (
              <IncidentCard key={row.incident.id} row={row} busy={busy} onResolve={onResolve} />
            ))}
          </div>
        </GlassPanel>
      )}
    </div>
  );
}
