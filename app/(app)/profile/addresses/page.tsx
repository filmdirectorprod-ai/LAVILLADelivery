// /profile/addresses — manage saved delivery addresses. Server Component loads
// the user's addresses and the delivery zones; the client screen does CRUD.
import { getMyAddresses, getZones } from '@/lib/queries';
import { AddressesScreen } from '@/components/screens/AddressesScreen';

export default async function AddressesPage() {
  const [addresses, zones] = await Promise.all([getMyAddresses(), getZones()]);
  return <AddressesScreen addresses={addresses} zones={zones} />;
}
