-- 0042_pin_function_search_path.sql  (security hardening)
-- Pin the search_path on the 4 helper functions the Supabase advisor flagged as
-- "Function Search Path Mutable". No behaviour change — just a fixed, safe path.
-- The text helpers also include `extensions` so unaccent() still resolves.

alter function public.ensure_single_default_address() set search_path = public;
alter function public.lv_stage_for(numeric) set search_path = public;
alter function public.lv_slugify(text) set search_path = public, extensions;
alter function public.unaccent_safe(text) set search_path = public, extensions;
