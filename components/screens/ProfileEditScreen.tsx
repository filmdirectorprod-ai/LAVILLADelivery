'use client';
// MODIFIER LE PROFIL — edit name, phone, and avatar. Name/phone write to the
// `profiles` row (owner-update RLS); the avatar is uploaded to the public
// `avatars` storage bucket and its public URL stored on the profile.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { SAFE_BOTTOM } from '@/lib/layout';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { Btn } from '@/components/ui/Btn';
import { Icon } from '@/components/ui/Icon';

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--ui-font)',
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--muted)',
};
const fieldWrap: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  border: '1.5px solid var(--line)',
  borderRadius: 14,
  padding: '13px 14px',
  marginTop: 7,
};
const fieldStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  fontFamily: 'var(--ui-font)',
  fontSize: 15,
  color: 'var(--ink)',
  background: 'transparent',
};

export interface ProfileEditScreenProps {
  profile: Profile | null;
}

export function ProfileEditScreen({ profile }: ProfileEditScreenProps) {
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choisissez une image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("L'image ne doit pas dépasser 5 Mo.");
      return;
    }
    setError(null);
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function save() {
    setError(null);
    if (!fullName.trim()) {
      setError('Renseignez votre nom.');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expirée. Reconnectez-vous.');

      let nextAvatar = avatarUrl;
      if (pendingFile) {
        const ext = (pendingFile.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
        if (upErr) throw upErr;
        nextAvatar = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }

      const { error: updErr } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), phone: phone.trim() || null, avatar_url: nextAvatar })
        .eq('id', user.id);
      if (updErr) throw updErr;

      setAvatarUrl(nextAvatar);
      toast('Profil mis à jour');
      router.push('/profile');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la mise à jour.');
    } finally {
      setBusy(false);
    }
  }

  const shownAvatar = preview ?? avatarUrl;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ScreenHeader title="Modifier le profil" />

      <div style={{ flex: 1, overflow: 'auto', padding: `22px 18px ${SAFE_BOTTOM + 24}px` }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              position: 'relative',
              width: 96,
              height: 96,
              borderRadius: 999,
              border: '2.5px solid var(--gold)',
              padding: 3,
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <PhotoSlot
              label={fullName || 'avatar'}
              src={shownAvatar ?? undefined}
              style={{ width: '100%', height: '100%', borderRadius: 999 }}
              dim
            />
            <span
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 32,
                height: 32,
                borderRadius: 999,
                background: 'var(--brand)',
                border: '2px solid #fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="camera" size={16} color="#fff" />
            </span>
          </button>
          <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>
            Toucher pour changer la photo
          </span>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} style={{ display: 'none' }} />
        </div>

        <div style={{ marginTop: 26 }}>
          <label style={labelStyle}>Nom complet</label>
          <div style={fieldWrap}>
            <Icon name="user" size={18} color="var(--muted)" />
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Sofia El Amrani" style={fieldStyle} />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Téléphone</label>
          <div style={fieldWrap}>
            <Icon name="phone" size={18} color="var(--muted)" />
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              style={fieldStyle}
            />
          </div>
        </div>

        {error && (
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: '#C0392B', fontWeight: 600, marginTop: 14 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 26 }}>
          <Btn full size="lg" onClick={save} disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Btn>
        </div>
      </div>
    </div>
  );
}
