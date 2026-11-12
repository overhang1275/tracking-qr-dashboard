begin;

create schema if not exists colima_private;
revoke all on schema colima_private from public, anon;
grant usage on schema colima_private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null check (length(btrim(first_name)) between 1 and 80),
  last_name text not null check (length(btrim(last_name)) between 1 and 120),
  email text not null check (length(email) <= 254),
  role text not null check (role in ('ADMINISTRADOR', 'SUPERVISOR', 'VALIDADOR', 'AUDITOR')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

create unique index profiles_email_lower_uidx on public.profiles (lower(email));
create index profiles_role_status_idx on public.profiles (role, status);

create table public.validations (
  id uuid primary key default gen_random_uuid(),
  client_event_id uuid not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  folio text not null check (length(btrim(folio)) between 1 and 80),
  document_type text not null check (document_type in ('soporte_vehicular', 'engomado_vehicular', 'engomado_remolque')),
  element_type text not null,
  reported_result text not null check (reported_result in ('valid', 'invalid', 'inconclusive', 'error')),
  created_at timestamptz not null default now(),
  application text not null check (length(btrim(application)) between 1 and 80),
  app_version text not null check (length(btrim(app_version)) between 1 and 40),
  constraint validations_document_element_check check (
    (document_type = 'soporte_vehicular' and element_type in ('escudo_invisible', 'anticopia_soporte'))
    or (document_type = 'engomado_vehicular' and element_type in ('qr_vehicular', 'anticopia_vehicular', 'correlativa_vehicular'))
    or (document_type = 'engomado_remolque' and element_type = 'anticopia_remolque')
  ),
  constraint validations_user_event_unique unique (user_id, client_event_id)
);

create index validations_created_at_id_idx on public.validations (created_at desc, id desc);
create index validations_user_created_at_idx on public.validations (user_id, created_at desc, id desc);
create index validations_folio_idx on public.validations (folio);
create index validations_document_created_at_idx on public.validations (document_type, created_at desc);
create index validations_result_created_at_idx on public.validations (reported_result, created_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete restrict,
  action text not null check (length(btrim(action)) between 1 and 80),
  target_id text not null check (length(btrim(target_id)) between 1 and 128),
  created_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb check (
    jsonb_typeof(details) = 'object' and pg_column_size(details) <= 4096
  )
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc, id desc);
create index audit_logs_actor_created_at_idx on public.audit_logs (actor_id, created_at desc);

create table public.institution_settings (
  id boolean primary key default true check (id),
  institution_name text not null check (length(btrim(institution_name)) between 1 and 160),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.institution_settings (institution_name)
values ('Plataforma Institucional Colima 2027');

create function colima_private.has_active_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.status = 'active'
      and profile.role = any (required_roles)
  );
$$;

revoke all on function colima_private.has_active_role(text[]) from public, anon, authenticated;
grant execute on function colima_private.has_active_role(text[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.validations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.institution_settings enable row level security;

revoke all on table public.profiles, public.validations, public.audit_logs, public.institution_settings
  from public, anon, authenticated, service_role;

grant select on table public.profiles to authenticated;
grant select on table public.validations to authenticated;
grant insert (client_event_id, folio, document_type, element_type, reported_result, application, app_version)
  on table public.validations to authenticated;
grant select on table public.audit_logs, public.institution_settings to authenticated;

grant select, insert, update on table public.profiles to service_role;
grant select, insert on table public.validations, public.audit_logs to service_role;
grant select, insert, update on table public.institution_settings to service_role;

create policy profiles_read_self_or_staff
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select colima_private.has_active_role(array['ADMINISTRADOR', 'SUPERVISOR', 'AUDITOR']))
  );

create policy validations_read_staff_or_owner
  on public.validations for select to authenticated
  using (
    (select colima_private.has_active_role(array['ADMINISTRADOR', 'SUPERVISOR', 'AUDITOR']))
    or (
      user_id = (select auth.uid())
      and (select colima_private.has_active_role(array['VALIDADOR']))
    )
  );

create policy validations_insert_active_validator_own
  on public.validations for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select colima_private.has_active_role(array['VALIDADOR']))
  );

create policy audit_logs_read_staff
  on public.audit_logs for select to authenticated
  using ((select colima_private.has_active_role(array['ADMINISTRADOR', 'SUPERVISOR', 'AUDITOR'])));

create policy institution_settings_read_staff
  on public.institution_settings for select to authenticated
  using ((select colima_private.has_active_role(array['ADMINISTRADOR', 'SUPERVISOR', 'AUDITOR'])));

commit;
