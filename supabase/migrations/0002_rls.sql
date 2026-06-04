-- La Villa — Row Level Security
-- Public catalog is world-readable. Everything user-owned is restricted to the
-- owner for SELECT. Privileged writes (orders, tracking, ledger) are performed
-- by server code using the service-role key, which bypasses RLS.

-- ── Public read catalog ──────────────────────────────────────────────────────
alter table products enable row level security;
create policy products_read on products for select using (true);

alter table categories enable row level security;
create policy categories_read on categories for select using (true);

alter table delivery_zones enable row level security;
create policy zones_read on delivery_zones for select using (true);

alter table drivers enable row level security;
create policy drivers_read on drivers for select using (true);

alter table rewards enable row level security;
create policy rewards_read on rewards for select using (true);

-- ── Profiles (owner read/write) ──────────────────────────────────────────────
alter table profiles enable row level security;
create policy profiles_rw on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- ── Carts (owner read/write) ─────────────────────────────────────────────────
alter table carts enable row level security;
create policy carts_rw on carts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table cart_items enable row level security;
create policy cart_items_rw on cart_items for all
  using (exists (select 1 from carts c where c.id = cart_items.cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from carts c where c.id = cart_items.cart_id and c.user_id = auth.uid()));

-- ── Orders & children (owner SELECT only; writes via service role) ───────────
alter table orders enable row level security;
create policy orders_owner_read on orders for select using (auth.uid() = user_id);

alter table order_items enable row level security;
create policy order_items_owner_read on order_items for select
  using (exists (select 1 from orders o where o.id = order_items.order_id and o.user_id = auth.uid()));

alter table order_tracking enable row level security;
create policy order_tracking_owner_read on order_tracking for select
  using (exists (select 1 from orders o where o.id = order_tracking.order_id and o.user_id = auth.uid()));

-- ── Chat (owner read; customer may insert their own messages) ────────────────
alter table chat_messages enable row level security;
create policy chat_owner_read on chat_messages for select
  using (exists (select 1 from orders o where o.id = chat_messages.order_id and o.user_id = auth.uid()));
create policy chat_customer_insert on chat_messages for insert
  with check (
    sender = 'customer'
    and exists (select 1 from orders o where o.id = chat_messages.order_id and o.user_id = auth.uid())
  );

-- ── Reviews (owner read/insert) ──────────────────────────────────────────────
alter table reviews enable row level security;
create policy reviews_owner_read on reviews for select using (auth.uid() = user_id);
create policy reviews_owner_insert on reviews for insert with check (auth.uid() = user_id);

-- ── Loyalty ledger (owner read only) ─────────────────────────────────────────
alter table loyalty_ledger enable row level security;
create policy loyalty_owner_read on loyalty_ledger for select using (auth.uid() = user_id);

-- ── Notifications (owner read + update read-flag) ────────────────────────────
alter table notifications enable row level security;
create policy notifications_owner_read on notifications for select using (auth.uid() = user_id);
create policy notifications_owner_update on notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
