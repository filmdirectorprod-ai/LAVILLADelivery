// components/admin/drivers/DriverEditModal.tsx
// Edit a driver's identity (name / phone / vehicle) via admin_update_driver (0027).
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/ui/Icon';
import type { Driver } from '@/lib/types';

const label: React.CSSProperties = { fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' };
const wrap: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid var(--line)', borderRadius: 12, padding: '11px 12px', marginTop: 6, background: '#fff' };
const input: React.CSSProperties = { flex: 1, border: 'none', outline: 'none', fontFamily: 'var(--ui-font)', fontSize: 14.5, color: 'var(--ink)', background: 'transparent' };

export function DriverEditModal({ driver, onClose, onDone }: { driver: Driver; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(driver.name);
  const [phone, setPhone] = useState(driver.phone ?? '');
  const [vehicle, setVehicle] = useState(driver.vehicle ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!name.trim()) return setError('Le nom est requis.');
    setBusy(true);
    const supabase = createClient();
    const { error: e } = await supabase.rpc('admin_update_driver', {
      p_id: driver.id,
      p_name: name,
      p_phone: phone,
      p_vehicle: vehicle,
    });
    setBusy(false);
    if (e) return setError(e.message);
    onDone();
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(8,28,31,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, 100%)', background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 30px 70px -30px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: 'var(--ink)', margin: 0 }}>Modifier le livreur</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'var(--soft)', borderRadius: 999, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={16} color="var(--ink)" />
          </button>
        </div>

        <label style={label}>Nom complet</label>
        <div style={wrap}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Karim Benali" style={input} /></div>

        <div style={{ marginTop: 12 }}>
          <label style={label}>Téléphone</label>
          <div style={wrap}><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" style={input} /></div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={label}>Véhicule</label>
          <div style={wrap}><input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Scooter" style={input} /></div>
        </div>

        {error && <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: '#C0392B', fontWeight: 600, marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} disabled={busy} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 12, padding: '12px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: '#fff' }}>Annuler</button>
          <button onClick={save} disabled={busy} style={{ flex: 1.4, border: 'none', borderRadius: 12, padding: '12px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: '#fff', background: 'var(--brand)', opacity: busy ? 0.6 : 1 }}>{busy ? '…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  );
}
