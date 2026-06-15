// /driver/planning — Server Component. Loads the signed-in driver's upcoming
// shifts (driver_shifts, RLS-scoped) and renders the read-only roster, which
// subscribes to Realtime for live updates.
import { getMyShifts } from '@/lib/queries';
import { DriverPlanningScreen } from '@/components/driver/DriverPlanningScreen';

export default async function DriverPlanningPage() {
  const shifts = await getMyShifts();
  return <DriverPlanningScreen initialShifts={shifts} />;
}
