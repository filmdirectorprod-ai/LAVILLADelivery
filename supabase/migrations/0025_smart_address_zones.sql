-- La Villa — Smart address + auto delivery-zone (sub-project A).
-- Adds geocoded coordinates to addresses and an approximate neighbourhood polygon
-- to each delivery zone (ring of [lng, lat] points, GeoJSON order). Polygons are
-- rough rectangles around the Fès neighbourhoods, matched by their distinct fees;
-- refine later. lib/geo.ts tests a customer's point against these to pick the zone.
-- Idempotent; run after 0024.

alter table addresses add column if not exists lat double precision;
alter table addresses add column if not exists lng double precision;
alter table delivery_zones add column if not exists polygon jsonb;

-- Approximate Fès neighbourhood contours (matched by fee: 12/15/18/20 DH).
update delivery_zones set polygon =
  '[[-5.035,34.005],[-4.975,34.005],[-4.975,34.045],[-5.035,34.045]]'::jsonb
  where fee_dh = 12;  -- Ville Nouvelle
update delivery_zones set polygon =
  '[[-5.005,34.045],[-4.945,34.045],[-4.945,34.085],[-5.005,34.085]]'::jsonb
  where name = 'Médina (Fès el-Bali)';
update delivery_zones set polygon =
  '[[-5.075,34.040],[-5.005,34.040],[-5.005,34.080],[-5.075,34.080]]'::jsonb
  where name = 'Zouagha';  -- also 15 DH → seed by name, not fee
update delivery_zones set polygon =
  '[[-5.020,33.975],[-4.950,33.975],[-4.950,34.005],[-5.020,34.005]]'::jsonb
  where fee_dh = 18;  -- Saïss
update delivery_zones set polygon =
  '[[-5.030,33.930],[-4.960,33.930],[-4.960,33.975],[-5.030,33.975]]'::jsonb
  where fee_dh = 20;  -- Route d'Imouzzer
