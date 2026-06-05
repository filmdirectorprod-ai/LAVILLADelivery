// /profile/settings — notification preferences, language, account shortcuts.
import { getMyProfile } from '@/lib/queries';
import { SettingsScreen } from '@/components/screens/SettingsScreen';

export default async function SettingsPage() {
  const profile = await getMyProfile();
  return <SettingsScreen profile={profile} />;
}
