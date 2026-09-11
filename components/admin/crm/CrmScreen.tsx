'use client';
// Admin Clients (CRM), in the language of the Vue d'ensemble: headline figures
// (customers, VIP, revenue, mean spend), segment chips with counts plus "À
// relancer" (no order for 30 days), sort chips, a searchable list and a detail
// panel with the customer's figures, call / WhatsApp links, an editable note
// (admin_set_customer_note) and their order history. The rows come aggregated
// from Postgres (admin_customer_rows, 0051) and the history is fetched for the
// selected customer only (admin_customer_orders).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatAmount, formatDH } from '@/lib/format';
import { orderStatusLabel } from '@/lib/order-status';
import { Icon } from '@/components/ui/Icon';
import { DORMANT_DAYS, SEGMENTS, crmTotals, daysSince, isDormant, queryCustomers, type CrmOrder, type CustomerRow, type CustomerSort, type Segment } from '@/lib/admin-crm';
import { HeroStat, MiniStat } from '@/components/admin/overview/HeroStat';
import { Chip, EmptyState, GlassPanel, PageHeader, PanelTitle, Pill, PrimaryButton, SearchField, fieldStyle, labelStyle, orderStatusTone, type PillTone } from '@/components/admin/ui/Glass';

const SEGMENT_TONE: Record<Segment, PillTone> = { VIP: 'accent', 'Régulier': 'outline', Nouveau: 'muted' };
const SORTS: { value: CustomerSort; label: string }[] = [
  { value: 'spend', label: 'Dépense' },
  { value: 'orders', label: 'Commandes' },
  { value: 'recent', label: 'Récents' },
];
const text = { fontFamily: 'var(--ui-font)' } as const;

function dateLabel(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Casablanca' });
}

function sinceLabel(iso: string | null): string {
  const d = daysSince(iso);
  if (d === null) return 'Jamais';
  if (d === 0) return "Aujourd'hui";
  return `Il y a ${d} j`;
}

