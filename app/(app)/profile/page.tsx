// /profile — Server Component. Fetches the signed-in profile (loyalty balance +
// tier) and renders the client ProfileScreen.
import { getMyProfile } from '@/lib/queries';
import { ProfileScreen } from '@/components/screens/ProfileScreen';

export default async function ProfilePage() {
  const profile = await getMyProfile();
  return <ProfileScreen profile={profile} />;
}
