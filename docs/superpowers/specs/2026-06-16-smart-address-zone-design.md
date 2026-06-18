# Sub-project A — Smart Address + Auto Delivery-Zone — Design

**Goal:** Replace manual address typing + manual zone selection with Google Places
autocomplete (biased to Fès/Morocco) that captures coordinates, then auto-detect
the delivery zone by testing the point against per-zone neighbourhood polygons.
Out-of-zone addresses still deliver, at the most expensive zone's fee.

**Status:** Design approved ("go"). Sub-project B (manager confirmation) already shipped.

## Baseline
- `addresses` (migration 0007) has `line1`, `city`, `zone_id` — no coordinates.
- `delivery_zones` has `name`, `fee_dh`, `eta_min`, `eta_max` — no geometry.
- `AddressesScreen` types `line1` + picks a zone from a manual `<select>`.
- Maps already loads via `@googlemaps/js-api-loader` `Loader` (libraries `['geometry']`)
  in `GoogleDeliveryMap`. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set.

## Components & changes

### 1. `lib/geo.ts` (pure, tested)
- `pointInPolygon(point: LatLng, polygon: LatLng[]): boolean` — ray casting.
- `zoneForPoint(lat, lng, zones): Zone | null` — first zone whose polygon contains the point.
- `resolveZone(lat, lng, zones)` → `{ zone, outOfArea }`: the matched zone, or the
  **max-fee** zone with `outOfArea: true` when the point is outside every polygon.
- Types: `LatLng = { lat: number; lng: number }`; zones carry an optional
  `polygon: LatLng[]`.

### 2. Data — migration `0025` (applied via Supabase MCP)
- `alter table addresses add column lat double precision`, `add column lng double precision`.
- `alter table delivery_zones add column polygon jsonb` (array of `{lat,lng}` or `[lng,lat]`;
  store as `[[lng,lat],…]` GeoJSON-style; `lib/geo.ts` reads that shape).
- Seed approximate polygons for the four Fès zones (Ville Nouvelle, Médina/Fès el-Bali,
  Saïss, Route d'Imouzzer) as rough rectangles around their centres. Refinable later.

### 3. `components/ui/AddressAutocomplete.tsx` (new, client)
- Loads Maps with `libraries: ['places']` via the shared Loader.
- A text input wired to `google.maps.places.Autocomplete` with
  `componentRestrictions: { country: 'ma' }` + a `bounds`/`locationBias` around Fès.
- On `place_changed`: emits `{ formatted, lat, lng }` to the parent.
- Graceful fallback: if the API key is missing or Places fails to load, render a plain
  text input (so address entry never breaks).
- Small static map preview with a marker at the chosen point (optional, reuses Maps).

### 4. `AddressesScreen.tsx`
- Replace the `line1` input with `AddressAutocomplete`.
- Store `lat`/`lng` on the address row.
- On place selected → `resolveZone(lat,lng,zones)` → pre-set `zone_id`; show the
  detected zone + fee, with an "outOfArea" notice when applicable. The manual zone
  `<select>` remains as an override, pre-filled from detection.
- `RawAddress`/draft + the insert/update payload gain `lat`, `lng`.

### 5. Types / queries
- `Address` type gains `lat: number | null`, `lng: number | null`.
- `Zone` type gains `polygon: LatLng[] | null`.
- Zone queries already `select('*')` → polygon comes along.

## Data flow
1. User types in the address field → Places suggests Fès addresses.
2. User picks one → lat/lng + formatted address captured.
3. `resolveZone` runs → zone + fee auto-set (or max-fee + outOfArea notice).
4. Address saved with coordinates + zone_id.
5. Checkout uses the address's zone_id for the fee (unchanged).

## Error handling
- No API key / Places blocked → plain input fallback, manual zone select still works.
- Outside all polygons → max-fee zone + visible "hors quartier" notice (delivery allowed).
- Zones with no polygon are skipped by `zoneForPoint`.

## Out of scope (later)
- Admin polygon editor (draw/adjust zones on a map) — start with seeded contours.
- Recomputing zone at checkout from coordinates (we trust the address's stored zone).

## Testing
- `lib/geo.ts` unit tested (point inside/outside/boundary; max-fee fallback; no-polygon).
- tsc + eslint + build green. Migration applied + verified via MCP. Manual smoke: add an
  address in Fès → correct zone auto-selected.

## Google prerequisite (user)
The **Places API** must be enabled on the Google Cloud project and the key must allow
the Vercel referrer. Flagged to the user; if autocomplete returns nothing, that's the fix.
