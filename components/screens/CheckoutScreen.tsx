'use client';
// PAIEMENT / CHECKOUT — la facture affichée est un aperçu ; le serveur recalcule
// tout (place_order).
//
// 0054, trois corrections de fond :
//   • Le paiement ne ment plus. L'écran affichait une carte bancaire enregistrée,
//     un code Cash Plus et un RIB… tous inventés dans le fichier, alors que
//     choisir « Carte » enregistrait la commande comme un paiement à la
//     livraison. Les moyens proposés sont désormais ceux qui existent vraiment,
//     et le choix part avec la commande (payment_method).
//   • Le créneau choisi est transmis (slot_at) : une commande pour 19:00
//     n'arrive plus en cuisine à 12:00.
//   • Les points de retrait viennent des agences en base, et les coordonnées de
//     l'adresse partent avec la commande pour que le suivi mesure l'arrivée.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Address, Branch, Product, Profile, Zone } from '@/lib/types';
import { formatDH } from '@/lib/format';
import { computeOrder, REDEEM_PALIERS } from '@/lib/pricing';
import { slotOptions, slotLabel, type SlotId } from '@/lib/checkout-slots';
import { useCart } from '@/lib/cart-store';
import { useOrderMode } from '@/lib/order-store';
import { useToast } from '@/lib/toast-store';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { Btn } from '@/components/ui/Btn';

export interface CheckoutScreenProps {
  products: Product[];
  zones: Zone[];
  addresses: Address[];
  profile: Profile | null;
  /** Agences actives (table branches) — les points de retrait proposés. */
  branches: Branch[];
}

/** One-line human address used both for display and the order payload. */
function formatAddress(a: Address): string {
  return [a.line1, a.details, a.city].filter(Boolean).join(', ');
}

