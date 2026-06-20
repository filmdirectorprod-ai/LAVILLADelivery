'use client';
// Admin CRM: searchable customer list (spend / orders / loyalty / segment) with a
// detail panel showing the customer's order history and an editable note
// (admin_set_customer_note). Figures are RLS-scoped to the caller's agency.
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDH } from '@/lib/format';
import { orderStatusLabel } from '@/lib/order-status';
import { Icon } from '@/components/ui/Icon';
import { filterCustomers, type CustomerRow, type CrmOrder, type Segment } from '@/lib/admin-crm';

const SEGMENT_COLOR: Record<Segment, string> = { VIP: '#a07b1e', 'Régulier': '#137c8b', Nouveau: '#6b7280' };

function dateLabel(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function CrmScreen({ rows, orders }: { rows: CustomerRow[]; orders: CrmOrder[] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(rows[0]?.id ?? null);
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.id, r.note ?? ''])));
  const [savingNote, setSavingNote] = useState(false);

  const visible = useMemo(() => filterCustomers(rows, query), [rows, query]);
  const active = useMemo(() => rows.find((r) => r.id === selected) ?? null, [rows, selected]);
  const history = useMemo(
    () => (active ? orders.filter((o) => o.user_id === active.id) : []),
    [orders, active],
  );

  async function saveNote() {
    if (!active) return;
    setSavingNote(true);
    await createClient().rpc('admin_set_customer_note', { p_user: active.id, p_note: notes[active.id] ?? '' });
    setSavingNote(false);
  }

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18, height: '100%', boxSizing: 'border-box' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', margin: 0 }}>Clients</h1>
        <p style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
          {rows.length} client{rows.length > 1 ? 's' : ''} · triés par total dépensé
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.3fr) minmax(0, 1fr)', gap: 18, flex: 1, minHeight: 0 }}>
        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un client (nom ou téléphone)…"
            style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', fontFamily: 'var(--ui-font)', fontSize: 14 }}
          />
          <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, overflow: 'auto', flex: 1, minHeight: 0 }}>
            {visible.length === 0 ? (
              <div style={{ padding: '32px 18px', textAlign: 'center', fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>Aucun client.</div>
            ) : (
              visible.map((r, i) => {
                const on = r.id === selected;
                return (
                  <button key={r.id} onClick={() => setSelected(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 16px', cursor: 'pointer', border: 'none', borderTop: i ? '1px solid var(--soft)' : 'none', background: on ? 'rgba(19,124,139,0.06)' : '#fff' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 999, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--ui-font)', fontWeight: 700, color: 'var(--brand)', fontSize: 14 }}>
                      {r.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                      <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)' }}>{r.orders} cmd · {r.phone ?? 'sans tél.'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 13.5, color: 'var(--brand)' }}>{formatDH(r.spend)}</div>
                      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 10.5, fontWeight: 700, color: SEGMENT_COLOR[r.segment] }}>{r.segment}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail */}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: 22, overflow: 'auto', minHeight: 0 }}>
          {!active ? (
            <div style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>Sélectionnez un client.</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 999, background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--ui-font)', fontWeight: 700, color: 'var(--brand)', fontSize: 18 }}>{active.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>{active.name}</div>
                  <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>{active.phone ?? 'Sans téléphone'} · <span style={{ color: SEGMENT_COLOR[active.segment], fontWeight: 700 }}>{active.segment}</span></div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                {[['Total', formatDH(active.spend)], ['Commandes', String(active.orders)], ['Points', String(active.points)], ['Palier', active.tier ?? '—']].map(([l, v]) => (
                  <div key={l} style={{ flex: 1, minWidth: 90, background: 'var(--soft)', borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ fontFamily: 'var(--ui-font)', fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{l}</div>
                    <div style={{ fontFamily: 'var(--ui-font)', fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginTop: 3 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Note */}
              <div style={{ marginTop: 18 }}>
                <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>Note interne</div>
                <textarea
                  value={notes[active.id] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [active.id]: e.target.value }))}
                  placeholder="Préférences, allergies, remarques…"
                  style={{ width: '100%', minHeight: 64, resize: 'vertical', fontFamily: 'var(--ui-font)', fontSize: 13.5, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
                />
                <button onClick={saveNote} disabled={savingNote} style={{ marginTop: 8, border: 'none', borderRadius: 10, padding: '9px 18px', cursor: 'pointer', fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13, color: '#fff', background: 'var(--brand)', opacity: savingNote ? 0.6 : 1 }}>
                  {savingNote ? '…' : 'Enregistrer la note'}
                </button>
              </div>

              {/* History */}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 10 }}>Historique ({history.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.slice(0, 25).map((o) => (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10 }}>
                      <Icon name="receipt" size={15} color="var(--muted)" />
                      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{o.code}</span>
                      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 12, color: 'var(--muted)', flex: 1 }}>{dateLabel(o.placed_at)} · {orderStatusLabel(o.status as never)}</span>
                      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>{formatDH(o.total_dh)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
