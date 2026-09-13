// components/admin/planning/PlanningScreen.tsx
// Live container for the admin Planning screen, in the language of the Vue
// d'ensemble: headline figures for the week (shifts, hours, drivers scheduled,
// days with nobody), a notice for uncovered days, prev / today / next week
// navigation, and the driver × day grid in a glass panel with each driver's weekly
// hours and a coverage row. Subscribes to postgres_changes on driver_shifts and
// refetches on any change; writes go through staff RLS (0018): add a shift, delete
// a shift. The grid is built by lib/admin-planning.ts (UTC day buckets) so server
// and client agree.
'use client';
import { Fragment, useCallback, useMemo, useState, type CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { staffMessage } from '@/lib/order-error-messages';
import { buildShiftWeek, formatHours, isoDate, mondayOf, rowHours, weekTotals, type ShiftRow } from '@/lib/admin-planning';
import type { AdminPlanningData } from '@/lib/queries';
import type { DriverShift } from '@/lib/types';
import { ShiftForm, type ShiftDraft } from './ShiftForm';
import { useRealtime } from '@/lib/use-realtime';
import { HeroStat } from '@/components/admin/overview/HeroStat';
import { EmptyState, GhostButton, GlassPanel, Notice, PageHeader, PrimaryButton } from '@/components/admin/ui/Glass';

const text = { fontFamily: 'var(--ui-font)' } as const;

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
  const toast = useToast((t) => t.show);
  const [week, setWeek] = useState(initial.week);
  const [drivers] = useState(initial.drivers);
  const [weekStart, setWeekStart] = useState(initial.weekStart);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const refetch = useCallback(
    async (startISO: string) => {
      const monday = mondayFromISO(startISO);
      const nextMonday = new Date(monday.getTime() + 7 * 24 * 3600 * 1000);
      const { data } = await createClient().from('driver_shifts').select('*').gte('starts_at', monday.toISOString()).lt('starts_at', nextMonday.toISOString()).order('starts_at');
      setWeek(buildShiftWeek((data ?? []) as DriverShift[], drivers, monday));
    },
    [drivers],
  );

  const refetchWeek = useCallback(() => refetch(weekStart), [refetch, weekStart]);
  useRealtime('admin-planning', [{ table: 'driver_shifts' }], refetchWeek);

  const goTo = useCallback(
    (startISO: string) => {
      setWeekStart(startISO);
      refetch(startISO);
    },
    [refetch],
  );
  const shiftWeek = (deltaDays: number) => goTo(isoDate(new Date(mondayFromISO(weekStart).getTime() + deltaDays * 24 * 3600 * 1000)));

  const onAdd = useCallback(
    async (draft: ShiftDraft) => {
      setBusy(true);
      // L'erreur était ignorée et le formulaire se fermait quand même : le
      // créneau n'existait pas, la saisie était perdue, et rien ne le disait.
      const { error } = await createClient().from('driver_shifts').insert(draft);
      setBusy(false);
      if (error) {
        toast(staffMessage(error.message), 'alert');
        return; // on garde le formulaire ouvert, avec la saisie
      }
      setShowForm(false);
      refetch(weekStart);
    },
    [refetch, weekStart, toast],
  );

  const onDelete = useCallback(
    async (id: string) => {
      setBusy(true);
      const { error } = await createClient().from('driver_shifts').delete().eq('id', id);
      setBusy(false);
      if (error) toast(staffMessage(error.message), 'alert');
      refetch(weekStart);
    },
    [refetch, weekStart, toast],
  );

  const totals = useMemo(() => weekTotals(week), [week]);
  const today = isoDate(new Date());
  const currentMonday = isoDate(mondayOf(new Date()));
  const isPastWeek = weekStart < currentMonday;
  const weekLabel = `${dayHeader(week.days[0])} – ${dayHeader(week.days[6])}`;

  return (
    <div style={{ padding: '30px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Planning"
        subtitle={`Semaine du ${weekLabel}`}
        actions={
          <>
            <GhostButton onClick={() => shiftWeek(-7)} aria-label="Semaine précédente">
              ← Précédente
            </GhostButton>
            {weekStart !== currentMonday && <GhostButton onClick={() => goTo(currentMonday)}>Cette semaine</GhostButton>}
            <GhostButton onClick={() => shiftWeek(7)} aria-label="Semaine suivante">
              Suivante →
            </GhostButton>
            {!showForm && <PrimaryButton onClick={() => setShowForm(true)}>+ Ajouter un créneau</PrimaryButton>}
          </>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 56px' }}>
        <HeroStat label="Créneaux" value={String(totals.shifts)} />
        <HeroStat label="Heures planifiées" value={formatHours(totals.hours)} />
        <HeroStat label={`Livreurs planifiés · sur ${drivers.length}`} value={String(totals.drivers)} />
        <HeroStat label="Jours sans livreur" value={String(totals.uncoveredDays)} />
      </div>

      {!isPastWeek && drivers.length > 0 && totals.uncoveredDays > 0 && (
        <Notice icon="calendar">
          {totals.uncoveredDays} jour{totals.uncoveredDays > 1 ? 's' : ''} sans aucun livreur planifié cette semaine.
        </Notice>
      )}

      {showForm && <ShiftForm drivers={drivers} days={week.days} busy={busy} onAdd={onAdd} onCancel={() => setShowForm(false)} />}

      {drivers.length === 0 ? (
        <GlassPanel>
          <EmptyState title="Aucun livreur à planifier." hint="Ajoutez d'abord des livreurs dans la page Livreurs." />
        </GlassPanel>
      ) : (
        <GlassPanel padding={0} style={{ overflowX: 'auto' }}>
          <div role="table" aria-label={`Planning de la semaine du ${weekLabel}`} style={{ display: 'grid', gridTemplateColumns: '170px repeat(7, minmax(118px, 1fr)) 86px', minWidth: 1080 }}>
            <div style={headerCell} />
            {week.days.map((d) => (
              <div key={d} style={{ ...headerCell, textTransform: 'capitalize', color: d === today ? 'var(--a-text)' : 'var(--muted)', boxShadow: d === today ? 'inset 0 -2px 0 var(--a-accent)' : undefined }}>
                {dayHeader(d)}
                {d === today && <span style={{ fontWeight: 500, color: 'var(--a-accent)' }}> · aujourd&apos;hui</span>}
              </div>
            ))}
            <div style={{ ...headerCell, textAlign: 'right' }}>Total</div>

            {week.rows.map((row) => (
              <PlanningRow key={row.driver.id} row={row} busy={busy} today={today} onDelete={onDelete} />
            ))}

            <div style={{ ...footerCell, fontWeight: 600, color: 'var(--ink)' }}>Livreurs par jour</div>
            {totals.perDay.map((n, i) => (
              <div key={week.days[i]} style={{ ...footerCell, color: n === 0 ? 'var(--a-accent)' : 'var(--ink)', fontWeight: 600 }}>
                {n}
              </div>
            ))}
            <div style={{ ...footerCell, textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>{formatHours(totals.hours)}</div>
          </div>
        </GlassPanel>
      )}
    </div>
  );
}

function PlanningRow({ row, busy, today, onDelete }: { row: ShiftRow; busy: boolean; today: string; onDelete: (id: string) => void }) {
  const hours = rowHours(row);
  return (
    <Fragment>
      <div style={{ ...bodyCell, fontWeight: 600, color: 'var(--ink)', position: 'sticky', left: 0, background: 'rgba(0, 0, 0, 0.55)', zIndex: 1 }}>{row.driver.name}</div>
      {row.days.map((cell) => (
        <div key={cell.date} style={{ ...bodyCell, background: cell.date === today ? 'rgba(255, 255, 255, 0.04)' : undefined }}>
          {cell.shifts.map((s) => (
            <div key={s.id} style={{ background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 10, padding: '5px 8px', marginBottom: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ ...text, fontSize: 12, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{timeRange(s)}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDelete(s.id)}
                  aria-label={`Supprimer le créneau ${timeRange(s)} de ${row.driver.name}`}
                  style={{ border: 'none', background: 'transparent', cursor: busy ? 'default' : 'pointer', color: 'var(--muted)', fontSize: 15, lineHeight: 1, padding: 0 }}
                >
                  ×
                </button>
              </div>
              {s.note && <span style={{ ...text, fontSize: 11, color: 'var(--muted)' }}>{s.note}</span>}
            </div>
          ))}
        </div>
      ))}
      <div style={{ ...bodyCell, textAlign: 'right', fontWeight: 600, color: hours > 0 ? 'var(--ink)' : 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{hours > 0 ? formatHours(hours) : '—'}</div>
    </Fragment>
  );
}

const headerCell: CSSProperties = {
  padding: '14px 14px',
  borderBottom: '1px solid var(--line)',
  fontFamily: 'var(--ui-font)',
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--muted)',
};
const bodyCell: CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--line)',
  borderLeft: '1px solid var(--line)',
  minHeight: 64,
  fontFamily: 'var(--ui-font)',
  fontSize: 13,
};
const footerCell: CSSProperties = {
  padding: '12px 14px',
  borderLeft: '1px solid var(--line)',
  fontFamily: 'var(--ui-font)',
  fontSize: 12.5,
  color: 'var(--muted)',
  fontVariantNumeric: 'tabular-nums',
};
