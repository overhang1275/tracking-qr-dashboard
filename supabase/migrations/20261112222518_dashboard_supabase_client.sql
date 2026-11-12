begin;

alter table public.profiles add column last_access timestamptz;

create or replace function public.admin_create_profile(
  p_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_role text,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if not (select colima_private.has_active_role(array['ADMINISTRADOR'])) then
    raise exception 'administrator role required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from auth.users as auth_user
    where auth_user.id = p_id and lower(auth_user.email) = lower(p_email)
  ) then
    raise exception 'auth user and profile email must match' using errcode = '23503';
  end if;

  insert into public.profiles (id, first_name, last_name, email, role, status, created_by)
  values (p_id, btrim(p_first_name), btrim(p_last_name), lower(btrim(p_email)), p_role, p_status, actor);

  insert into public.audit_logs (actor_id, action, target_id, details)
  values (actor, 'user.create', p_id::text, jsonb_build_object('email', lower(btrim(p_email)), 'role', p_role, 'status', p_status));

  return p_id;
end;
$$;

create or replace function public.admin_update_profile(
  p_id uuid,
  p_first_name text,
  p_last_name text,
  p_role text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if not (select colima_private.has_active_role(array['ADMINISTRADOR'])) then
    raise exception 'administrator role required' using errcode = '42501';
  end if;

  if p_id = actor and (p_role <> 'ADMINISTRADOR' or p_status <> 'active') then
    raise exception 'cannot revoke your own administrator access' using errcode = '42501';
  end if;

  update public.profiles
  set first_name = btrim(p_first_name), last_name = btrim(p_last_name), role = p_role, status = p_status, updated_at = now()
  where id = p_id;

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (actor_id, action, target_id, details)
  values (actor, 'user.update', p_id::text, jsonb_build_object('role', p_role, 'status', p_status));
end;
$$;

create or replace function public.admin_update_institution_name(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if not (select colima_private.has_active_role(array['ADMINISTRADOR'])) then
    raise exception 'administrator role required' using errcode = '42501';
  end if;

  update public.institution_settings
  set institution_name = btrim(p_name), updated_at = now(), updated_by = actor
  where id = true;

  if not found then
    raise exception 'institution settings are missing' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (actor_id, action, target_id, details)
  values (actor, 'settings.update', 'institution', jsonb_build_object('name', btrim(p_name)));
end;
$$;

create or replace function public.record_profile_access()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  accessed_at timestamptz := now();
begin
  update public.profiles
  set last_access = accessed_at
  where id = (select auth.uid()) and status = 'active';

  if not found then
    raise exception 'active institutional profile required' using errcode = '42501';
  end if;

  return accessed_at;
end;
$$;

revoke all on function public.admin_create_profile(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_update_profile(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_update_institution_name(text) from public, anon, authenticated;
revoke all on function public.record_profile_access() from public, anon, authenticated;
grant execute on function public.admin_create_profile(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.admin_update_profile(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_update_institution_name(text) to authenticated;
grant execute on function public.record_profile_access() to authenticated;

alter publication supabase_realtime
  add table public.profiles, public.validations, public.audit_logs, public.institution_settings;

commit;