/** Lien Maps vers une agence : ses coordonnées, sinon son nom. */
function branchMaps(b: Branch): string {
  const q = b.lat != null && b.lng != null ? `${b.lat},${b.lng}` : `${b.name} ${b.address ?? ''}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Moyens de paiement réellement disponibles aujourd'hui. */
type Pay = 'cod' | 'cashplus' | 'virement';

const PAY_OPTIONS: { id: Pay; title: string; sub: string; icon: string }[] = [
  { id: 'cod', title: 'Paiement à la livraison', sub: 'Espèces, à la remise de la commande', icon: 'cash' },
  { id: 'cashplus', title: 'Cash Plus', sub: "L'agence vous transmet le code après confirmation", icon: 'store' },
  { id: 'virement', title: 'Virement bancaire', sub: "L'agence vous transmet le RIB après confirmation", icon: 'receipt' },
];

const PALIER_LABELS: Record<number, string> = { 25: '25 DH', 60: '60 DH', 130: '130 DH' };

function Row({ label, value, gold, green }: { label: string; value: string; gold?: boolean; green?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--ui-font)',
          fontSize: 13.5,
          fontWeight: 600,
          color: gold ? 'var(--gold)' : green ? 'var(--brand)' : 'var(--ink)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function CheckoutScreen({ products, zones, addresses, profile, branches }: CheckoutScreenProps) {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);
  const mode = useOrderMode((s) => s.mode);
  const toast = useToast((s) => s.show);

  const [pay, setPay] = useState<Pay>('cod');
  const [slot, setSlot] = useState<SlotId>('asap');
  const [redeem, setRedeem] = useState<number | null>(null); // palier pts
  const [busy, setBusy] = useState(false);
  // Contact phone for this order — so the driver (and gérant) can call. Prefilled
  // from the profile, else the default address.
  const [phone, setPhone] = useState<string>(profile?.phone ?? addresses[0]?.phone ?? '');
  // Promo code (0037): validated server-side via validate_promo for a live preview;
  // place_order re-validates authoritatively.
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);

  // Selected delivery address — defaults to the user's default (addresses are
  // already ordered default-first by the query), falling back to the first one.
  const defaultAddressId = addresses[0]?.id ?? null;
  const [addressId, setAddressId] = useState<string | null>(defaultAddressId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickupBranchId, setPickupBranchId] = useState<string>(branches[0]?.id ?? '');
  const selectedAddress = useMemo(() => addresses.find((a) => a.id === addressId) ?? null, [addresses, addressId]);
  const pickupBranch = useMemo(
    () => branches.find((b) => b.id === pickupBranchId) ?? branches[0] ?? null,
    [branches, pickupBranchId],
  );

  // The delivery zone is derived from the chosen address; if it has no zone (or
  // we're on pickup), fall back to the cheapest zone for the fee preview.
  const zone = useMemo<Zone | null>(() => {
    if (mode === 'retrait') return null;
    const fromAddress = zones.find((z) => z.id === selectedAddress?.zone_id);
    return fromAddress ?? zones[0] ?? null;
  }, [mode, zones, selectedAddress]);

  // Créneaux calculés à l'heure de Fès : « au plus vite » annonce le délai de la
  // zone, les deux autres visent la prochaine occurrence de 12:30 / 19:00.
  const slots = useMemo(
    () => slotOptions(new Date(), mode === 'retrait' ? 20 : zone?.eta_min ?? 30),
    [mode, zone],
  );
  const chosenSlot = slots.find((s) => s.id === slot) ?? slots[0];

  const points = profile?.loyalty_points ?? 0;
  const palier = REDEEM_PALIERS.find((r) => r.pts === redeem) ?? null;

  const bill = computeOrder({
    items: items.map((it) => ({ price: it.opts.unit, qty: it.qty })),
    mode,
    zoneFee: zone?.fee_dh,
    promo: false,
    promoDiscount: appliedPromo?.discount,
    redeemPts: palier?.pts ?? 0,
    redeemDh: palier?.dh ?? 0,
    pointsBalance: points,
  });

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code || promoBusy) return;
    setPromoBusy(true);
    setPromoMsg(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('validate_promo', {
      p_code: code,
      p_subtotal: bill.subtotal,
      p_branch: zone?.branch_id ?? null,
    });
    setPromoBusy(false);
    const row = (Array.isArray(data) ? data[0] : data) as { valid: boolean; discount_dh: number; message: string } | null;
    if (error || !row?.valid) {
      setAppliedPromo(null);
      setPromoMsg(row?.message ?? 'Code invalide.');
      return;
    }
    setAppliedPromo({ code: code.toUpperCase(), discount: Number(row.discount_dh) });
    setPromoMsg(null);
  }

  function clearPromo() {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoMsg(null);
  }

  const byId = new Map(products.map((p) => [p.id, p]));

  const confirm = async () => {
    if (items.length === 0 || busy) return;
    if (mode === 'livraison' && !selectedAddress) {
      toast('Choisissez une adresse de livraison.');
      return;
    }
    if (mode === 'retrait' && !pickupBranch) {
      toast('Choisissez un point de retrait.');
      return;
    }
    if (phone.replace(/[^0-9]/g, '').length < 9) {
      toast('Entrez un numéro de téléphone pour la livraison.');
      return;
    }
    setBusy(true);
    try {
      const payloadItems = items
        .filter((it) => byId.has(it.productId))
        .map((it) => ({
          product_id: it.productId,
          qty: it.qty,
          size_mult: it.opts.sizeMult,
          customization: {
            size: it.opts.sizeLabel,
            flavor: it.opts.flavor,
            message: it.opts.message,
            date: it.opts.date,
          },
        }));

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: payloadItems,
          mode,
          address:
            mode === 'retrait'
              ? pickupBranch
                ? `Retrait boutique — ${pickupBranch.name}${pickupBranch.address ? ', ' + pickupBranch.address : ''}`
                : 'Retrait boutique'
              : selectedAddress
                ? formatAddress(selectedAddress)
                : '',
          phone: phone.trim(),
          branch_slug: mode === 'retrait' ? pickupBranch?.slug ?? null : null,
          zone_id: mode === 'retrait' ? null : zone?.id ?? null,
          promo: false,
          promo_code: appliedPromo?.code ?? null,
          redeem_pts: palier?.pts ?? 0,
          redeem_dh: palier?.dh ?? 0,
          // 0054 — le moyen de paiement, le créneau et la destination suivent la commande.
          payment: pay,
          slot_at: chosenSlot?.at ? chosenSlot.at.toISOString() : null,
          slot_label: chosenSlot ? slotLabel(chosenSlot) : null,
          dest_lat: mode === 'retrait' ? null : selectedAddress?.lat ?? null,
          dest_lng: mode === 'retrait' ? null : selectedAddress?.lng ?? null,
        }),
      });

      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({ error: 'Échec de la commande.' }))) as {
          error?: string;
        };
        throw new Error(error ?? 'Échec de la commande.');
      }

      const { order_id } = (await res.json()) as { order_id: string };
      clearCart();
      clearPromo();
      setRedeem(null);
      router.replace(`/tracking/${order_id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Échec de la commande.');
      setBusy(false);
    }
  };

  const payOption = (opt: (typeof PAY_OPTIONS)[number]) => {
    const on = pay === opt.id;
    return (
      <button
        key={opt.id}
        onClick={() => setPay(opt.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 13,
          width: '100%',
          textAlign: 'left',
          background: '#fff',
          border: `1.5px solid ${on ? 'var(--brand)' : 'var(--line)'}`,
          borderRadius: 16,
          padding: '14px 15px',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            background: on ? 'rgba(19,124,139,0.08)' : 'var(--soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name={opt.icon} size={20} color="var(--brand)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{opt.title}</div>
          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{opt.sub}</div>
        </div>
        <div
          style={{
            width: 21,
            height: 21,
            borderRadius: 999,
            border: `2px solid ${on ? 'var(--brand)' : 'var(--line)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {on && <div style={{ width: 11, height: 11, borderRadius: 999, background: 'var(--brand)' }} />}
        </div>
      </button>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: `${SAFE_TOP + 4}px 16px 12px`,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Retour"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: '1px solid var(--line)',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="left" size={20} color="var(--ink)" />
        </button>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 19, color: 'var(--ink)', margin: 0 }}>
          Paiement
        </h1>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px 8px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* address / pickup */}
        <section>
          <h3 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', margin: '0 0 10px' }}>
            {mode === 'retrait' ? 'Point de retrait' : 'Adresse de livraison'}
          </h3>

          {mode === 'retrait' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {branches.length === 0 && (
                <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13, color: 'var(--muted)' }}>Aucune agence ouverte au retrait.</div>
              )}
              {branches.map((b) => {
                const sel = b.id === pickupBranch?.id;
                return (
                  <div
                    key={b.id}
                    role="button"
                    onClick={() => setPickupBranchId(b.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      textAlign: 'left',
                      background: '#fff',
                      border: sel ? '1.5px solid var(--brand)' : '1px solid var(--line)',
                      borderRadius: 16,
                      padding: '14px 15px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(19,124,139,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="store" size={20} color="var(--brand)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{b.name}</div>
                      {b.address && <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>{b.address}</div>}
                      <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                        {b.phone && (
                          <a
                            href={`tel:${b.phone.replace(/[^0-9+]/g, '')}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}
                          >
                            <Icon name="phone" size={12} color="var(--muted)" /> {b.phone}
                          </a>
                        )}
                        <a
                          href={branchMaps(b)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: 'var(--brand)', textDecoration: 'none' }}
                        >
                          <Icon name="pin" size={12} color="var(--brand)" /> Voir sur Maps
                        </a>
                      </div>
                    </div>
                    <span style={{ width: 20, height: 20, borderRadius: 999, border: sel ? 'none' : '1.5px solid var(--line)', background: sel ? 'var(--brand)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {sel && <Icon name="check" size={13} color="#fff" strokeWidth={2.4} />}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : addresses.length === 0 ? (
            // No saved address — prompt the user to add one.
            <button
              onClick={() => router.push('/profile/addresses')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                textAlign: 'left',
                background: '#fff',
                border: '1.5px dashed var(--brand)',
                borderRadius: 16,
                padding: '14px 15px',
                cursor: 'pointer',
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(19,124,139,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="plus" size={20} color="var(--brand)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--brand)' }}>Ajouter une adresse</div>
                <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>Enregistrez votre adresse de livraison</div>
              </div>
              <Icon name="right" size={18} color="var(--muted)" />
            </button>
          ) : (
            <>
              {/* Selected address card — tap to switch */}
              <button
                onClick={() => setPickerOpen((o) => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  textAlign: 'left',
                  background: '#fff',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: '14px 15px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(19,124,139,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="pin" size={20} color="var(--brand)" fill />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                    {selectedAddress?.label ?? 'Adresse'}
                  </div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedAddress ? formatAddress(selectedAddress) : 'Choisir une adresse'}
                  </div>
                </div>
                <Icon name={pickerOpen ? 'down' : 'edit'} size={19} color="var(--brand)" />
              </button>

              {/* Picker: other saved addresses + manage link */}
              {pickerOpen && (
                <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', marginTop: 8 }}>
                  {addresses.map((a, i) => {
                    const on = a.id === addressId;
                    const z = zones.find((zz) => zz.id === a.zone_id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => {
                          setAddressId(a.id);
                          setPickerOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 11,
                          width: '100%',
                          textAlign: 'left',
                          background: on ? 'rgba(19,124,139,0.06)' : '#fff',
                          border: 'none',
                          borderTop: i ? '1px solid var(--line)' : 'none',
                          padding: '13px 15px',
                          cursor: 'pointer',
                        }}
                      >
                        <Icon name="pin" size={17} color={on ? 'var(--brand)' : 'var(--muted)'} fill={on} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>
                            {a.label}
                            {a.is_default && (
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--brand)', background: 'var(--soft)', padding: '1px 7px', borderRadius: 999, marginLeft: 7 }}>Par défaut</span>
                            )}
                          </div>
                          <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {[formatAddress(a), z ? formatDH(z.fee_dh) : null].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        {on && <Icon name="check" size={17} color="var(--brand)" strokeWidth={2.4} />}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => router.push('/profile/addresses')}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', background: '#fff', border: 'none', borderTop: '1px solid var(--line)', padding: '13px 15px', cursor: 'pointer' }}
                  >
                    <Icon name="plus" size={17} color="var(--brand)" />
                    <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, fontWeight: 600, color: 'var(--brand)' }}>Gérer mes adresses</span>
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* contact phone — so the driver and the gérant can reach the customer */}
        <section>
          <h3 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', margin: '0 0 10px' }}>
            Téléphone de contact
          </h3>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 14, display: 'flex' }}>
              <Icon name="phone" size={18} color="var(--muted)" />
            </span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-label="Téléphone de contact"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              style={{
                width: '100%',
                padding: '13px 14px 13px 42px',
                borderRadius: 14,
                border: '1.5px solid var(--line)',
                background: '#fff',
                fontFamily: 'var(--ui-font)',
                fontSize: 14.5,
                color: 'var(--ink)',
                outline: 'none',
              }}
            />
          </div>
          <p style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', margin: '7px 2px 0' }}>
            Le livreur pourra vous appeler à ce numéro.
          </p>
        </section>

        {/* time slot — transmis avec la commande (0054) */}
        <section>
          <h3 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', margin: '0 0 10px' }}>
            Créneau {mode === 'retrait' ? 'de retrait' : 'de livraison'}
          </h3>
          <div role="group" aria-label="Choisir un créneau" style={{ display: 'flex', gap: 9 }}>
            {slots.map((s) => {
              const on = slot === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSlot(s.id)}
                  aria-pressed={on}
                  style={{
                    flex: 1,
                    padding: '12px 6px',
                    borderRadius: 14,
                    cursor: 'pointer',
                    textAlign: 'center',
                    background: on ? 'rgba(19,124,139,0.07)' : '#fff',
                    border: `1.5px solid ${on ? 'var(--brand)' : 'var(--line)'}`,
                  }}
                >
                  <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13, color: on ? 'var(--brand)' : 'var(--ink)' }}>
                    {s.label}
                  </div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.hint}</div>
                </button>
              );
            })}
          </div>
          {chosenSlot?.at && (
            <p style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', margin: '7px 2px 0' }}>
              La cuisine préparera votre commande pour {slotLabel(chosenSlot)?.toLowerCase()}.
            </p>
          )}
        </section>

        {/* payment */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', margin: 0 }}>
            Moyen de paiement
          </h3>

          {PAY_OPTIONS.map(payOption)}

          {/* Le paiement en ligne n'est pas branché : on le dit, au lieu de
              montrer une carte enregistrée qui n'existe pas. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 13,
              border: '1px dashed var(--line)',
              borderRadius: 16,
              padding: '14px 15px',
              opacity: 0.75,
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="card" size={20} color="var(--muted)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--muted)' }}>Carte bancaire en ligne</div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                Bientôt disponible — paiement sécurisé CMI
              </div>
            </div>
          </div>

          {pay !== 'cod' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(168,151,35,0.07)', border: '1px solid rgba(168,151,35,0.3)', borderRadius: 14, padding: '12px 14px' }}>
              <Icon name="info" size={18} color="var(--gold)" />
              <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.45 }}>
                L&apos;agence vous appelle après confirmation pour finaliser le paiement. La commande n&apos;est préparée qu&apos;une fois le règlement convenu.
              </span>
            </div>
          )}
        </section>

        {/* loyalty redemption paliers */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', margin: 0 }}>
              Payer avec mes points
            </h3>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: 'var(--gold)' }}>
              <Icon name="star" size={13} color="var(--gold)" fill /> {points.toLocaleString('fr-FR')} pts
            </span>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            {REDEEM_PALIERS.map((r) => {
              const on = redeem === r.pts;
              const ok = points >= r.pts;
              return (
                <button
                  key={r.pts}
                  disabled={!ok}
                  onClick={() => setRedeem(on ? null : r.pts)}
                  style={{
                    flex: 1,
                    padding: '12px 6px',
                    borderRadius: 14,
                    textAlign: 'center',
                    cursor: ok ? 'pointer' : 'default',
                    background: on ? 'rgba(168,151,35,0.1)' : '#fff',
                    border: `1.5px solid ${on ? 'var(--gold)' : 'var(--line)'}`,
                    opacity: ok ? 1 : 0.45,
                  }}
                >
                  <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: on ? 'var(--gold)' : 'var(--ink)' }}>
                    {PALIER_LABELS[r.dh] ?? `${r.dh} DH`}
                  </div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{r.pts} pts</div>
                </button>
              );
            })}
          </div>
          {palier && bill.pointsDiscount > 0 && (
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--gold)', fontWeight: 600, marginTop: 9 }}>
              ✓ {palier.pts} points échangés contre {formatDH(bill.pointsDiscount)} de réduction
            </div>
          )}
        </section>

        {/* promo code */}
        <section>
          <h3 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', margin: '0 0 8px' }}>
            Code promo
          </h3>
          {appliedPromo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(19,124,139,0.07)', border: '1px solid var(--brand)', borderRadius: 14, padding: '12px 14px' }}>
              <Icon name="tag" size={18} color="var(--brand)" />
              <div style={{ flex: 1, fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--ink)' }}>
                <strong>{appliedPromo.code}</strong> appliqué · −{formatDH(appliedPromo.discount)}
              </div>
              <button onClick={clearPromo} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--gold)' }}>
                Retirer
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                  placeholder="Entrez votre code"
                  aria-label="Code promo"
                  style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--line)', background: '#fff', fontFamily: 'var(--ui-font)', fontSize: 14, color: 'var(--ink)', letterSpacing: 0.5, textTransform: 'uppercase', outline: 'none' }}
                />
                <button
                  onClick={applyPromo}
                  disabled={promoBusy || !promoInput.trim()}
                  style={{ border: 'none', borderRadius: 12, padding: '0 18px', cursor: promoBusy || !promoInput.trim() ? 'default' : 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: '#fff', background: 'var(--brand)', opacity: promoBusy || !promoInput.trim() ? 0.5 : 1 }}
                >
                  {promoBusy ? '…' : 'Appliquer'}
                </button>
              </div>
              {promoMsg && <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--gold)', fontWeight: 600, marginTop: 7 }}>{promoMsg}</div>}
            </>
          )}
        </section>

        {/* bill */}
        <section>
          <h3 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', margin: '0 0 8px' }}>
            Détails de la facture
          </h3>
          <div style={{ background: 'var(--soft)', borderRadius: 16, padding: '14px 16px' }}>
            <Row label="Sous-total" value={formatDH(bill.subtotal)} />
            <Row
              label={mode === 'retrait' ? 'Retrait' : `Livraison${zone ? ' · ' + zone.name : ''}`}
              value={bill.deliveryFee === 0 ? 'Offerte' : formatDH(bill.deliveryFee)}
              green={bill.deliveryFee === 0}
            />
            {bill.discount > 0 && (
              <Row label={appliedPromo ? `Code ${appliedPromo.code}` : 'Remise'} value={`– ${formatDH(bill.discount)}`} gold />
            )}
            {bill.pointsDiscount > 0 && palier && (
              <Row label={`Points fidélité (−${palier.pts} pts)`} value={`– ${formatDH(bill.pointsDiscount)}`} gold />
            )}
            <div style={{ height: 1, background: 'var(--line)', margin: '9px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
                {pay === 'cod' ? 'À régler à la livraison' : 'Total à payer'}
              </span>
              <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 20, color: 'var(--brand)' }}>{formatDH(bill.total)}</span>
            </div>
          </div>
        </section>
      </div>

      <div
        style={{
          flexShrink: 0,
          background: '#fff',
          borderTop: '1px solid var(--line)',
          padding: `12px 18px ${SAFE_BOTTOM + 12}px`,
        }}
      >
        <Btn full size="lg" onClick={confirm} disabled={busy || items.length === 0}>
          {busy ? 'Traitement…' : `Confirmer la commande · ${formatDH(bill.total)}`}
        </Btn>
      </div>
    </div>
  );
}
