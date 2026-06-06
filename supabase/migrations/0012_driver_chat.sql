-- La Villa — let the assigned driver read and send order chat messages.
--
-- 0002 only gave chat access to the order owner (the customer): chat_owner_read
-- + chat_customer_insert. The driver therefore couldn't see or answer messages
-- on the orders they're delivering. We add the mirror policies for the driver,
-- gated by lv_driver_claimed() (the SECURITY DEFINER helper from 0009 that checks
-- order_tracking.driver_id = lv_current_driver() without re-entering RLS, so no
-- recursion). The driver may only post as sender='driver'.

drop policy if exists chat_driver_read on chat_messages;
create policy chat_driver_read on chat_messages for select
  using (lv_driver_claimed(chat_messages.order_id));

drop policy if exists chat_driver_insert on chat_messages;
create policy chat_driver_insert on chat_messages for insert
  with check (
    sender = 'driver'
    and lv_driver_claimed(chat_messages.order_id)
  );
