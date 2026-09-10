-- 0030_web_push.sql
-- Web Push notifications for the installed PWAs (customer / driver / admin).
-- Design: EVERYTHING flows through public.notifications. An AFTER INSERT trigger
-- on that table fires a Web Push (pg_net → the `push` edge function, which signs
-- with the VAPID keys stored in app_config). We then make sure the three event
-- types people care about each create a notifications row:
--   • orders     → already inserted by place_order (customer) + 0028 (driver);
--                  here we ALSO notify staff on every new order (gérant push).
--   • messages   → trigger on chat_messages inserts a 'message' notif for the
--                  other party of the order.
--   • calls      → ping_call() RPC inserts a 'call' notif for the other party
--                  (the in-app call screen is a mock, but the ping is real).

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- 1) Push subscriptions (one row per browser/device endpoint).
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists push_sub_select_own on public.push_subscriptions;
drop policy if exists push_sub_delete_own on public.push_subscriptions;
create policy push_sub_select_own on public.push_subscriptions for select using (user_id = auth.uid());
create policy push_sub_delete_own on public.push_subscriptions for delete using (user_id = auth.uid());
-- inserts/updates happen via the security-definer RPC below; the edge function
-- uses the service role (bypasses RLS) to read all rows and prune dead ones.

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into push_subscriptions(endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end$$;
revoke all on function public.save_push_subscription(text, text, text) from public;
grant execute on function public.save_push_subscription(text, text, text) to authenticated, service_role;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end$$;
revoke all on function public.delete_push_subscription(text) from public;
grant execute on function public.delete_push_subscription(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Fan-out: every notifications row → a Web Push request (async via pg_net).
-- ---------------------------------------------------------------------------
create or replace function public.lv_push_notification()
returns trigger language plpgsql security definer set search_path = public, net as $$
declare
  secret text;
begin
  select value into secret from app_config where name = 'push_hook_secret';
  perform net.http_post(
    url     := 'https://zcpjoyizevpylukqmqmq.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', coalesce(secret, '')),
    body    := jsonb_build_object(
                 'user_id',  NEW.user_id,
                 'title',    NEW.title,
                 'body',     NEW.body,
                 'kind',     NEW.kind,
                 'order_id', NEW.order_id
               )
  );
  return NEW;
end$$;

drop trigger if exists trg_push_notification on public.notifications;
create trigger trg_push_notification
  after insert on public.notifications
  for each row execute function public.lv_push_notification();

-- ---------------------------------------------------------------------------
-- 3) Chat message → notification for the OTHER party.
-- ---------------------------------------------------------------------------
create or replace function public.lv_notify_on_chat()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recipient    uuid;
  sender_label text;
  ord_code     text;
begin
  if NEW.sender = 'driver' then
    select o.user_id into recipient from orders o where o.id = NEW.order_id;
    sender_label := 'De votre livreur';
  elsif NEW.sender = 'customer' then
    select d.user_id into recipient
      from order_tracking ot join drivers d on d.id = ot.driver_id
      where ot.order_id = NEW.order_id;
    sender_label := 'Du client';
  else
    return NEW; -- support/system senders: no push
  end if;

  if recipient is not null then
    select code into ord_code from orders where id = NEW.order_id;
    insert into notifications(user_id, kind, title, body, order_id)
    values (recipient, 'message', 'Nouveau message',
            sender_label || ' · ' || coalesce('cmd ' || ord_code, '') || ' : ' || left(NEW.body, 90),
            NEW.order_id);
  end if;
  return NEW;
end$$;

drop trigger if exists trg_notify_on_chat on public.chat_messages;
create trigger trg_notify_on_chat
  after insert on public.chat_messages
  for each row execute function public.lv_notify_on_chat();

-- ---------------------------------------------------------------------------
-- 4) New order → notify every staff member (gérant push for "Nouvelle commande").
-- ---------------------------------------------------------------------------
create or replace function public.lv_notify_staff_new_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications(user_id, kind, title, body, order_id)
  select p.id, 'order', 'Nouvelle commande',
         'Commande ' || coalesce(NEW.code, '') || ' · ' || coalesce(NEW.total_dh, 0) || ' DH',
         NEW.id
  from profiles p
  where p.is_staff = true;
  return NEW;
end$$;

drop trigger if exists trg_notify_staff_new_order on public.orders;
create trigger trg_notify_staff_new_order
  after insert on public.orders
  for each row execute function public.lv_notify_staff_new_order();

-- ---------------------------------------------------------------------------
-- 5) Call "ping" — the call UI is a mock, but tapping it really notifies the
--    other party of the order with an incoming-call push.
-- ---------------------------------------------------------------------------
create or replace function public.ping_call(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid; cust uuid; drv uuid; recipient uuid; caller_label text; ord_code text;
begin
  me := auth.uid();
  if me is null then raise exception 'not authenticated'; end if;
  select user_id, code into cust, ord_code from orders where id = p_order;
  select d.user_id into drv
    from order_tracking ot join drivers d on d.id = ot.driver_id
    where ot.order_id = p_order;
  if me = cust then recipient := drv; caller_label := 'Appel du client';
  elsif me = drv then recipient := cust; caller_label := 'Appel de votre livreur';
  else recipient := null; end if;

  if recipient is not null then
    insert into notifications(user_id, kind, title, body, order_id)
    values (recipient, 'call', 'Appel entrant',
            caller_label || coalesce(' · cmd ' || ord_code, ''), p_order);
  end if;
end$$;
revoke all on function public.ping_call(uuid) from public;
grant execute on function public.ping_call(uuid) to authenticated, service_role;
