-- 0032_support_push.sql
-- Real-time driver support: route support_messages through the notifications table
-- so they ride the existing push pipeline (trg_push_notification → Edge Function).
--   • driver writes  → notify every staff member  (kind 'support_staff'  → /admin/support)
--   • staff replies  → notify that driver's user   (kind 'support_driver' → /driver/support)
-- The distinct kinds let the service worker open the correct app section on tap.

create or replace function public.lv_notify_support_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_user uuid;
begin
  if NEW.sender = 'driver' then
    select name into v_name from drivers where id = NEW.driver_id;
    insert into notifications (user_id, kind, title, body)
    select p.id, 'support_staff', 'Support — ' || coalesce(v_name, 'livreur'), NEW.body
    from profiles p
    where p.is_staff = true;
  elsif NEW.sender = 'staff' then
    select user_id into v_user from drivers where id = NEW.driver_id;
    if v_user is not null then
      insert into notifications (user_id, kind, title, body)
      values (v_user, 'support_driver', 'La Villa Support', NEW.body);
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_support_message on public.support_messages;
create trigger trg_notify_support_message
  after insert on public.support_messages
  for each row execute function public.lv_notify_support_message();