function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <div style={{ ...text, width: size, height: size, borderRadius: 999, background: 'var(--soft)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 600, color: 'var(--ink)', fontSize: size * 0.38 }}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function CrmScreen({ rows }: { rows: CustomerRow[] }) {
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<Segment | 'all' | 'dormant'>('all');
  const [sort, setSort] = useState<CustomerSort>('spend');
  const [selected, setSelected] = useState<string | null>(rows[0]?.id ?? null);
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.id, r.note ?? ''])));
  const [savingNote, setSavingNote] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [history, setHistory] = useState<CrmOrder[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const totals = useMemo(() => crmTotals(rows), [rows]);
  const visible = useMemo(() => queryCustomers(rows, query, segment, sort), [rows, query, segment, sort]);
  const active = useMemo(() => rows.find((r) => r.id === selected) ?? null, [rows, selected]);

  // The selected customer's recent orders, on demand.
  const loadHistory = useCallback(async (userId: string) => {
    setLoadingHistory(true);
    const { data } = await createClient().rpc('admin_customer_orders', { p_user: userId, p_limit: 25 });
    setHistory((data ?? []) as CrmOrder[]);
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    if (!selected) {
      setHistory([]);
      return;
    }
    loadHistory(selected);
  }, [selected, loadHistory]);

  async function saveNote() {
    if (!active) return;
    setSavingNote(true);
    const { error } = await createClient().rpc('admin_set_customer_note', { p_user: active.id, p_note: notes[active.id] ?? '' });
    setSavingNote(false);
    setSavedNote(error ? null : active.id);
  }

  return (
    <div style={{ padding: '30px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader title="Clients" subtitle="Qui commande, combien, et quand relancer." />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 56px' }}>
        <HeroStat label="Clients" value={formatAmount(totals.customers)} />
        <HeroStat label="VIP" value={String(totals.bySegment.VIP)} />
        <HeroStat label="Dépensé au total" value={formatAmount(totals.spend)} unit="DH" />
        <HeroStat label="Dépense moyenne par client" value={formatAmount(totals.avgSpend)} unit="DH" />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div role="group" aria-label="Filtrer par segment" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip on={segment === 'all'} onClick={() => setSegment('all')} count={totals.customers}>
            Tous
          </Chip>
          {SEGMENTS.map((s) => (
            <Chip key={s} on={segment === s} onClick={() => setSegment(s)} count={totals.bySegment[s]}>
              {s}
            </Chip>
          ))}
          <Chip on={segment === 'dormant'} onClick={() => setSegment('dormant')} count={totals.dormant} title={`Aucune commande depuis ${DORMANT_DAYS} jours`}>
            À relancer
          </Chip>
        </div>
        <div role="group" aria-label="Trier les clients" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
          {SORTS.map((s) => (
            <Chip key={s.value} on={sort === s.value} onClick={() => setSort(s.value)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(0, 1fr)', gap: 22, alignItems: 'start' }}>
        <GlassPanel padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 16px 12px', display: 'flex' }}>
            <SearchField value={query} onChange={setQuery} label="Rechercher un client" placeholder="Nom ou téléphone…" />
          </div>
          <div style={{ maxHeight: 640, overflowY: 'auto' }}>
            {visible.length === 0 ? (
              <EmptyState title="Aucun client." hint={query ? 'Essayez un autre nom ou numéro.' : undefined} />
            ) : (
              visible.map((r) => {
                const on = r.id === selected;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelected(r.id);
                      setSavedNote(null);
                    }}
                    aria-current={on ? 'true' : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 16px', cursor: 'pointer', border: 'none', borderTop: '1px solid var(--line)', borderLeft: `3px solid ${on ? '#ffffff' : 'transparent'}`, background: on ? 'var(--soft)' : 'transparent' }}
                  >
                    <Avatar name={r.name} size={38} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ ...text, fontWeight: 600, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                      <div style={{ ...text, fontSize: 12, color: 'var(--muted)' }}>
                        {r.orders} cmd · {r.phone ?? 'sans tél.'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <div style={{ ...text, fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{formatDH(r.spend)}</div>
                      <Pill tone={SEGMENT_TONE[r.segment]}>{r.segment}</Pill>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </GlassPanel>

        <GlassPanel>
          {!active ? (
            <EmptyState title="Sélectionnez un client." />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Avatar name={active.name} size={50} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ ...text, margin: 0, fontWeight: 600, fontSize: 19, color: 'var(--ink)' }}>{active.name}</h2>
                  <div style={{ ...text, fontSize: 12.5, color: 'var(--muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {active.phone ?? 'Sans téléphone'}
                    <Pill tone={SEGMENT_TONE[active.segment]}>{active.segment}</Pill>
                    {isDormant(active) && <Pill tone="accent">À relancer</Pill>}
                  </div>
                </div>
                {active.phone &&
                  (() => {
                    const digits = active.phone.replace(/[^0-9]/g, '');
                    const wa = digits.startsWith('0') ? '212' + digits.slice(1) : digits;
                    const link = { width: 40, height: 40, borderRadius: 999, border: '1px solid var(--a-glass-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' } as const;
                    return (
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <a href={`tel:${active.phone.replace(/[^0-9+]/g, '')}`} aria-label={`Appeler ${active.name}`} style={link}>
                          <Icon name="phone" size={17} color="var(--ink)" />
                        </a>
                        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${active.name}`} style={link}>
                          <Icon name="message" size={17} color="var(--ink)" />
                        </a>
                      </div>
                    );
                  })()}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16, marginTop: 20 }}>
                <MiniStat label="Total dépensé" value={formatAmount(active.spend)} unit="DH" />
                <MiniStat label="Commandes" value={String(active.orders)} />
                <MiniStat label="Panier moyen" value={active.orders ? formatAmount(Math.round(active.spend / active.orders)) : '—'} unit={active.orders ? 'DH' : undefined} />
                <MiniStat label={`Points · ${active.tier ?? 'sans palier'}`} value={formatAmount(active.points)} />
              </div>
              <div style={{ ...text, fontSize: 12.5, color: 'var(--muted)', marginTop: 12 }}>Dernière commande : {sinceLabel(active.lastOrder)}</div>

              <div style={{ marginTop: 20 }}>
                <label style={labelStyle} htmlFor="crm-note">
                  Note interne
                </label>
                <textarea
                  id="crm-note"
                  value={notes[active.id] ?? ''}
                  onChange={(e) => {
                    setNotes((n) => ({ ...n, [active.id]: e.target.value }));
                    setSavedNote(null);
                  }}
                  placeholder="Préférences, allergies, remarques…"
                  style={{ ...fieldStyle, minHeight: 72, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <PrimaryButton onClick={saveNote} disabled={savingNote}>
                    {savingNote ? '…' : 'Enregistrer la note'}
                  </PrimaryButton>
                  {savedNote === active.id && <span style={{ ...text, fontSize: 12.5, color: 'var(--muted)' }}>Note enregistrée ✓</span>}
                </div>
              </div>

              <div style={{ marginTop: 22 }}>
                <PanelTitle aside={loadingHistory ? 'Chargement…' : `${history.length} commande${history.length > 1 ? 's' : ''}`}>Historique</PanelTitle>
                {!loadingHistory && history.length === 0 ? (
                  <EmptyState title="Aucune commande." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {history.map((o) => (
                      <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px', borderTop: '1px solid var(--line)' }}>
                        <Icon name="receipt" size={15} color="var(--muted)" />
                        <span style={{ ...text, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{o.code}</span>
                        <span style={{ ...text, fontSize: 12, color: 'var(--muted)', flex: 1 }}>{dateLabel(o.placed_at)}</span>
                        <Pill tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</Pill>
                        <span style={{ ...text, fontSize: 13, fontWeight: 600, color: 'var(--ink)', minWidth: 70, textAlign: 'right' }}>{formatDH(o.total_dh)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}

