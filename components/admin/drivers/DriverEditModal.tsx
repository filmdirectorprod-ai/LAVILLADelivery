// components/admin/drivers/DriverEditModal.tsx
// Edit a driver's identity (name / phone / vehicle) via admin_update_driver (0027)
// and their agency via admin_set_driver_branch.
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { staffMessage } from '@/lib/order-error-messages';
import { useBranches } from '@/lib/use-branches';
import type { Driver } from '@/lib/types';
import { FormError, GhostButton, Modal, PrimaryButton, fieldStyle, labelStyle } from '@/components/admin/ui/Glass';

export function DriverEditModal({ driver, onClose, onDone }: { driver: Driver; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(driver.name);
  const [phone, setPhone] = useState(driver.phone ?? '');
  const [vehicle, setVehicle] = useState(driver.vehicle ?? '');
  const [branchId, setBranchId] = useState(driver.branch_id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const branches = useBranches();

  async function save() {
    setError(null);
    if (!name.trim()) return setError('Le nom est requis.');
    setBusy(true);
    const supabase = createClient();
    const { error: e } = await supabase.rpc('admin_update_driver', { p_id: driver.id, p_name: name, p_phone: phone, p_vehicle: vehicle });
    // Le changement d'agence ne regardait pas son erreur : la fiche se fermait
    // en annonçant un succès, et le livreur restait rattaché à l'ancienne. Or
    // c'est cette colonne qui décide des commandes qu'il verra — une panne
    // silencieuse ici le rend aveugle sans que personne comprenne pourquoi.
    let branchErr: string | null = null;
    if (!e && branchId && branchId !== driver.branch_id) {
      const { error: be } = await supabase.rpc('admin_set_driver_branch', { p_driver: driver.id, p_branch: branchId });
      if (be) branchErr = be.message;
    }
    setBusy(false);
    if (e) return setError(staffMessage(e.message));
    if (branchErr) {
      return setError(`Le nom a été enregistré, mais pas l’agence. ${staffMessage(branchErr)}`);
    }
    onDone();
  }

  return (
    <Modal title="Modifier le livreur" onClose={onClose} width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle} htmlFor="edit-drv-name">
            Nom complet
          </label>
          <input id="edit-drv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Karim Benali" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="edit-drv-phone">
            Téléphone
          </label>
          <input id="edit-drv-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="edit-drv-vehicle">
            Véhicule
          </label>
          <input id="edit-drv-vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Scooter" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="edit-drv-branch">
            Agence
          </label>
          <select id="edit-drv-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} style={fieldStyle}>
            {branches.length === 0 && <option value="">—</option>}
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <FormError>{error}</FormError>}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <GhostButton onClick={onClose} disabled={busy} style={{ flex: 1 }}>
          Annuler
        </GhostButton>
        <PrimaryButton onClick={save} disabled={busy} style={{ flex: 1.4 }}>
          {busy ? '…' : 'Enregistrer'}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
