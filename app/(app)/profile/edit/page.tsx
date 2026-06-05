// /profile/edit — edit name, phone, avatar. Server Component fetches the
// current profile; the client screen performs the updates.
import { getMyProfile } from '@/lib/queries';
import { ProfileEditScreen } from '@/components/screens/ProfileEditScreen';

export default async function ProfileEditPage() {
  const profile = await getMyProfile();
  return <ProfileEditScreen profile={profile} />;
}
