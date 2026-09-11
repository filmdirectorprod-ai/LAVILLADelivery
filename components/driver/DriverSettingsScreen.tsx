'use client';
// Paramètres livreur — quelques préférences, volontairement LOCALES à
// l'appareil (localStorage) : il n'existe pas encore de table de réglages, et
// l'écran le dit maintenant à l'utilisateur au lieu de laisser croire à une
// synchronisation. Style de l'admin : panneaux de verre, interrupteurs or.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SAFE_BOTTOM } from '@/lib/layout';
import { Icon } from '@/components/ui/Icon';
import { DriverHeader, Panel, SectionTitle, Switch, text } from '@/components/driver/ui/DriverUI';

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
      /* préférences illisibles — on garde les valeurs par défaut */
    }
  }, []);

  const update = (patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {
        /* stockage indisponible — on garde en mémoire */
      }
      return next;
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <DriverHeader title="Paramètres" subtitle="Réglages de cet appareil" onBack={() => router.push('/driver/profile')} />

      <div style={{ padding: `4px 16px ${SAFE_BOTTOM + 16}px`, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <SectionTitle>Notifications</SectionTitle>
          <Panel padding={0}>
            <ToggleRow
              icon="bell"
              label="Notifications de commande"
              on={prefs.notifications}
              onToggle={() => update({ notifications: !prefs.notifications })}
            />
            <ToggleRow icon="message" label="Sons" on={prefs.sound} onToggle={() => update({ sound: !prefs.sound })} last />
          </Panel>
          <p style={{ ...text, fontSize: 12, color: 'var(--a-muted)', margin: '8px 4px 0', lineHeight: 1.45 }}>
            Ces réglages ne valent que sur ce téléphone : ils ne suivent pas votre compte.
          </p>
        </div>

        <div>
          <SectionTitle>Application</SectionTitle>
          <Panel padding={0}>
            <InfoRow icon="info" label="Langue" value="Français" />
            <InfoRow icon="info" label="Version" value={APP_VERSION} last />
          </Panel>
        </div>

        <div style={{ ...text, fontSize: 12, color: 'var(--a-muted)', textAlign: 'center', marginTop: 6 }}>La Villa · Livreur</div>
      </div>
    </div>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', minHeight: 56, borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <Icon name={icon} size={19} color="var(--ink)" />
      <span style={{ ...text, flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
      <Switch checked={on} onChange={onToggle} label={label} />
    </div>
  );
}

function InfoRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', minHeight: 56, borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <Icon name={icon} size={19} color="var(--ink)" />
      <span style={{ ...text, flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
      <span style={{ ...text, fontSize: 13.5, color: 'var(--muted)' }}>{value}</span>
    </div>
  );
}
