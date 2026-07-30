-- =====================================================================
-- PARKING BOOKING (mini-app) — applied to Supabase on 2026-07-29
-- Migrations: create_parking_booking, restrict_parking_functions_to_authenticated
-- Free office parking, pool-based capacity per vehicle type.
-- Window: today + tomorrow (America/Bogota). One booking per user per day.
-- See docs/accelya-parking-casos-de-uso.md.
-- =====================================================================

-- 1. Vehicle types (capacity pools). Editable by data (v1: seeded).
create table public.parking_vehicle_types (
  key         text primary key,
  label       text not null,
  capacity    integer not null check (capacity >= 0),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into public.parking_vehicle_types (key, label, capacity, sort_order) values
  ('car_moto', 'Car / Motorcycle', 7, 1),
  ('bicycle',  'Bicycle',          10, 2),
  ('scooter',  'Electric scooter', 10, 3);

-- 2. Bookings. One per user per day (BR1).
create table public.parking_bookings (
  id            uuid primary key default gen_random_uuid(),
  user_email    text not null references public.hub_users(email) on delete cascade,
  booking_date  date not null,
  vehicle_type  text not null references public.parking_vehicle_types(key),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_email, booking_date)
);

create index idx_parking_bookings_date_type on public.parking_bookings (booking_date, vehicle_type);
create index idx_parking_bookings_user on public.parking_bookings (user_email);

create trigger trg_parking_vehicle_types_updated_at before update on public.parking_vehicle_types
  for each row execute function public.set_updated_at();
create trigger trg_parking_bookings_updated_at before update on public.parking_bookings
  for each row execute function public.set_updated_at();

-- 3. Register the parking app in the Hub catalog (dev-managed).
insert into public.apps (key, name, description, icon, launch_url)
values ('parking', 'Parking booking',
        'Book your office parking spot for today or tomorrow.',
        'car', '/parking')
on conflict (key) do nothing;

-- 4. Row Level Security
alter table public.parking_vehicle_types enable row level security;
alter table public.parking_bookings enable row level security;

create policy "authenticated read active vehicle types"
  on public.parking_vehicle_types for select
  using (auth.role() = 'authenticated' and is_active = true);

create policy "hr_admin manage vehicle types"
  on public.parking_vehicle_types for all
  using (public.is_hr_admin())
  with check (public.is_hr_admin());

create policy "users read own parking bookings"
  on public.parking_bookings for select
  using (
    user_email = (select email from public.hub_users where id = auth.uid())
    or public.is_hr_admin()
  );

create policy "users cancel own parking bookings"
  on public.parking_bookings for delete
  using (
    public.is_hr_admin()
    or (
      user_email = (select email from public.hub_users where id = auth.uid())
      and booking_date between (now() at time zone 'America/Bogota')::date
                           and (now() at time zone 'America/Bogota')::date + 1
    )
  );

create policy "hr_admin manage parking bookings"
  on public.parking_bookings for all
  using (public.is_hr_admin())
  with check (public.is_hr_admin());

-- 5. Availability (aggregate counts only; never exposes identities).
create or replace function public.parking_availability(p_date date)
returns table (
  vehicle_type text,
  label        text,
  capacity     integer,
  booked       integer,
  available    integer
)
language sql
security definer
stable
set search_path = public
as $$
  select
    t.key, t.label, t.capacity,
    coalesce(b.cnt, 0)::int,
    greatest(t.capacity - coalesce(b.cnt, 0), 0)::int
  from public.parking_vehicle_types t
  left join (
    select vehicle_type, count(*) as cnt
    from public.parking_bookings
    where booking_date = p_date
    group by vehicle_type
  ) b on b.vehicle_type = t.key
  where t.is_active = true
  order by t.sort_order;
$$;

-- 6. Atomic create/modify booking. Validates parking access, window,
-- one-per-day and capacity; serializes same-type bookings via a row lock.
create or replace function public.book_parking(p_date date, p_type text)
returns public.parking_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email    text;
  v_today    date := (now() at time zone 'America/Bogota')::date;
  v_capacity integer;
  v_count    integer;
  v_existing public.parking_bookings;
  v_result   public.parking_bookings;
begin
  select email into v_email
  from public.hub_users
  where id = auth.uid() and is_active = true;
  if v_email is null then
    raise exception 'You are not authorized to book parking.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_app_access ua
    join public.apps a on a.id = ua.app_id
    where ua.user_email = v_email and a.key = 'parking' and a.is_active = true
  ) then
    raise exception 'You do not have access to parking booking.' using errcode = '42501';
  end if;

  if p_date < v_today or p_date > v_today + 1 then
    raise exception 'You can only book for today or tomorrow.' using errcode = 'P0001';
  end if;

  select capacity into v_capacity
  from public.parking_vehicle_types
  where key = p_type and is_active = true
  for update;
  if v_capacity is null then
    raise exception 'Unknown vehicle type.' using errcode = 'P0001';
  end if;

  select * into v_existing
  from public.parking_bookings
  where user_email = v_email and booking_date = p_date;

  if v_existing.id is not null and v_existing.vehicle_type = p_type then
    return v_existing;
  end if;

  select count(*) into v_count
  from public.parking_bookings
  where booking_date = p_date and vehicle_type = p_type;
  if v_count >= v_capacity then
    raise exception 'No parking spots left for that option.' using errcode = 'P0001';
  end if;

  if v_existing.id is not null then
    update public.parking_bookings set vehicle_type = p_type
    where id = v_existing.id returning * into v_result;
  else
    insert into public.parking_bookings (user_email, booking_date, vehicle_type)
    values (v_email, p_date, p_type) returning * into v_result;
  end if;

  return v_result;
end;
$$;

-- Lock the parking functions to signed-in users only (Postgres grants
-- EXECUTE to PUBLIC/anon by default).
revoke execute on function public.book_parking(date, text) from public, anon;
revoke execute on function public.parking_availability(date) from public, anon;
grant execute on function public.book_parking(date, text) to authenticated;
grant execute on function public.parking_availability(date) to authenticated;
