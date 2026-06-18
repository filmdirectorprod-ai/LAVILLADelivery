// components/ui/AddressAutocomplete.tsx
// Google Places autocomplete for the delivery address, biased to Fès / restricted
// to Morocco. On selection it reports the formatted address + coordinates so the
// caller can auto-detect the delivery zone (lib/geo.ts). If the Maps key is missing
// or Places fails to load, it degrades to a plain text input — address entry never
// breaks. Loads via the shared @googlemaps/js-api-loader (places library).
'use client';
import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

const FES = { lat: 34.033, lng: -4.999 };

export interface PlaceResult {
  formatted: string;
  lat: number;
  lng: number;
}

export interface AddressAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  onPlace: (p: PlaceResult) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export function AddressAutocomplete({ value, onChange, onPlace, placeholder, style }: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Keep the latest callbacks without re-initializing the Autocomplete widget.
  const cbRef = useRef({ onChange, onPlace });
  cbRef.current = { onChange, onPlace };

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !inputRef.current) return;
    let cancelled = false;

    new Loader({ apiKey, version: 'weekly', libraries: ['places'] })
      .load()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        const ac = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'ma' },
          fields: ['formatted_address', 'geometry'],
          bounds: new google.maps.LatLngBounds(
            { lat: FES.lat - 0.12, lng: FES.lng - 0.12 },
            { lat: FES.lat + 0.12, lng: FES.lng + 0.12 },
          ),
        });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          const loc = place.geometry?.location;
          if (!loc) return;
          const formatted = place.formatted_address ?? inputRef.current?.value ?? '';
          cbRef.current.onChange(formatted);
          cbRef.current.onPlace({ formatted, lat: loc.lat(), lng: loc.lng() });
        });
      })
      .catch(() => {
        /* Places unavailable → plain input fallback (already rendered). */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      style={style}
    />
  );
}
