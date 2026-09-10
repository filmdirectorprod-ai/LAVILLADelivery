-- 0046_consolidate_permissive_policies.sql  (performance)
-- Collapse multiple permissive policies that apply to the same {table, command} into
-- a single policy whose condition is the OR of the originals. Same access logic,
-- fewer policies evaluated per query (closes the multiple_permissive_policies advisor).

-- profiles (SELECT: owner OR staff)
drop policy if exists profiles_owner_read on public.profiles;
drop policy if exists profiles_staff_read on public.profiles;
create policy profiles_select on public.profiles for select
  using ((select auth.uid()) = id or lv_is_staff());

-- reviews (SELECT: owner OR staff)
drop policy if exists reviews_owner_read on public.reviews;
drop policy if exists reviews_staff_read on public.reviews;
create policy reviews_select on public.reviews for select
  using ((select auth.uid()) = user_id or lv_is_staff());

-- drivers (SELECT: self OR customer-of-their-order OR branch staff)
drop policy if exists drivers_self_read on public.drivers;
drop policy if exists drivers_customer_read on public.drivers;
drop policy if exists drivers_staff_read on public.drivers;
create policy drivers_select on public.drivers for select
  using (user_id = (select auth.uid())
         or lv_owns_driver_order(id)
         or (lv_is_staff() and (branch_id = lv_staff_branch() or lv_staff_branch() is null)));

-- orders (SELECT: owner OR branch staff OR driver pool)
drop policy if exists orders_owner_read on public.orders;
drop policy if exists orders_staff_read on public.orders;
drop policy if exists orders_driver_read on public.orders;
create policy orders_select on public.orders for select
  using ((select auth.uid()) = user_id
         or (lv_is_staff() and (branch_id = lv_staff_branch() or lv_staff_branch() is null))
         or (lv_is_driver() and status = any (array['ready'::text, 'en_route'::text]) and lv_driver_tracking_visible(id)));

-- order_items (SELECT: owner OR branch staff OR claiming driver)
drop policy if exists order_items_owner_read on public.order_items;
drop policy if exists order_items_staff_read on public.order_items;
drop policy if exists order_items_driver_read on public.order_items;
create policy order_items_select on public.order_items for select
  using (exists (select 1 from orders o where o.id = order_items.order_id and o.user_id = (select auth.uid()))
         or (lv_is_staff() and exists (select 1 from orders o where o.id = order_items.order_id and (o.branch_id = lv_staff_branch() or lv_staff_branch() is null)))
         or lv_driver_claimed(order_id));

-- order_tracking (SELECT: owner OR branch staff OR driver)
drop policy if exists order_tracking_owner_read on public.order_tracking;
drop policy if exists order_tracking_staff_read on public.order_tracking;
drop policy if exists order_tracking_driver_read on public.order_tracking;
create policy order_tracking_select on public.order_tracking for select
  using (exists (select 1 from orders o where o.id = order_tracking.order_id and o.user_id = (select auth.uid()))
         or (lv_is_staff() and exists (select 1 from orders o where o.id = order_tracking.order_id and (o.branch_id = lv_staff_branch() or lv_staff_branch() is null)))
         or (lv_is_driver() and (coalesce(manual, false) = false or driver_id = lv_current_driver()) and lv_order_active(order_id)));

-- chat_messages (SELECT: owner OR claiming driver OR staff)
drop policy if exists chat_owner_read on public.chat_messages;
drop policy if exists chat_driver_read on public.chat_messages;
drop policy if exists chat_messages_staff_read on public.chat_messages;
create policy chat_select on public.chat_messages for select
  using (exists (select 1 from orders o where o.id = chat_messages.order_id and o.user_id = (select auth.uid()))
         or lv_driver_claimed(order_id)
         or lv_is_staff());
-- chat_messages (INSERT: customer OR claiming driver)
drop policy if exists chat_customer_insert on public.chat_messages;
drop policy if exists chat_driver_insert on public.chat_messages;
create policy chat_insert on public.chat_messages for insert
  with check ((sender = 'customer'::text and exists (select 1 from orders o where o.id = chat_messages.order_id and o.user_id = (select auth.uid())))
              or (sender = 'driver'::text and lv_driver_claimed(order_id)));

-- driver_shifts: split the staff ALL into per-command, merge the SELECT with the driver read
drop policy if exists shifts_staff_all on public.driver_shifts;
drop policy if exists shifts_driver_read on public.driver_shifts;
create policy shifts_select on public.driver_shifts for select
  using (lv_is_staff() or driver_id = lv_current_driver());
create policy shifts_staff_insert on public.driver_shifts for insert with check (lv_is_staff());
create policy shifts_staff_update on public.driver_shifts for update using (lv_is_staff()) with check (lv_is_staff());
create policy shifts_staff_delete on public.driver_shifts for delete using (lv_is_staff());

-- support_messages: split the staff ALL, merge SELECT + INSERT with the driver policies
drop policy if exists support_staff_all on public.support_messages;
drop policy if exists support_driver_read on public.support_messages;
drop policy if exists support_driver_insert on public.support_messages;
create policy support_select on public.support_messages for select
  using (lv_is_staff() or driver_id = lv_current_driver());
create policy support_insert on public.support_messages for insert
  with check (lv_is_staff() or (driver_id = lv_current_driver() and sender = 'driver'::text));
create policy support_staff_update on public.support_messages for update using (lv_is_staff()) with check (lv_is_staff());
create policy support_staff_delete on public.support_messages for delete using (lv_is_staff());
