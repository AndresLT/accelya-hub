-- =====================================================================
-- ACCELYA HUB — Auth Hook: "Before User Created"
-- =====================================================================
-- Configured in the Supabase Dashboard: Authentication > Hooks >
-- "Before user created" > select this Postgres function.
--
-- Runs BEFORE Supabase inserts the row into auth.users. If this
-- function raises/returns an error, the signup is REJECTED entirely:
-- auth.users is never created, and the OTP is never sent.
--
-- This is the second layer of defense (server-side), complementary to
-- is_email_authorized(), which is called from the frontend before
-- requesting the OTP (that layer is what gives good UX: it stops the
-- user from even trying if they're not authorized).
-- =====================================================================

create or replace function public.hook_restrict_signup_to_authorized_users(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  incoming_email text := lower(event->'user'->>'email');
  is_authorized boolean;
begin
  select exists (
    select 1 from public.hub_users
    where email = incoming_email
      and is_active = true
  ) into is_authorized;

  if not is_authorized then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'This email is not authorized to access the Accelya Hub. Contact HR.'
      )
    );
  end if;

  return jsonb_build_object();
end;
$$;

-- Permissions required by Supabase Auth to invoke the hook
grant execute on function public.hook_restrict_signup_to_authorized_users(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup_to_authorized_users(jsonb) from authenticated, anon, public;
