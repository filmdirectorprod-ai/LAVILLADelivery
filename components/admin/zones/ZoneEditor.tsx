// components/admin/zones/ZoneEditor.tsx
// Inline create/edit form for one delivery zone. Holds the draft locally, gates
// its own submit with validateZoneDraft (the same rules the admin_upsert_zone RPC
// enforces), and reports a validated draft + id (null = create) via onSave.
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-store';
import { staffMessage } from '@/lib/order-error-messages';
import { useBranches } from '@/lib/use-branches';
import { validateZoneDraft, type ZoneDraft } from '@/lib/admin-zones';
import type { Zone } from '@/lib/types';
import { FormError, GhostButton, GlassPanel, PanelTitle, PrimaryButton, fieldStyle, labelStyle } from '@/components/admin/ui/Glass';

export interface ZoneEditorProps {
  /** The zone being edited, or null to create a new one. */
  zone: Zone | null;
  busy: boolean;
  onSave: (draft: ZoneDraft, id: string | null) => void;
  onCancel: () => void;
}

export function ZoneEditor({ zone, busy, onSave, onCancel }: ZoneEditorProps) {
  const toast = useToast((t) => t.show);
  const [name, setName] = useState(zone?.name ?? '');
  const [fee, setFee] = useState(String(zone?.fee_dh ?? ''));
  const [etaMin, setEtaMin] = useState(String(zone?.eta_min ?? ''));
  const [etaMax, setEtaMax] = useState(String(zone?.eta_max ?? ''));
  const [branchId, setBranchId] = useState(zone?.branch_id ?? '');
  const [touched, setTouched] = useState(false);
  const branches = useBranches();

  // Appliqué immédiatement, séparément du brouillon de la zone.
  //
  // C'est la colonne la plus lourde de conséquences de toute l'administration :
  // elle décide quelle agence reçoit les commandes de ce quartier, donc quels
  // livreurs les verront. Un échec silencieux ici envoyait les commandes à la
  // mauvaise agence pendant que la liste affichait la bonne — et personne ne
  // pouvait le deviner.
  async function changeBranch(next: string) {
    const avant = branchId;
    setBranchId(next);
    if (!zone?.id || !next) return;
    const { error } = await createClient().rpc('admin_set_zone_branch', { p_zone: zone.id, p_branch: next });
    if (error) {
      setBranchId(avant); // la liste doit montrer ce qui est vraiment enregistré
      toast(staffMessage(error.message), 'alert');
    }
  }

  const draft: ZoneDraft = { name, fee_dh: Number(fee), eta_min: Number(etaMin), eta_max: Number(etaMax) };
  const validation = validateZoneDraft(draft);

  return (
    <GlassPanel>
      <PanelTitle>{zone ? `Modifier la zone ${zone.name}` : 'Nouvelle zone'}</PanelTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }} onChange={() => setTouched(true)}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle} htmlFor="zone-name">
            Nom
          </label>
          <input id="zone-name" style={fieldStyle} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} placeholder="Médina" />
        </div>
        <div>
          <label style={labelStyle} htmlFor="zone-fee">
            Frais (DH)
          </label>
          <input id="zone-fee" style={fieldStyle} type="number" min={0} value={fee} disabled={busy} onChange={(e) => setFee(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="zone-eta-min">
            Délai min (min)
          </label>
          <input id="zone-eta-min" style={fieldStyle} type="number" min={0} value={etaMin} disabled={busy} onChange={(e) => setEtaMin(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="zone-eta-max">
            Délai max (min)
          </label>
          <input id="zone-eta-max" style={fieldStyle} type="number" min={0} value={etaMax} disabled={busy} onChange={(e) => setEtaMax(e.target.value)} />
        </div>
      </div>
      {zone && (
        <div style={{ maxWidth: 300, marginTop: 14 }}>
          <label style={labelStyle} htmlFor="zone-branch">
            Agence qui livre cette zone
          </label>
          <select id="zone-branch" style={fieldStyle} value={branchId} disabled={busy} onChange={(e) => changeBranch(e.target.value)}>
            {branches.length === 0 && <option value="">—</option>}
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {(touched || zone) && !validation.ok && <FormError>{validation.error}</FormError>}
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <PrimaryButton disabled={busy || !validation.ok} onClick={() => onSave(draft, zone?.id ?? null)}>
          Enregistrer
        </PrimaryButton>
        <GhostButton disabled={busy} onClick={onCancel}>
          Annuler
        </GhostButton>
      </div>
    </GlassPanel>
  );
}
