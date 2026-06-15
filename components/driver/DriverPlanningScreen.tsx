'use client';
// Driver "Mon planning" — read-only weekly roster for the signed-in livreur.
// The gérant sets shifts in the admin Planning screen (driver_shifts, 0018); here
// the driver sees only their own upcoming shifts (shifts_driver_read RLS),
// grouped by day. Subscribes to Realtime on driver_shifts so a newly-assigned or
// cancelled shift updates live. Pure grouping lives in lib/driver-planning.ts.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { groupShiftsByDay, shiftRange } from '@/lib/driver-planning';
import type { DriverShift } from '@/lib/types';

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
    const supabase = createClient();
    const { data } = await supabase
      .from('driver_shifts')
      .select('*')
      .gte('ends_at', new Date().toISOString())
      .order('starts_at');
    setShifts((data ?? []) as DriverShift[]);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('driver-shifts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_shifts' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const days = groupShiftsByDay(shifts);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--soft)' }}>
      {/* header */}
      <div
        style={{
          padding: `${SAFE_TOP + 4}px 14px 14px`,
          background: 'linear-gradient(150deg, var(--brand), var(--brand-d))',
          display: 'flex',
          alignItems: 'center',
          gap: 11,
        }}
      >
        <button
          onClick={() => router.push('/driver')}
          aria-label="Retour"
          style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.14)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Icon name="left" size={20} color="#fff" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: '#fff' }}>Mon planning</div>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'rgba(255,255,255,0.72)' }}>
            Vos créneaux à venir
          </div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="calendar" size={20} color="#fff" />
        </div>
      </div>

      {/* body */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `16px 16px ${SAFE_BOTTOM + 16}px` }}>
        {days.length === 0 ? (
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', background: '#fff', border: '1px dashed var(--line)', borderRadius: 18, padding: '22px 16px', textAlign: 'center' }}>
            Aucun créneau planifié pour le moment.
            <br />
            Le gérant vous préviendra dès qu&apos;un créneau est ajouté.
          </div>
        ) : (
          days.map((day) => (
            <div key={day.dateIso} style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: 'var(--brand)', margin: '0 2px 9px' }}>
                {day.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {day.shifts.map((s) => {
                  const hours = shiftHours(s);
                  return (
                    <div
                      key={s.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: 14, boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)' }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon name="clock" size={21} color="var(--brand)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
                          {shiftRange(s)}
                        </div>
                        <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>
                          {hours !== null ? `${hours} h` : 'Créneau'}
                          {s.note ? ` · ${s.note}` : ''}
                        </div>
                      </div>
                    </div>
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
