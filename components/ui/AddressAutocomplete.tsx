// components/ui/AddressAutocomplete.tsx
// Address autocomplete via our own server proxy (/api/places), which calls Places
// API (New) with a key stored server-side (Supabase app_config). This keeps the key
// off the client and sidesteps browser key restrictions. Renders a styled suggestion
// list to match the form; on selection it reports the formatted address + coordinates
// so the caller can auto-detect the delivery zone (lib/geo.ts). Degrades to a plain
// input on failure — address entry never breaks.
'use client';
import { useRef, useState } from 'react';

export interface PlaceResult {
  formatted: string;
  lat: number;
  lng: number;
}

interface Suggestion {
  placeId: string;
  text: string;
}

export interface AddressAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  onPlace: (p: PlaceResult) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export function AddressAutocomplete({ value, onChange, onPlace, placeholder, style }: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchSuggestions(input: string) {
    if (input.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/places?action=autocomplete&input=${encodeURIComponent(input)}`);
      const data = await res.json();
      const list: Suggestion[] = (data.suggestions ?? []).filter((s: Suggestion) => s.placeId && s.text);
      setSuggestions(list);
      setOpen(list.length > 0);
    } catch {
      setSuggestions([]);
      setOpen(false);
    }
  }

  function onInput(v: string) {
    onChange(v);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => fetchSuggestions(v), 280);
  }

  async function choose(s: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    onChange(s.text);
    try {
      const res = await fetch(`/api/places?action=details&placeId=${encodeURIComponent(s.placeId)}`);
      const p = await res.json();
      const lat = p.lat;
      const lng = p.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        onPlace({ formatted: p.formatted || s.text, lat, lng });
      }
    } catch {
      /* keep the typed text; zone stays manual */
    }
  }

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        value={value}
        onChange={(e) => onInput(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={style}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: -30,
            right: -10,
            zIndex: 60,
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: 12,
            boxShadow: '0 16px 36px -14px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}
        >
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                borderBottom: '1px solid var(--soft)',
                background: '#fff',
                cursor: 'pointer',
                padding: '11px 14px',
                fontFamily: 'var(--ui-font)',
                fontSize: 13.5,
                color: 'var(--ink)',
              }}
            >
              {s.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
