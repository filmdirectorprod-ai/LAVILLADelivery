'use client';
// Driver settings — back-button header (no bottom tab bar here) plus a few
// client-local preferences. These toggles are intentionally device-local for
// now (persisted to localStorage); there's no settings table yet, so we keep the
// surface honest rather than faking server persistence.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SAFE_TOP, SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';

const APP_VERSION = '1.0.0';
const STORE_KEY = 'lv-driver-prefs';

interface Prefs {
  notifications: boolean;
  sound: boolean;
}

const DEFAULT_PREFS: Prefs = { notifications: true, sound: true };

export function DriverSettingsScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {
      /* ignore corrupt prefs */
    }
  }, []);

  const update = (patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — keep in-memory */
      }
      return next;
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: `${SAFE_TOP + 4}px 16px 14px`,
          background: 'var(--brand-d)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={() => router.push('/driver/profile')}
          aria-label="Retour"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: 'none',
            background: 'rgba(255,255,255,0.16)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="left" size={20} color="#fff" />
        </button>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontWeight: 700, fontSize: 18, color: '#fff', margin: 0 }}>
          Paramètres
        </h1>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: `16px 16px ${SAFE_BOTTOM + 16}px` }}>
        <SectionTitle>Notifications</SectionTitle>
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)' }}>
          <ToggleRow
            icon="bell"
            label="Notifications de commande"
            on={prefs.notifications}
            onToggle={() => update({ notifications: !prefs.notifications })}
          />
          <ToggleRow
            icon="message"
            label="Sons"
            on={prefs.sound}
            onToggle={() => update({ sound: !prefs.sound })}
            last
          />
        </div>

        <div style={{ height: 18 }} />
        <SectionTitle>Application</SectionTitle>
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 6px 18px -14px rgba(0,0,0,0.3)' }}>
          <InfoRow icon="info" label="Langue" value="Français" />
          <InfoRow icon="info" label="Version" value={APP_VERSION} last />
        </div>

        <div
          style={{
            fontFamily: 'var(--ui-font)',
            fontSize: 11.5,
            color: 'var(--muted)',
            textAlign: 'center',
            marginTop: 22,
          }}
        >
          La Villa · Livreur
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: 'var(--ui-font)',
        fontWeight: 700,
        fontSize: 12.5,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        color: 'var(--muted)',
        margin: '0 0 8px 4px',
      }}
    >
      {children}
    </h2>
  );
}

function ToggleRow({
  icon,
  label,
  on,
  onToggle,
  last,
}: {
  icon: string;
  label: string;
  on: boolean;
  onToggle: () => void;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderBottom: last ? 'none' : '1px solid var(--line)',
      }}
    >
      <Icon name={icon} size={19} color="var(--brand)" />
      <span style={{ flex: 1, fontFamily: 'var(--ui-font)', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>
        {label}
      </span>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={on}
        aria-label={label}
        style={{
          width: 46,
          height: 28,
          borderRadius: 999,
          border: 'none',
          cursor: 'pointer',
          background: on ? 'var(--brand)' : 'var(--line)',
          position: 'relative',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: on ? 21 : 3,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: '#fff',
            transition: 'left 0.15s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </button>
    </div>
  );
}

function InfoRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderBottom: last ? 'none' : '1px solid var(--line)',
      }}
    >
      <Icon name={icon} size={19} color="var(--brand)" />
      <span style={{ flex: 1, fontFamily: 'var(--ui-font)', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--ui-font)', fontSize: 13.5, color: 'var(--muted)' }}>{value}</span>
    </div>
  );
}
