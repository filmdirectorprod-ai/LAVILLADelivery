// /profile/addresses — manage saved delivery addresses. Server Component loads
// the user's addresses, the delivery zones, and the profile (to pre-fill the
// recipient name + phone on a new address); the client screen does CRUD.
import { getMyAddresses, getZones, getMyProfile } from '@/lib/queries';
import { AddressesScreen } from '@/components/screens/AddressesScreen';

export default async function AddressesPage() {
  const [addresses, zones, profile] = await Promise.all([getMyAddresses(), getZones(), getMyProfile()]);
  return (
    <AddressesScreen
      addresses={addresses}
      zones={zones}
      defaultRecipient={profile?.full_name ?? ''}
      defaultPhone={profile?.phone ?? ''}
    />
  );
}
