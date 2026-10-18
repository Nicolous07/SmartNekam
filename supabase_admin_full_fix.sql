-- SmartNekam Admin access + user directory fix (additive; no existing tables dropped)
-- Review before running in Supabase SQL Editor.
begin;

-- Align database-side authorization with the app's current admin roles/email allowlist.
create or replace function public.is_smartnekam_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and lower(coalesce(p.role::text, '')) in ('admin','super_admin','moderator')
    )
    or lower(coalesce(auth.jwt() ->> 'email','')) = any (
      array['nicolousmunisi07@gmail.com']::text[]
    );
$$;

create or replace function public.is_smartnekam_moderator_or_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_smartnekam_admin();
$$;

revoke all on function public.is_smartnekam_admin() from public;
grant execute on function public.is_smartnekam_admin() to authenticated;
revoke all on function public.is_smartnekam_moderator_or_admin() from public;
grant execute on function public.is_smartnekam_moderator_or_admin() to authenticated;

-- Admin-only RPC: auth.users is not exposed directly to browser clients.
-- Returns only directory fields needed by the Admin UI.
create or replace function public.admin_list_users(p_search text default null, p_limit integer default 100, p_offset integer default 0)
returns table (
  id uuid,
  email text,
  full_name text,
  username text,
  role text,
  edupoints_balance bigint,
  country_code text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_smartnekam_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select p.id,
         u.email::text,
         p.full_name::text,
         p.username::text,
         p.role::text,
         coalesce(p.edupoints_balance, 0)::bigint,
         p.country_code::text,
         u.created_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p_search is null
     or btrim(p_search) = ''
     or coalesce(u.email,'') ilike '%' || btrim(p_search) || '%'
     or coalesce(p.full_name,'') ilike '%' || btrim(p_search) || '%'
     or coalesce(p.username,'') ilike '%' || btrim(p_search) || '%'
  order by u.created_at desc nulls last
  limit greatest(1, least(coalesce(p_limit,100), 200))
  offset greatest(coalesce(p_offset,0),0);
end;
$$;
revoke all on function public.admin_list_users(text, integer, integer) from public;
grant execute on function public.admin_list_users(text, integer, integer) to authenticated;

-- Admin-only counts, with no exposure of individual auth records.
create or replace function public.admin_get_overview()
returns table (registered_users bigint, pending_library_items bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_pending bigint := 0;
begin
  if not public.is_smartnekam_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  -- Profiles are the canonical user directory for this app.
  select count(*) into registered_users from public.profiles;
  -- Existing deployments may not have library_items; use dynamic SQL to avoid breaking this RPC.
  if to_regclass('public.library_items') is not null then
    execute 'select count(*) from public.library_items where status in (''pending'',''pending_approval'')' into v_pending;
  elsif to_regclass('public.library_resources') is not null then
    execute 'select count(*) from public.library_resources where status in (''pending'',''pending_approval'')' into v_pending;
  end if;
  pending_library_items := v_pending;
  return next;
end;
$$;
revoke all on function public.admin_get_overview() from public;
grant execute on function public.admin_get_overview() to authenticated;

commit;

-- After running: ensure the admin account exists in public.profiles. If its role is not admin/super_admin,
-- the allowlisted email can still access Admin. Never expose the service-role key in the browser.
