-- =====================================================================
-- ACCELYA HUB — Database schema (Supabase / PostgreSQL)
-- v1 (simplified — single users table)
-- =====================================================================
-- Model summary:
--   hub_users           -> SINGLE users table. HR manages it from day 1
--                          (email as primary key). The "id" column stays
--                          NULL until the person's first login; a trigger
--                          fills it in then, linking it to auth.users(id).
--   apps                -> catalog of Hub applications
--   user_app_access     -> which apps each user can see
--   access_logs         -> login audit trail
-- =====================================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- =====================================================================
-- 1. HUB_USERS — single users table (source of truth)
-- =====================================================================
create table public.hub_users (
  email         text primary key
                check (email ~* '^[a-zA-Z0-9._%+-]+@accelya\.com$'),
  id            uuid unique references auth.users(id) on delete set null,
                -- NULL until the first successful login; then fixed.
  full_name     text not null,
  position      text,                          -- job title (optional)
  role          text not null default 'employee'
                check (role in ('employee', 'hr_admin')),
  is_active     boolean not null default true,
  last_login_at timestamptz,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.hub_users is
  'Single source of truth for Hub users. HR creates the row (email, name, role, active) before the first login. The id column is filled in automatically (via trigger) when the person confirms their OTP for the first time, linking this row to auth.users.';

comment on column public.hub_users.id is
  'NULL = the person has never logged in. Once set, it is linked 1:1 with auth.users(id) and is what RLS policies use to identify "who is currently logged in" (auth.uid()).';

-- =====================================================================
-- 2. APPS — catalog of Hub applications
-- =====================================================================
create table public.apps (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,         -- internal slug, e.g. 'employment-certificates'
  name        text not null,                -- display name, e.g. 'Employment certificates'
  description text,
  icon        text,                         -- icon name or URL
  launch_url  text not null,                -- URL the Hub redirects to
  is_active   boolean not null default true,-- whether it's globally disabled
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.apps is
  'Master catalog of applications available in the Hub.';

-- =====================================================================
-- 3. USER_APP_ACCESS — individual app assignment per user
-- =====================================================================
create table public.user_app_access (
  id          uuid primary key default gen_random_uuid(),
  user_email  text not null references public.hub_users(email) on delete cascade,
  app_id      uuid not null references public.apps(id) on delete cascade,
  granted_by  uuid references auth.users(id),
  granted_at  timestamptz not null default now(),
  unique (user_email, app_id)
);

comment on table public.user_app_access is
  'N:N relationship between users and apps. References hub_users.email (not id) because access can be granted before the user''s first login.';

-- =====================================================================
-- 4. ACCESS_LOGS — login audit trail
-- =====================================================================
create table public.access_logs (
  id         bigint generated always as identity primary key,
  email      text not null,
  event_type text not null
             check (event_type in ('otp_requested', 'login_success', 'login_failed', 'logout')),
  user_id    uuid references auth.users(id),
  metadata   jsonb,                          -- e.g. {"ip": "...", "user_agent": "..."}
  created_at timestamptz not null default now()
);

comment on table public.access_logs is
  'Audit log of authentication events. Read-only for HR; writes go through a security definer function (no direct insert access from the client).';

-- =====================================================================
-- INDEXES
-- =====================================================================
create index idx_hub_users_is_active on public.hub_users (is_active);
create index idx_hub_users_role on public.hub_users (role);
create index idx_user_app_access_email on public.user_app_access (user_email);
create index idx_user_app_access_app on public.user_app_access (app_id);
create index idx_access_logs_email on public.access_logs (email);
create index idx_access_logs_created_at on public.access_logs (created_at desc);

-- =====================================================================
-- HELPER FUNCTION: is the authenticated user an active hr_admin?
-- =====================================================================
create or replace function public.is_hr_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.hub_users
    where id = auth.uid()
      and role = 'hr_admin'
      and is_active = true
  );
$$;

-- =====================================================================
-- FUNCTION: check whether an email is authorized (pre-check step before
-- sending the OTP from the frontend, without exposing the full hub_users table)
-- =====================================================================
create or replace function public.is_email_authorized(check_email text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.hub_users
    where email = lower(check_email)
      and is_active = true
  );
$$;

-- Allows anonymous (not-yet-logged-in) users to call this specific
-- function, without granting read access to the full hub_users table.
grant execute on function public.is_email_authorized(text) to anon, authenticated;

-- =====================================================================
-- TRIGGER: link hub_users.id with auth.users.id on first login, and
-- refresh last_login_at on subsequent logins.
-- =====================================================================
create or replace function public.handle_auth_user_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.hub_users
  set id = new.id,
      last_login_at = now(),
      updated_at = now()
  where email = lower(new.email)
    and is_active = true;

  -- If there was no match (email not authorized or inactive), do
  -- nothing: the auth.users row is left "orphaned" and no RLS policy
  -- will recognize it, meaning the person cannot see any Hub data even
  -- though they exist in auth.users. This is the second layer of
  -- defense; the first is is_email_authorized() before the OTP is sent.
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_sync();

create trigger on_auth_user_login
  after update of last_sign_in_at on auth.users
  for each row execute function public.handle_auth_user_sync();

-- =====================================================================
-- TRIGGER: keep updated_at current
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_hub_users_updated_at before update on public.hub_users
  for each row execute function public.set_updated_at();

create trigger trg_apps_updated_at before update on public.apps
  for each row execute function public.set_updated_at();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.hub_users enable row level security;
alter table public.apps enable row level security;
alter table public.user_app_access enable row level security;
alter table public.access_logs enable row level security;

-- ---------------------------------------------------------------------
-- hub_users: the user sees their own row; HR sees and manages all
-- ---------------------------------------------------------------------
create policy "users can view own record"
  on public.hub_users for select
  using (id = auth.uid() or public.is_hr_admin());

create policy "hr_admin can manage hub_users"
  on public.hub_users for all
  using (public.is_hr_admin())
  with check (public.is_hr_admin());

-- ---------------------------------------------------------------------
-- apps: any authenticated user sees active apps; HR manages the catalog
-- ---------------------------------------------------------------------
create policy "authenticated users can view active apps"
  on public.apps for select
  using (auth.role() = 'authenticated' and is_active = true);

create policy "hr_admin can manage apps"
  on public.apps for all
  using (public.is_hr_admin())
  with check (public.is_hr_admin());

-- ---------------------------------------------------------------------
-- user_app_access: the user sees only their own assignments; HR sees/manages all
-- ---------------------------------------------------------------------
create policy "users can view own app access"
  on public.user_app_access for select
  using (
    user_email = (select email from public.hub_users where id = auth.uid())
    or public.is_hr_admin()
  );

create policy "hr_admin can manage app access"
  on public.user_app_access for all
  using (public.is_hr_admin())
  with check (public.is_hr_admin());

-- ---------------------------------------------------------------------
-- access_logs: read-only for HR; writes go through a security definer
-- function (no direct insert access from the client)
-- ---------------------------------------------------------------------
create policy "hr_admin can view access logs"
  on public.access_logs for select
  using (public.is_hr_admin());

create or replace function public.log_access_event(
  p_email text,
  p_event_type text,
  p_user_id uuid default null,
  p_metadata jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.access_logs (email, event_type, user_id, metadata)
  values (lower(p_email), p_event_type, p_user_id, p_metadata);
end;
$$;

grant execute on function public.log_access_event(text, text, uuid, jsonb) to anon, authenticated;

-- =====================================================================
-- OPTIONAL SEED: first HR admin and example app
-- (Adjust the email before running in production)
-- =====================================================================
-- insert into public.hub_users (email, full_name, role, is_active)
-- values ('hr.admin@accelya.com', 'HR Admin', 'hr_admin', true);
--
-- insert into public.apps (key, name, description, icon, launch_url)
-- values ('employment-certificates', 'Employment certificates',
--         'Generate your employment certificate as a PDF', 'file-text',
--         '/employment-certificates');
