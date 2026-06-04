-- La Villa — auto-provision a profile row when a new auth user is created.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, loyalty_points, loyalty_tier)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    0,
    'Gourmand'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
