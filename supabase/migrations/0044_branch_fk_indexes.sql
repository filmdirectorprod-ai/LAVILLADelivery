-- 0044_branch_fk_indexes.sql  (performance)
-- Covering indexes for the branch_id foreign keys (added across the multi-agences
-- work) and promo_redemptions.order_id. Speeds up the per-agency filtering used by
-- the admin/driver surfaces. Flagged by the Supabase performance advisor.

create index if not exists idx_orders_branch on public.orders(branch_id);
create index if not exists idx_drivers_branch on public.drivers(branch_id);
create index if not exists idx_delivery_zones_branch on public.delivery_zones(branch_id);
create index if not exists idx_profiles_branch on public.profiles(branch_id);
create index if not exists idx_product_branch_branch on public.product_branch(branch_id);
create index if not exists idx_promotions_branch on public.promotions(branch_id);
create index if not exists idx_promo_redemptions_order on public.promo_redemptions(order_id);
