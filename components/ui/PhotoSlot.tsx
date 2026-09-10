// Brand-tinted labeled placeholder (photo-ready).
//
// When a photo is present it renders through next/image: product shots come
// from Supabase Storage at full upload size, and this used to paint them as a
// CSS background — no resizing, no modern format, no lazy loading, the whole
// original file on every card. `fill` + `sizes` lets Next serve a width that
// matches the slot; `priority` opts the one above-the-fold image out of lazy
// loading. The empty state is unchanged.
import type { CSSProperties } from 'react';
import Image from 'next/image';

export interface PhotoSlotProps {
  label?: string;
  src?: string | null;
  style?: CSSProperties;
  rounded?: number;
  dim?: boolean;
  /** Rendered width hint for the srcset picker. Defaults to a full-width slot. */
  sizes?: string;
  /** Set on the hero / above-the-fold image only — it disables lazy loading. */
  priority?: boolean;
}

export function PhotoSlot({
  label = 'photo',
  src,
  style = {},
  rounded = 0,
  dim = false,
  sizes = '100vw',
  priority = false,
}: PhotoSlotProps) {
  const base: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: rounded,
    background: src
      ? undefined
      : 'repeating-linear-gradient(135deg, var(--soft) 0 14px, #eef1f1 14px 28px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  };
  if (src) {
    return (
      <div style={base}>
        <Image src={src} alt={label} fill sizes={sizes} priority={priority} style={{ objectFit: 'cover' }} />
      </div>
    );
  }
  return (
    <div style={base}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(150deg, rgba(19,124,139,0.06), rgba(168,151,35,0.05))',
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          color: 'var(--muted)',
          opacity: dim ? 0.55 : 0.8,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="8.5" cy="10" r="1.6" fill="currentColor" />
          <path
            d="M5 17l4.5-4 3 2.5L16 11l3 3.2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 10.5,
            letterSpacing: 0.2,
            textTransform: 'lowercase',
            textAlign: 'center',
            maxWidth: '85%',
            lineHeight: 1.3,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
