-- =====================================================================
-- DESK BOOKING (mini-app) — applied to Supabase on 2026-07-31
-- Migration: create_desk_booking
-- Specific-desk booking, single floor, zones A-D (A/B/C vertical 2x4,
-- D horizontal 3x2, left to right). Window: today+tomorrow (America/Bogota).
-- One desk per user per day. Identities visible. Data-driven layout via
-- pos_x/pos_y (schematic now; a real floor plan later just re-sets them).
-- See docs/accelya-desks-casos-de-uso.md.
-- =====================================================================

create table public.desks (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,       -- e.g. 'A-01'
  zone        text not null,              -- 'A' | 'B' | 'C' | 'D'
  sort_order  integer not null,
  pos_x       numeric not null,           -- map coordinates (see seed)
  pos_y       numeric not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Seed: A/B/C vertical (2 cols x 4 rows); D horizontal (3 cols x 2 rows).
insert into public.desks (code, zone, sort_order, pos_x, pos_y)
select z.zone || '-' || lpad(g::text, 2, '0'), z.zone, g,
       z.x0 + ((g - 1) % 2) * 9 + 4, ((g - 1) / 2) * 12 + 8
from (values ('A', 2), ('B', 24), ('C', 46)) as z(zone, x0)
cross join lateral generate_series(1, 8) as g;

insert into public.desks (code, zone, sort_order, pos_x, pos_y)
select 'D-' || lpad(g::text, 2, '0'), 'D', g,
       68 + ((g - 1) % 3) * 11 + 4, ((g - 1) / 3) * 12 + 8
from generate_series(1, 6) as g;

create table public.desk_bookings (
  id            uuid primary key default gen_random_uuid(),
  user_email    text not null references public.hub_users(email) on delete cascade,
  desk_id       uuid not null references public.desks(id) on delete cascade,
  booking_date  date not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_email, booking_date),
  unique (desk_id, booking_date)
);

create index idx_desk_bookings_date on public.desk_bookings (booking_date);
create index idx_desk_bookings_user on public.desk_bookings (user_email);

create trigger trg_desks_updated_at before update on public.desks
  for each row execute function public.set_updated_at();
create trigger trg_desk_bookings_updated_at before update on public.desk_bookings
  for each row execute function public.set_updated_at();

insert into public.apps (key, name, description, icon, launch_url)
values ('desks', 'Desk booking', 'Reserve your desk for today or tomorrow.', 'layout', '/desks')
on conflict (key) do nothing;

alter table public.desks enable row level security;
alter table public.desk_bookings enable row level security;

create policy "authenticated read active desks"
  on public.desks for select
  using (auth.role() = 'authenticated' and is_active = true);
create policy "hr_admin manage desks"
  on public.desks for all using (public.is_hr_admin()) with check (public.is_hr_admin());

create policy "users read own desk bookings"
  on public.desk_bookings for select
  using (
    user_email = (select email from public.hub_users where id = auth.uid())
    or public.is_hr_admin()
  );
create policy "hr_admin manage desk bookings"
  on public.desk_bookings for all using (public.is_hr_admin()) with check (public.is_hr_admin());

-- desk_map(date): every desk with status, booker name and is_mine.
create or replace function public.desk_map(p_date date)
returns table (
  desk_id uuid, code text, zone text, sort_order integer,
  pos_x numeric, pos_y numeric,
  booked boolean, booked_by_name text, is_mine boolean
)
language sql security definer stable set search_path = public
as $$
  select d.id, d.code, d.zone, d.sort_order, d.pos_x, d.pos_y,
    (b.id is not null),
    hu.full_name,
    coalesce(b.user_email = (select email from public.hub_users where id = auth.uid()), false)
  from public.desks d
  left join public.desk_bookings b on b.desk_id = d.id and b.booking_date = p_date
  left join public.hub_users hu on hu.email = b.user_email
  where d.is_active = true
  order by d.zone, d.sort_order;
$$;

-- book_desk(desk, date): create or move; race-safe via unique(desk_id, date).
create or replace function public.book_desk(p_desk_id uuid, p_date date)
returns public.desk_bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_email text; v_today date := (now() at time zone 'America/Bogota')::date;
  v_existing public.desk_bookings; v_result public.desk_bookings;
begin
  select email into v_email from public.hub_users where id = auth.uid() and is_active = true;
  if v_email is null then raise exception 'You are not authorized to book a desk.' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.user_app_access ua join public.apps a on a.id = ua.app_id
    where ua.user_email = v_email and a.key = 'desks' and a.is_active = true
  ) then raise exception 'You do not have access to desk booking.' using errcode = '42501'; end if;
  if p_date < v_today or p_date > v_today + 1 then raise exception 'You can only book for today or tomorrow.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.desks where id = p_desk_id and is_active = true) then raise exception 'Unknown desk.' using errcode = 'P0001'; end if;

  select * into v_existing from public.desk_bookings where user_email = v_email and booking_date = p_date;
  if v_existing.id is not null and v_existing.desk_id = p_desk_id then return v_existing; end if;

  begin
    if v_existing.id is not null then
      update public.desk_bookings set desk_id = p_desk_id where id = v_existing.id returning * into v_result;
    else
      insert into public.desk_bookings (user_email, desk_id, booking_date) values (v_email, p_desk_id, p_date) returning * into v_result;
    end if;
  exception when unique_violation then
    raise exception 'That desk was just taken. Please pick another.' using errcode = 'P0001';
  end;
  return v_result;
end;
$$;

-- cancel_desk(date): deletes only the caller's own booking, in-window.
create or replace function public.cancel_desk(p_date date)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_email text; v_today date := (now() at time zone 'America/Bogota')::date;
begin
  select email into v_email from public.hub_users where id = auth.uid() and is_active = true;
  if v_email is null then raise exception 'You are not authorized.' using errcode = '42501'; end if;
  if p_date < v_today or p_date > v_today + 1 then raise exception 'You can only change bookings for today or tomorrow.' using errcode = 'P0001'; end if;
  delete from public.desk_bookings where user_email = v_email and booking_date = p_date;
end;
$$;

revoke execute on function public.desk_map(date) from public, anon;
revoke execute on function public.book_desk(uuid, date) from public, anon;
revoke execute on function public.cancel_desk(date) from public, anon;
grant execute on function public.desk_map(date) to authenticated;
grant execute on function public.book_desk(uuid, date) to authenticated;
grant execute on function public.cancel_desk(date) to authenticated;
