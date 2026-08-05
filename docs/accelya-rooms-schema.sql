-- =====================================================================
-- MEETING ROOM BOOKING (mini-app) — applied to Supabase on 2026-08-05
-- Migration: create_room_booking
-- 3 rooms, time-range bookings on a 30-min grid, business hours 05:00-18:00,
-- window today+tomorrow (America/Bogota). No per-user limit; no overlapping
-- bookings per room (exclusion constraint). Identities visible.
-- See docs/accelya-rooms-casos-de-uso.md.
-- =====================================================================

create extension if not exists btree_gist;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  capacity integer not null check (capacity >= 0),
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.rooms (name, capacity, sort_order) values
  ('Room 1', 10, 1), ('Room 2', 2, 2), ('Room 3', 6, 3);

create table public.room_bookings (
  id uuid primary key default gen_random_uuid(),
  user_email text not null references public.hub_users(email) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  booking_date date not null,
  start_min integer not null,     -- minutes from midnight (e.g. 09:30 = 570)
  end_min integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_bookings_time_valid check (start_min < end_min),
  constraint room_bookings_business_hours check (start_min >= 300 and end_min <= 1080),
  constraint room_bookings_aligned check (start_min % 30 = 0 and end_min % 30 = 0),
  constraint room_bookings_no_overlap
    exclude using gist (room_id with =, booking_date with =, int4range(start_min, end_min) with &&)
);

create index idx_room_bookings_date on public.room_bookings (booking_date);
create index idx_room_bookings_user on public.room_bookings (user_email);

create trigger trg_rooms_updated_at before update on public.rooms
  for each row execute function public.set_updated_at();
create trigger trg_room_bookings_updated_at before update on public.room_bookings
  for each row execute function public.set_updated_at();

update public.apps set is_coming_soon = false where key = 'rooms';

alter table public.rooms enable row level security;
alter table public.room_bookings enable row level security;

create policy "authenticated read active rooms" on public.rooms for select
  using (auth.role() = 'authenticated' and is_active = true);
create policy "hr_admin manage rooms" on public.rooms for all
  using (public.is_hr_admin()) with check (public.is_hr_admin());

create policy "users read own room bookings" on public.room_bookings for select
  using (user_email = (select email from public.hub_users where id = auth.uid()) or public.is_hr_admin());
create policy "hr_admin manage room bookings" on public.room_bookings for all
  using (public.is_hr_admin()) with check (public.is_hr_admin());

-- room_day(date): all bookings that day with booker name + is_mine.
create or replace function public.room_day(p_date date)
returns table (booking_id uuid, room_id uuid, start_min integer, end_min integer, booked_by_name text, is_mine boolean)
language sql security definer stable set search_path = public
as $$
  select b.id, b.room_id, b.start_min, b.end_min, hu.full_name,
    coalesce(b.user_email = (select email from public.hub_users where id = auth.uid()), false)
  from public.room_bookings b
  left join public.hub_users hu on hu.email = b.user_email
  where b.booking_date = p_date
  order by b.room_id, b.start_min;
$$;

-- book_room(): validate + insert; overlap raises a friendly error.
create or replace function public.book_room(p_room_id uuid, p_date date, p_start_min integer, p_end_min integer)
returns public.room_bookings
language plpgsql security definer set search_path = public
as $$
declare v_email text; v_today date := (now() at time zone 'America/Bogota')::date; v_result public.room_bookings;
begin
  select email into v_email from public.hub_users where id = auth.uid() and is_active = true;
  if v_email is null then raise exception 'You are not authorized to book a room.' using errcode = '42501'; end if;
  if not exists (select 1 from public.user_app_access ua join public.apps a on a.id = ua.app_id
    where ua.user_email = v_email and a.key = 'rooms' and a.is_active = true)
  then raise exception 'You do not have access to room booking.' using errcode = '42501'; end if;
  if p_date < v_today or p_date > v_today + 1 then raise exception 'You can only book for today or tomorrow.' using errcode = 'P0001'; end if;
  if p_start_min >= p_end_min then raise exception 'The end time must be after the start time.' using errcode = 'P0001'; end if;
  if p_start_min < 300 or p_end_min > 1080 then raise exception 'Rooms can be booked between 05:00 and 18:00.' using errcode = 'P0001'; end if;
  if p_start_min % 30 <> 0 or p_end_min % 30 <> 0 then raise exception 'Times must fall on 30-minute steps.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.rooms where id = p_room_id and is_active = true) then raise exception 'Unknown room.' using errcode = 'P0001'; end if;
  begin
    insert into public.room_bookings (user_email, room_id, booking_date, start_min, end_min)
    values (v_email, p_room_id, p_date, p_start_min, p_end_min) returning * into v_result;
  exception when exclusion_violation then
    raise exception 'That time overlaps an existing booking for this room.' using errcode = 'P0001';
  end;
  return v_result;
end;
$$;

-- cancel_room(): deletes only the caller's own booking (any time).
create or replace function public.cancel_room(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_email text;
begin
  select email into v_email from public.hub_users where id = auth.uid() and is_active = true;
  if v_email is null then raise exception 'You are not authorized.' using errcode = '42501'; end if;
  delete from public.room_bookings where id = p_booking_id and user_email = v_email;
end;
$$;

revoke execute on function public.room_day(date) from public, anon;
revoke execute on function public.book_room(uuid, date, integer, integer) from public, anon;
revoke execute on function public.cancel_room(uuid) from public, anon;
grant execute on function public.room_day(date) to authenticated;
grant execute on function public.book_room(uuid, date, integer, integer) to authenticated;
grant execute on function public.cancel_room(uuid) to authenticated;
