// components/ui/BranchesInfo.tsx — the two La Villa shops, rendered from the single
// lib/branches source so the customer, driver and admin apps always show the exact
// same addresses.
'use client';
import { Icon } from '@/components/ui/Icon';
import { LA_VILLA_BRANCHES, branchMapsUrl } from '@/lib/branches';

export function BranchesInfo({ title = 'Nos boutiques' }: { title?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px' }}>
      <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {LA_VILLA_BRANCHES.map((b) => (
          <div key={b.id} style={{ display: 'flex', gap: 11 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(19,124,139,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="store" size={17} color="var(--brand)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--ui-font)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{b.name}</div>
              <div style={{ fontFamily: 'var(--ui-font)', fontSize: 12.5, color: 'var(--muted)' }}>{b.address}</div>
              <a
                href={branchMapsUrl(b)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 600, color: 'var(--brand)', textDecoration: 'none' }}
              >
                <Icon name="pin" size={13} color="var(--brand)" /> Voir sur Maps
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
