'use client';
// GÉRER LES ADRESSES — list saved delivery addresses with add / edit / delete
// and "set default". All mutations go through the browser Supabase client and
// are owner-scoped by RLS; the list re-reads after each change.
import { useState } from 'react';
import type { Address, Zone } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { formatDH } from '@/lib/format';
import { SAFE_BOTTOM } from '@/lib/layout';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
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
  padding: '12px 14px',
  marginTop: 6,
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

type Draft = {
  id?: string;
  label: string;
  line1: string;
  city: string;
  zone_id: string | null;
  details: string;
  recipient: string;
  phone: string;
  is_default: boolean;
};

const emptyDraft = (isFirst: boolean, recipient = '', phone = ''): Draft => ({
  label: 'Domicile',
  line1: '',
  city: 'Fès',
  zone_id: null,
  details: '',
  recipient,
  phone,
  is_default: isFirst,
});

const toDraft = (a: Address): Draft => ({
  id: a.id,
  label: a.label,
  line1: a.line1,
  city: a.city,
  zone_id: a.zone_id,
  details: a.details ?? '',
  recipient: a.recipient ?? '',
  phone: a.phone ?? '',
  is_default: a.is_default,
});

export interface AddressesScreenProps {
  addresses: Address[];
  zones: Zone[];
  /** Pre-fills the recipient name on a brand-new address (from the profile). */
  defaultRecipient?: string;
  /** Pre-fills the contact phone on a brand-new address (from the profile). */
  defaultPhone?: string;
}

