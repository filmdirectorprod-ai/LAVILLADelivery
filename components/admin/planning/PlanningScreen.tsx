// components/admin/planning/PlanningScreen.tsx
// Live container for the admin Planning screen. Renders the server snapshot of the
// weekly shift grid, subscribes to postgres_changes on driver_shifts and refetches
// on any change, supports prev/next week navigation, and writes through staff RLS
// (0018): add a shift, delete a shift. The grid is built by lib/admin-planning.ts
// (UTC day buckets) so server and client agree.
'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { buildShiftWeek, isoDate, type ShiftRow } from '@/lib/admin-planning';
import type { AdminPlanningData } from '@/lib/queries';
import type { DriverShift } from '@/lib/types';
import { ShiftForm, type ShiftDraft } from './ShiftForm';

function mondayFromISO(weekStart: string): Date {
  return new Date(`${weekStart}T00:00:00Z`);
}
function dayHeader(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}
function timeRange(s: DriverShift): string {
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return `${fmt(s.starts_at)}–${fmt(s.ends_at)}`;
}

export function PlanningScreen({ initial }: { initial: AdminPlanningData }) {
  const [week, setWeek] = useState(initial.week);
  const [drivers] = useState(initial.drivers);
  const [weekStart, setWeekStart] = useState(initial.weekStart);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const refetch = useCallback(
    async (startISO: string) => {
      const supabase = createClient();
      const monday = mondayFromISO(startISO);
      const nextMonday = new Date(monday.getTime() + 7 * 24 * 3600 * 1000);
      const { data } = await supabase
        .from('driver_shifts')
        .select('*')
        .gte('starts_at', monday.toISOString())
        .lt('starts_at', nextMonday.toISOString())
        .order('starts_at');
      setWeek(buildShiftWeek((data ?? []) as DriverShift[], drivers, monday));
    },
    [drivers],
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-planning')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_shifts' }, () => refetch(weekStart))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, weekStart]);

  const shiftWeek = useCallback(
    (deltaDays: number) => {
      const monday = mondayFromISO(weekStart);
      const next = isoDate(new Date(monday.getTime() + deltaDays * 24 * 3600 * 1000));
      setWeekStart(next);
      refetch(next);
    },
    [weekStart, refetch],
  );

  const onAdd = useCallback(
    async (draft: ShiftDraft) => {
      setBusy(true);
      const supabase = createClient();
      await supabase.from('driver_shifts').insert(draft);
      setBusy(false);
      setShowForm(false);
      refetch(weekStart);
    },
    [refetch, weekStart],
  );

  const onDelete = useCallback(
    async (id: string) => {
      setBusy(true);
      const supabase = createClient();
      await supabase.from('driver_shifts').delete().eq('id', id);
      setBusy(false);
      refetch(weekStart);
    },
    [refetch, weekStart],
  );

  const weekLabel = `${dayHeader(week.days[0])} – ${dayHeader(week.days[6])}`;

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Planning</h1>
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>Semaine du {weekLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={() => shiftWeek(-7)} style={navBtn}>← Précédente</button>
          <button type="button" onClick={() => shiftWeek(7)} style={navBtn}>Suivante →</button>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              style={{ border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: '#fff', background: 'var(--brand)' }}
            >
              + Ajouter un créneau
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <ShiftForm drivers={drivers} days={week.days} busy={busy} onAdd={onAdd} onCancel={() => setShowForm(false)} />
      )}

      {drivers.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: '40px 22px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>
          Aucun livreur à planifier.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid var(--line)', borderRadius: 18, boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px repeat(7, minmax(120px, 1fr))', minWidth: 1000 }}>
            <div style={headerCell} />
            {week.days.map((d) => (
              <div key={d} style={{ ...headerCell, textTransform: 'capitalize' }}>{dayHeader(d)}</div>
            ))}
            {week.rows.map((row) => (
              <PlanningRow key={row.driver.id} row={row} busy={busy} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanningRow({ row, busy, onDelete }: { row: ShiftRow; busy: boolean; onDelete: (id: string) => void }) {
  return (
    <>
      <div style={{ ...bodyCell, fontWeight: 600, color: 'var(--ink)', position: 'sticky', left: 0, background: '#fff' }}>{row.driver.name}</div>
      {row.days.map((cell) => (
        <div key={cell.date} style={bodyCell}>
          {cell.shifts.map((s) => (
            <div key={s.id} style={{ background: 'rgba(19,124,139,0.10)', borderRadius: 8, padding: '5px 8px', marginBottom: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: 'var(--brand-d)' }}>{timeRange(s)}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDelete(s.id)}
                  title="Supprimer"
                  style={{ border: 'none', background: 'transparent', cursor: busy ? 'default' : 'pointer', color: 'var(--muted)', fontSize: 14, lineHeight: 1, padding: 0 }}
                >
                  ×
                </button>
              </div>
              {s.note && <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)' }}>{s.note}</span>}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

const navBtn: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: '9px 14px',
  cursor: 'pointer',
  fontFamily: 'var(--ui-font)',
  fontWeight: 600,
  fontSize: 13,
  color: 'var(--ink)',
  background: '#fff',
};
const headerCell: React.CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid var(--line)',
  fontFamily: 'var(--ui-font)',
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--muted)',
};
const bodyCell: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--line)',
  borderLeft: '1px solid var(--line)',
  minHeight: 64,
  fontFamily: 'var(--ui-font)',
  fontSize: 13,
};
