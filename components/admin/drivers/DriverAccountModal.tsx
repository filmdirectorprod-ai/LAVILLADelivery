// components/admin/drivers/DriverAccountModal.tsx
// Admin modal to provision a driver login. Two modes:
//   'new'  → creates a brand-new driver (name + identifiant + password + infos)
//   'link' → creates credentials for an existing driver row (identifiant + password)
// Posts to /api/admin/drivers (staff-gated, service-role server side). On success
// it shows the credentials once so the admin can pass them to the driver.
'use client';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  validateIdentifiant,
  validateDriverPassword,
  generatePassword,
  LIVREUR_EMAIL_DOMAIN,
} from '@/lib/driver-credentials';

export interface DriverAccountModalProps {
  mode: 'new' | 'link';
  driver?: { id: string; name: string } | null;
  onClose: () => void;
  onDone: () => void;
}

const label: React.CSSProperties = { fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' };
const wrap: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid var(--line)', borderRadius: 12, padding: '11px 12px', marginTop: 6, background: '#fff' };
const input: React.CSSProperties = { flex: 1, border: 'none', outline: 'none', fontFamily: 'var(--ui-font)', fontSize: 14.5, color: 'var(--ink)', background: 'transparent' };

export function DriverAccountModal({ mode, driver, onClose, onDone }: DriverAccountModalProps) {
  const [name, setName] = useState('');
  const [identifiant, setIdentifiant] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ identifiant: string; password: string } | null>(null);

  async function submit() {
    setError(null);
    if (mode === 'new' && !name.trim()) return setError('Le nom du livreur est requis.');
    const idErr = validateIdentifiant(identifiant);
    if (idErr) return setError(idErr);
    const pwErr = validateDriverPassword(password);
    if (pwErr) return setError(pwErr);

    setBusy(true);
    try {
      const res = await fetch('/api/admin/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifiant,
          password,
          driver_id: mode === 'link' ? driver?.id : undefined,
          name: mode === 'new' ? name : undefined,
          phone: mode === 'new' ? phone : undefined,
          vehicle: mode === 'new' ? vehicle : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Échec de la création.');
      setDone({ identifiant: data.identifiant as string, password });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la création.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(8,28,31,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(440px, 100%)', background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 30px 70px -30px rgba(0,0,0,0.6)', maxHeight: '90vh', overflow: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: 'var(--ink)', margin: 0 }}>
            {mode === 'new' ? 'Nouveau livreur' : `Créer un accès${driver?.name ? ' — ' + driver.name : ''}`}
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: 'var(--soft)', borderRadius: 999, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={16} color="var(--ink)" />
          </button>
        </div>

        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2f9e6f', fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15 }}>
              <Icon name="check" size={18} color="#2f9e6f" /> Compte créé
            </div>
            <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', margin: 0 }}>
              Communique ces identifiants au livreur (ils ne seront plus affichés) :
            </p>
            <div style={{ background: 'var(--soft)', borderRadius: 12, padding: '14px 16px', fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>
              <div><strong>Identifiant :</strong> {done.identifiant}</div>
              <div><strong>Mot de passe :</strong> {done.password}</div>
            </div>
            <button
              onClick={onDone}
              style={{ marginTop: 4, border: 'none', borderRadius: 12, padding: '12px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: '#fff', background: 'var(--brand)' }}
            >
              Terminé
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mode === 'new' && (
              <div>
                <label style={label}>Nom complet</label>
                <div style={wrap}>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Karim Benali" style={input} />
                </div>
              </div>
            )}

            <div>
              <label style={label}>Identifiant de connexion</label>
              <div style={wrap}>
                <input
                  value={identifiant}
                  onChange={(e) => setIdentifiant(e.target.value)}
                  placeholder="karim"
                  autoCapitalize="none"
                  spellCheck={false}
                  style={input}
                />
              </div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>
                Le livreur se connecte avec « {identifiant.trim().toLowerCase() || 'identifiant'} » (interne : …@{LIVREUR_EMAIL_DOMAIN})
              </div>
            </div>

            <div>
              <label style={label}>Mot de passe</label>
              <div style={wrap}>
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="au moins 6 caractères" style={input} />
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword(10))}
                  style={{ border: 'none', background: 'rgba(19,124,139,0.12)', color: 'var(--brand)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 12 }}
                >
                  Générer
                </button>
              </div>
            </div>

            {mode === 'new' && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Téléphone</label>
                  <div style={wrap}><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" style={input} /></div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Véhicule</label>
                  <div style={wrap}><input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Scooter" style={input} /></div>
                </div>
              </div>
            )}

            {error && (
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: '#C0392B', fontWeight: 600 }}>{error}</div>
            )}

            <button
              onClick={submit}
              disabled={busy}
              style={{ marginTop: 4, border: 'none', borderRadius: 12, padding: '12px', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: '#fff', background: 'var(--brand)', opacity: busy ? 0.6 : 1 }}
            >
              {busy ? 'Création…' : mode === 'new' ? 'Créer le livreur' : "Créer l'accès"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