export function AddressesScreen({ addresses: initial, zones, defaultRecipient = '', defaultPhone = '' }: AddressesScreenProps) {
  const toast = useToast((s) => s.show);
  const [list, setList] = useState<Address[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function refresh() {
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    setList((data as Address[]) ?? []);
  }

  async function saveDraft() {
    if (!draft) return;
    setError(null);
    if (!draft.line1.trim()) {
      setError("Renseignez l'adresse.");
      return;
    }
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expirée. Reconnectez-vous.');

      const row = {
        label: draft.label.trim() || 'Adresse',
        line1: draft.line1.trim(),
        city: draft.city.trim() || 'Fès',
        zone_id: draft.zone_id,
        details: draft.details.trim() || null,
        recipient: draft.recipient.trim() || null,
        phone: draft.phone.trim() || null,
        is_default: draft.is_default,
      };

      if (draft.id) {
        const { error: e } = await supabase.from('addresses').update(row).eq('id', draft.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('addresses').insert({ ...row, user_id: user.id });
        if (e) throw e;
      }
      await refresh();
      setDraft(null);
      toast(draft.id ? 'Adresse mise à jour' : 'Adresse ajoutée');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    const { error: e } = await supabase.from('addresses').delete().eq('id', id);
    if (e) setError(e.message);
    else {
      await refresh();
      toast('Adresse supprimée');
    }
    setBusy(false);
  }

  async function makeDefault(id: string) {
    setBusy(true);
    const { error: e } = await supabase.from('addresses').update({ is_default: true }).eq('id', id);
    if (e) setError(e.message);
    else await refresh();
    setBusy(false);
  }

  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name ?? null;

  // ── Add / edit form ────────────────────────────────────────────────────────
  if (draft) {
    const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <ScreenHeader title={draft.id ? 'Modifier l’adresse' : 'Nouvelle adresse'} back="/profile/addresses" />
        <div style={{ flex: 1, overflow: 'auto', padding: `18px 18px ${SAFE_BOTTOM + 24}px` }}>
          <label style={labelStyle}>Nom de l’adresse</label>
          <div style={fieldWrap}>
            <Icon name="bookmark" size={17} color="var(--muted)" />
            <input value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder="Domicile, Bureau…" style={fieldStyle} />
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Adresse</label>
            <div style={fieldWrap}>
              <Icon name="pin" size={17} color="var(--muted)" />
              <input value={draft.line1} onChange={(e) => set({ line1: e.target.value })} placeholder="Av. Hassan II, Rés. Les Jardins…" style={fieldStyle} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Ville</label>
            <div style={fieldWrap}>
              <Icon name="store" size={17} color="var(--muted)" />
              <input value={draft.city} onChange={(e) => set({ city: e.target.value })} placeholder="Fès" style={fieldStyle} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Zone de livraison</label>
            <div style={fieldWrap}>
              <Icon name="scooter" size={17} color="var(--muted)" />
              <select
                value={draft.zone_id ?? ''}
                onChange={(e) => set({ zone_id: e.target.value || null })}
                style={{ ...fieldStyle, appearance: 'none' }}
              >
                <option value="">Choisir une zone…</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} · {formatDH(z.fee_dh)}
                  </option>
                ))}
              </select>
              <Icon name="down" size={16} color="var(--muted)" />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Précisions (étage, interphone…)</label>
            <div style={fieldWrap}>
              <Icon name="info" size={17} color="var(--muted)" />
              <input value={draft.details} onChange={(e) => set({ details: e.target.value })} placeholder="3e étage, porte gauche" style={fieldStyle} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Téléphone de contact</label>
            <div style={fieldWrap}>
              <Icon name="phone" size={17} color="var(--muted)" />
              <input type="tel" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="06 12 34 56 78" style={fieldStyle} />
            </div>
          </div>

          <button
            onClick={() => set({ is_default: !draft.is_default })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              width: '100%',
              marginTop: 18,
              padding: '12px 14px',
              borderRadius: 14,
              border: '1.5px solid var(--line)',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                border: draft.is_default ? 'none' : '1.5px solid var(--line)',
                background: draft.is_default ? 'var(--brand)' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {draft.is_default && <Icon name="check" size={14} color="#fff" strokeWidth={2.4} />}
            </span>
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>
              Adresse par défaut
            </span>
          </button>

          {error && (
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: '#C0392B', fontWeight: 600, marginTop: 14 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <Btn variant="ghost" size="lg" onClick={() => { setDraft(null); setError(null); }} style={{ flex: 1 }}>
              Annuler
            </Btn>
            <Btn size="lg" onClick={saveDraft} disabled={busy} style={{ flex: 1.4 }}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  // ── List ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ScreenHeader title="Mes adresses" />
      <div style={{ flex: 1, overflow: 'auto', padding: `16px 18px ${SAFE_BOTTOM + 24}px` }}>
        {list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted)', fontFamily: 'var(--ui-font)' }}>
            <Icon name="pin" size={40} color="var(--line)" />
            <div style={{ fontSize: 14.5, marginTop: 12, fontWeight: 500 }}>Aucune adresse enregistrée</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Ajoutez une adresse pour accélérer vos commandes.</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map((a) => (
            <div key={a.id} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                <Icon name="pin" size={17} color="var(--brand)" />
                <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{a.label}</span>
                {a.is_default && (
                  <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11, fontWeight: 700, color: 'var(--brand)', background: 'var(--soft)', padding: '2px 8px', borderRadius: 999 }}>
                    Par défaut
                  </span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.4 }}>{a.line1}</div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                {[a.city, zoneName(a.zone_id), a.details].filter(Boolean).join(' · ')}
              </div>
              {a.phone && (
                <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{a.phone}</div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 11 }}>
                {!a.is_default && (
                  <button
                    onClick={() => makeDefault(a.id)}
                    disabled={busy}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--brand)' }}
                  >
                    <Icon name="check" size={15} color="var(--brand)" /> Par défaut
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => { setError(null); setDraft(toDraft(a)); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}
                >
                  <Icon name="edit" size={15} color="var(--muted)" /> Modifier
                </button>
                <button
                  onClick={() => remove(a.id)}
                  disabled={busy}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: '#C0392B' }}
                >
                  <Icon name="x" size={15} color="#C0392B" /> Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && !draft && (
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: '#C0392B', fontWeight: 600, marginTop: 14 }}>{error}</div>
        )}

        <div style={{ marginTop: 16 }}>
          <Btn full size="lg" variant="outline" onClick={() => { setError(null); setDraft(emptyDraft(list.length === 0, defaultRecipient, defaultPhone)); }} icon={<Icon name="plus" size={18} color="var(--brand)" />}>
            Ajouter une adresse
          </Btn>
        </div>
      </div>
    </div>
  );
}
