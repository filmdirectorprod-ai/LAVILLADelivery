'use client';
// Mon planning — les créneaux à venir du livreur connecté, en lecture seule.
// Le gérant les pose dans l'admin (driver_shifts, 0018) ; la RLS ne laisse voir
// que les siens. S'abonne au temps réel pour qu'un créneau ajouté ou annulé
// apparaisse sans rechargement. Le regroupement par jour vit dans
// lib/driver-planning.ts.
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { groupShiftsByDay, shiftRange } from '@/lib/driver-planning';
import { useRealtime } from '@/lib/use-realtime';
import type { DriverShift } from '@/lib/types';
import { DriverHeader, EmptyLine, Figure, Panel, SectionTitle, text } from '@/components/driver/ui/DriverUI';

function shiftHours(shift: DriverShift): number | null {
  const start = Date.parse(shift.starts_at);
  const end = Date.parse(shift.ends_at);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.round(((end - start) / 3_600_000) * 10) / 10;
}

export function DriverPlanningScreen({ initialShifts }: { initialShifts: DriverShift[] }) {
  const router = useRouter();
  const [shifts, setShifts] = useState<DriverShift[]>(initialShifts);

  const refetch = useCallback(async () => {
    const { data } = await createClient()
      .from('driver_shifts')
      .select('id, driver_id, starts_at, ends_at, note')
      .gte('ends_at', new Date().toISOString())
      .order('starts_at');
    setShifts((data ?? []) as DriverShift[]);
  }, []);

  // La RLS limite déjà le flux aux créneaux de ce livreur ; l'anti-rebond ramène
  // plusieurs créneaux enregistrés d'affilée à un seul rechargement.
  useRealtime('driver-shifts', [{ table: 'driver_shifts' }], refetch);

  const days = groupShiftsByDay(shifts);
  const totalHours = shifts.reduce((n, s) => n + (shiftHours(s) ?? 0), 0);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <DriverHeader title="Mon planning" subtitle="Vos créneaux à venir" onBack={() => router.push('/driver')} />

      <div style={{ display: 'flex', gap: 24, padding: '2px 16px 0', flexWrap: 'wrap' }}>
        <Figure label="Créneaux" value={String(shifts.length)} />
        <Figure label="Heures planifiées" value={String(Math.round(totalHours * 10) / 10).replace('.', ',')} unit="h" />
      </div>

      <div style={{ padding: `18px 16px ${SAFE_BOTTOM + 16}px` }}>
        {days.length === 0 ? (
          <EmptyLine
            title="Aucun créneau planifié."
            hint="Le gérant vous préviendra dès qu’un créneau est ajouté."
          />
        ) : (
          days.map((day) => (
            <div key={day.dateIso} style={{ marginBottom: 20 }}>
              <SectionTitle>{day.label}</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {day.shifts.map((s) => {
                  const hours = shiftHours(s);
                  return (
                    <Panel key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon name="clock" size={20} color="var(--ink)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...text, fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{shiftRange(s)}</div>
                        <div style={{ ...text, fontSize: 12.5, color: 'var(--muted)' }}>
                          {hours !== null ? `${String(hours).replace('.', ',')} h` : 'Créneau'}
                          {s.note ? ` · ${s.note}` : ''}
                        </div>
                      </div>
                    </Panel>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
