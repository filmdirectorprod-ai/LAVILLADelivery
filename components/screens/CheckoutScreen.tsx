'use client';
// PAIEMENT / CHECKOUT — ported from the prototype (screens-order.jsx Checkout),
// adapted to the cart/order stores + the server-authoritative place_order RPC
// (POST /api/orders). The bill shown here is a preview; the server recomputes.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Address, Product, Profile, Zone } from '@/lib/types';
import { formatDH } from '@/lib/format';
import { computeOrder, REDEEM_PALIERS } from '@/lib/pricing';
import { LA_VILLA_BRANCHES, DEFAULT_BRANCH, findBranch, branchPickupLabel, branchMapsUrl, branchTelHref } from '@/lib/branches';
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
}

/** One-line human address used both for display and the order payload. */
function formatAddress(a: Address): string {
  return [a.line1, a.details, a.city].filter(Boolean).join(', ');
}

type Pay = 'cmi' | 'hps' | 'cashplus' | 'virement' | 'cod';

const PALIER_LABELS: Record<number, string> = { 25: '25 DH', 60: '60 DH', 130: '130 DH' };

function Row({
  label,
  value,
  gold,
  green,
}: {
  label: string;
  value: string;
  gold?: boolean;
  green?: boolean;
}) {
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

export function CheckoutScreen({ products, zones, addresses, profile }: CheckoutScreenProps) {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);
  const mode = useOrderMode((s) => s.mode);
  const promo = useOrderMode((s) => s.promo);
  const setPromo = useOrderMode((s) => s.setPromo);
  const toast = useToast((s) => s.show);

  const [pay, setPay] = useState<Pay>('cmi');
  const [slot, setSlot] = useState('asap');
  const [redeem, setRedeem] = useState<number | null>(null); // palier pts
  const [busy, setBusy] = useState(false);
  // Contact phone for this order — so the driver (and gérant) can call. Prefilled
  // from the profile, else the default address.
  const [phone, setPhone] = useState<string>(profile?.phone ?? addresses[0]?.phone ?? '');

  // Selected delivery address — defaults to the user's default (addresses are
  // already ordered default-first by the query), falling back to the first one.
  const defaultAddressId = addresses[0]?.id ?? null;
  const [addressId, setAddressId] = useState<string | null>(defaultAddressId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickupBranchId, setPickupBranchId] = useState(DEFAULT_BRANCH.id);
  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === addressId) ?? null,
    [addresses, addressId],
  );

  // The delivery zone is derived from the chosen address; if it has no zone (or
  // we're on pickup), fall back to the cheapest zone for the fee preview.
  const zone = useMemo<Zone | null>(() => {
    if (mode === 'retrait') return null;
    const fromAddress = zones.find((z) => z.id === selectedAddress?.zone_id);
    return fromAddress ?? zones[0] ?? null;
  }, [mode, zones, selectedAddress]);

  const points = profile?.loyalty_points ?? 0;
  const palier = REDEEM_PALIERS.find((r) => r.pts === redeem) ?? null;

  const bill = computeOrder({
    items: items.map((it) => ({ price: it.opts.unit, qty: it.qty })),
    mode,
    zoneFee: zone?.fee_dh,
    promo,
    redeemPts: palier?.pts ?? 0,
    redeemDh: palier?.dh ?? 0,
    pointsBalance: points,
  });

  const byId = new Map(products.map((p) => [p.id, p]));

  const confirm = async () => {
    if (items.length === 0 || busy) return;
    if (mode === 'livraison' && !selectedAddress) {
      toast('Choisissez une adresse de livraison.');
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
              ? branchPickupLabel(findBranch(pickupBranchId))
              : selectedAddress
                ? formatAddress(selectedAddress)
                : '',
          phone: phone.trim(),
          branch_slug: mode === 'retrait' ? pickupBranchId : null,
          zone_id: mode === 'retrait' ? null : zone?.id ?? null,
          promo,
          redeem_pts: palier?.pts ?? 0,
          redeem_dh: palier?.dh ?? 0,
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
      setPromo(false);
      setRedeem(null);
      router.replace(`/tracking/${order_id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Échec de la commande.');
      setBusy(false);
    }
  };

  const payOption = (id: Pay, title: string, sub: string, icon: React.ReactNode) => {
    const on = pay === id;
    return (
      <button
        onClick={() => setPay(id)}
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
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{title}</div>
          {sub && <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>}
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

  const ctaLabel =
    pay === 'cod'
      ? 'Confirmer la commande'
      : pay === 'cashplus'
        ? 'Générer le code'
        : pay === 'virement'
          ? 'Confirmer le virement'
          : 'Payer maintenant';

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
              {LA_VILLA_BRANCHES.map((b) => {
                const sel = b.id === pickupBranchId;
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
                      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>{b.address}</div>
                      <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                        <a href={branchTelHref(b)} onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
                          <Icon name="phone" size={12} color="var(--muted)" /> {b.phone}
                        </a>
                        <a href={branchMapsUrl(b)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: 'var(--brand)', textDecoration: 'none' }}>
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
                        onClick={() => { setAddressId(a.id); setPickerOpen(false); }}
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

        {/* time slot */}
        <section>
          <h3 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', margin: '0 0 10px' }}>
            Créneau {mode === 'retrait' ? 'de retrait' : 'de livraison'}
          </h3>
          <div style={{ display: 'flex', gap: 9 }}>
            {(
              [
                ['asap', 'Au plus vite', mode === 'retrait' ? '15–20 min' : zone ? `~${zone.eta_min} min` : '25–35 min'],
                ['lunch', '12:30', "Aujourd'hui"],
                ['eve', '19:00', "Aujourd'hui"],
              ] as [string, string, string][]
            ).map(([id, t, s]) => {
              const on = slot === id;
              return (
                <button
                  key={id}
                  onClick={() => setSlot(id)}
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
                    {t}
                  </div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* payment */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', margin: 0 }}>
            Moyen de paiement
          </h3>

          {pay === 'cmi' && (
            <div
              style={{
                borderRadius: 18,
                padding: '18px 18px',
                background: 'linear-gradient(120deg, var(--brand), var(--brand-d))',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: -30, right: -10, width: 120, height: 120, borderRadius: 999, background: 'rgba(168,151,35,0.25)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Carte enregistrée</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 700, color: '#F0E4A8', letterSpacing: 1 }}>CMI</span>
              </div>
              <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 19, color: '#fff', letterSpacing: 2, margin: '14px 0 12px', position: 'relative' }}>
                •••• •••• •••• 4291
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'rgba(255,255,255,0.9)' }}>S. EL AMRANI</span>
                <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'rgba(255,255,255,0.9)' }}>08/27</span>
              </div>
            </div>
          )}
          {payOption('cmi', 'Carte bancaire', 'Visa · Mastercard · CMI · •••• 4291', <Icon name="card" size={20} color="var(--brand)" />)}

          {payOption('hps', 'Paiement mobile', 'Wallet / appli bancaire · traité par HPS', <Icon name="phone" size={20} color="var(--brand)" fill />)}
          {pay === 'hps' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(19,124,139,0.06)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px' }}>
              <Icon name="info" size={18} color="var(--brand)" />
              <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.4 }}>
                Vous serez redirigé vers votre application bancaire (HPS Switch) pour valider en toute sécurité.
              </span>
            </div>
          )}

          {payOption('cashplus', 'Cash Plus', 'Payer en espèces en agence', <Icon name="store" size={20} color="var(--brand)" />)}
          {pay === 'cashplus' && (
            <div style={{ background: 'rgba(168,151,35,0.07)', border: '1px solid rgba(168,151,35,0.3)', borderRadius: 14, padding: '13px 14px' }}>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>Code de paiement Cash Plus</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 19, color: 'var(--ink)', letterSpacing: 2 }}>8842 1097 36</span>
                <Icon name="tag" size={18} color="var(--gold)" />
              </div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
                À régler sous 24 h dans n&apos;importe quelle agence Cash Plus.
              </div>
            </div>
          )}

          {payOption('virement', 'Virement bancaire', 'Par RIB · validation sous 24 h', <Icon name="receipt" size={20} color="var(--brand)" />)}
          {pay === 'virement' && (
            <div style={{ background: 'var(--soft)', border: '1px solid var(--line)', borderRadius: 14, padding: '13px 14px' }}>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>RIB — La Villa SARL · Attijariwafa Bank</div>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', letterSpacing: 0.5, marginTop: 6 }}>
                007 780 0001234567890123 45
              </div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
                Indiquez votre numéro de commande en référence du virement.
              </div>
            </div>
          )}

          {payOption('cod', 'Paiement à la livraison', 'Espèces à la réception', <Icon name="cash" size={20} color="var(--brand)" />)}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
            <Icon name="check" size={15} color="var(--brand)" strokeWidth={2.4} />
            <span style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)' }}>
              Paiements 100 % sécurisés · CMI · HPS · 3-D Secure
            </span>
          </div>
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
            {bill.discount > 0 && <Row label="Remise (-15 %)" value={`– ${formatDH(bill.discount)}`} gold />}
            {bill.pointsDiscount > 0 && palier && (
              <Row label={`Points fidélité (−${palier.pts} pts)`} value={`– ${formatDH(bill.pointsDiscount)}`} gold />
            )}
            <div style={{ height: 1, background: 'var(--line)', margin: '9px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Total à payer</span>
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
          {busy ? 'Traitement…' : `${ctaLabel} · ${formatDH(bill.total)}`}
        </Btn>
      </div>
    </div>
  );
}
