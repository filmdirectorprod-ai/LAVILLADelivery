// components/ui/AddressAutocomplete.tsx
// Address autocomplete on Places API (New), biased to Fès / restricted to Morocco.
// Calls the REST endpoints directly (autocomplete + place details) and renders its
// own styled suggestion list, so it matches the form and avoids the deprecated
// legacy JS widget. On selection it reports the formatted address + coordinates so
// the caller can auto-detect the delivery zone (lib/geo.ts). Degrades to a plain
// input when the key is missing or a request fails — address entry never breaks.
'use client';
import { useRef, useState } from 'react';

// La Villa — 117 Av. Mohammed Bahnini, Fès: bias suggestions around the shop.
const FES = { latitude: 34.0261, longitude: -5.014 };
const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

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

function newToken(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
}

export function AddressAutocomplete({ value, onChange, onPlace, placeholder, style }: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const tokenRef = useRef<string>(newToken());
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchSuggestions(input: string) {
    if (!KEY || input.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY },
        body: JSON.stringify({
          input,
          includedRegionCodes: ['ma'],
          locationBias: { circle: { center: FES, radius: 25000 } },
          sessionToken: tokenRef.current,
        }),
      });
      const data = await res.json();
      const list: Suggestion[] = (data.suggestions ?? [])
        .map((x: { placePrediction?: { placeId?: string; text?: { text?: string } } }) => ({
          placeId: x.placePrediction?.placeId ?? '',
          text: x.placePrediction?.text?.text ?? '',
        }))
        .filter((s: Suggestion) => s.placeId && s.text);
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
    if (!KEY) return;
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${s.placeId}?sessionToken=${tokenRef.current}`,
        { headers: { 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'formattedAddress,location' } },
      );
      const p = await res.json();
      tokenRef.current = newToken(); // start a fresh session after a selection
      const lat = p.location?.latitude;
      const lng = p.location?.longitude;
      if (typeof lat === 'number' && typeof lng === 'number') {
        onPlace({ formatted: p.formattedAddress ?? s.text, lat, lng });
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
