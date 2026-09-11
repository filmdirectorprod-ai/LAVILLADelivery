// components/admin/drivers/DriverAccountModal.tsx
// Admin sheet to provision a driver login. Two modes:
//   'new'  → creates a brand-new driver (name + identifiant + password + infos)
//   'link' → creates credentials for an existing driver row (identifiant + password)
// Posts to /api/admin/drivers (staff-gated, service-role server side). On success
// it shows the credentials once, with a copy button, so the admin can pass them on.
'use client';
import { useEffect, useState } from 'react';
import { useBranches } from '@/lib/use-branches';
import { validateIdentifiant, validateDriverPassword, generatePassword, LIVREUR_EMAIL_DOMAIN } from '@/lib/driver-credentials';
import { credentialsText } from '@/lib/admin-managers';
import { FormError, GhostButton, Modal, PrimaryButton, SubPanel, fieldStyle, labelStyle } from '@/components/admin/ui/Glass';
import { CopyButton } from '@/components/admin/ui/CopyButton';

export interface DriverAccountModalProps {
  mode: 'new' | 'link';
  driver?: { id: string; name: string } | null;
  onClose: () => void;
  onDone: () => void;
}

const hint = { fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', marginTop: 5 } as const;

export function DriverAccountModal({ mode, driver, onClose, onDone }: DriverAccountModalProps) {
  const [name, setName] = useState('');
  const [identifiant, setIdentifiant] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [branchId, setBranchId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ identifiant: string; password: string } | null>(null);
  const branches = useBranches();

  // Default the agency to the first one once loaded (a branch gérant's choice is
  // forced server-side; this picker matters for a super-admin creating drivers).
  useEffect(() => {
    if (!branchId && branches.length > 0) setBranchId(branches[0].id);
  }, [branches, branchId]);

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
          branch_id: mode === 'new' ? branchId : undefined,
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

  const title = mode === 'new' ? 'Nouveau livreur' : `Créer un accès${driver?.name ? ' — ' + driver.name : ''}`;

  return (
    <Modal title={title} onClose={onClose} width={460}>
      {done ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)', margin: 0 }}>Compte créé. Communique ces identifiants au livreur — ils ne seront plus affichés :</p>
          <SubPanel style={{ fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)', lineHeight: 1.8 }}>
            <div>
              <span style={{ color: 'var(--muted)' }}>Identifiant :</span> <strong style={{ fontWeight: 600 }}>{done.identifiant}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--muted)' }}>Mot de passe :</span> <strong style={{ fontWeight: 600 }}>{done.password}</strong>
            </div>
          </SubPanel>
          <div style={{ display: 'flex', gap: 10 }}>
            <CopyButton value={credentialsText(done.identifiant, done.password)} />
            <PrimaryButton onClick={onDone} style={{ flex: 1 }}>
              Terminé
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'new' && (
            <div>
              <label style={labelStyle} htmlFor="drv-name">
                Nom complet
              </label>
              <input id="drv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Karim Benali" style={fieldStyle} />
            </div>
          )}

          <div>
            <label style={labelStyle} htmlFor="drv-identifiant">
              Identifiant de connexion
            </label>
            <input id="drv-identifiant" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} placeholder="karim" autoCapitalize="none" spellCheck={false} style={fieldStyle} />
            <div style={hint}>
              Le livreur se connecte avec « {identifiant.trim().toLowerCase() || 'identifiant'} » (interne : …@{LIVREUR_EMAIL_DOMAIN})
            </div>
          </div>

          <div>
            <label style={labelStyle} htmlFor="drv-password">
              Mot de passe
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="drv-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="au moins 6 caractères" autoComplete="new-password" style={{ ...fieldStyle, flex: 1, width: 'auto', minWidth: 0 }} />
              <GhostButton onClick={() => setPassword(generatePassword(10))}>Générer</GhostButton>
            </div>
          </div>

          {mode === 'new' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle} htmlFor="drv-phone">
                    Téléphone
                  </label>
                  <input id="drv-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="drv-vehicle">
                    Véhicule
                  </label>
                  <input id="drv-vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Scooter" style={fieldStyle} />
                </div>
              </div>

              {branches.length > 1 && (
                <div>
                  <label style={labelStyle} htmlFor="drv-branch">
                    Agence
                  </label>
                  <select id="drv-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} style={fieldStyle}>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <div style={hint}>Le livreur ne verra que les commandes de cette agence.</div>
                </div>
              )}
            </>
          )}

          {error && <FormError>{error}</FormError>}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <GhostButton onClick={onClose} disabled={busy} style={{ flex: 1 }}>
              Annuler
            </GhostButton>
            <PrimaryButton onClick={submit} disabled={busy} style={{ flex: 1.4 }}>
              {busy ? 'Création…' : mode === 'new' ? 'Créer le livreur' : "Créer l'accès"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
