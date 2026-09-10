-- 0045_rls_initplan_optimization.sql  (performance)
-- Wrap auth.uid() in (select auth.uid()) on the 18 owner-scoped policies flagged by
-- the Supabase `auth_rls_initplan` advisor. Postgres then evaluates it once per
-- query (initplan) instead of once per row. Policy LOGIC is unchanged.

-- addresses
drop policy if exists addresses_owner_all on public.addresses;
create policy addresses_owner_all on public.addresses for all to public
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- carts
drop policy if exists carts_rw on public.carts;
create policy carts_rw on public.carts for all to public
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- cart_items
drop policy if exists cart_items_rw on public.cart_items;
create policy cart_items_rw on public.cart_items for all to public
  using (exists (select 1 from carts c where c.id = cart_items.cart_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from carts c where c.id = cart_items.cart_id and c.user_id = (select auth.uid())));

-- orders
drop policy if exists orders_owner_read on public.orders;
create policy orders_owner_read on public.orders for select to public
  using ((select auth.uid()) = user_id);

-- order_items
drop policy if exists order_items_owner_read on public.order_items;
create policy order_items_owner_read on public.order_items for select to public
  using (exists (select 1 from orders o where o.id = order_items.order_id and o.user_id = (select auth.uid())));

-- order_tracking
drop policy if exists order_tracking_owner_read on public.order_tracking;
create policy order_tracking_owner_read on public.order_tracking for select to public
  using (exists (select 1 from orders o where o.id = order_tracking.order_id and o.user_id = (select auth.uid())));

-- chat_messages
drop policy if exists chat_owner_read on public.chat_messages;
create policy chat_owner_read on public.chat_messages for select to public
  using (exists (select 1 from orders o where o.id = chat_messages.order_id and o.user_id = (select auth.uid())));
drop policy if exists chat_customer_insert on public.chat_messages;
create policy chat_customer_insert on public.chat_messages for insert to public
  with check (sender = 'customer'::text and exists (select 1 from orders o where o.id = chat_messages.order_id and o.user_id = (select auth.uid())));

-- reviews
drop policy if exists reviews_owner_read on public.reviews;
create policy reviews_owner_read on public.reviews for select to public
  using ((select auth.uid()) = user_id);
drop policy if exists reviews_owner_insert on public.reviews;
create policy reviews_owner_insert on public.reviews for insert to public
  with check ((select auth.uid()) = user_id);

-- loyalty_ledger
drop policy if exists loyalty_owner_read on public.loyalty_ledger;
create policy loyalty_owner_read on public.loyalty_ledger for select to public
  using ((select auth.uid()) = user_id);

-- notifications
drop policy if exists notifications_owner_read on public.notifications;
create policy notifications_owner_read on public.notifications for select to public
  using ((select auth.uid()) = user_id);
drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications for update to public
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- profiles
drop policy if exists profiles_owner_read on public.profiles;
create policy profiles_owner_read on public.profiles for select to public
  using ((select auth.uid()) = id);
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to public
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- drivers (self read)
drop policy if exists drivers_self_read on public.drivers;
create policy drivers_self_read on public.drivers for select to public
  using (user_id = (select auth.uid()));

-- push_subscriptions
drop policy if exists push_sub_select_own on public.push_subscriptions;
create policy push_sub_select_own on public.push_subscriptions for select to public
  using (user_id = (select auth.uid()));
drop policy if exists push_sub_delete_own on public.push_subscriptions;
create policy push_sub_delete_own on public.push_subscriptions for delete to public
  using (user_id = (select auth.uid()));
