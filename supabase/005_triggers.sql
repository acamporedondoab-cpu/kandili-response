-- ============================================================
-- Migration 005 — Triggers
-- Guardian Dispatch Platform
-- ============================================================
-- Run after 004_indexes.sql.
-- All functions use CREATE OR REPLACE for idempotency.
-- All triggers use DROP IF EXISTS + CREATE for idempotency.
-- ============================================================


-- ============================================================
-- Trigger 1: updated_at auto-stamp
-- Single reusable function applied to organizations, profiles,
-- and incidents. Sets updated_at = now() on every UPDATE.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_incidents_updated_at ON incidents;
CREATE TRIGGER trg_incidents_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();


-- ============================================================
-- Trigger 2: incident code generator
-- Produces INC-YYYYMMDD-NNNN on INSERT.
-- Only fires when incident_code is not already supplied,
-- so manually-set codes (dispatcher_manual, api_external) are
-- preserved if the caller provides one.
-- Note: incident_daily_seq resets at UTC midnight via pg_cron
-- (Sprint 3). Until then codes are globally unique but NNNN
-- will exceed 9999 after the 10000th incident — acceptable for
-- development and early production.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_generate_incident_code()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.incident_code IS NULL OR NEW.incident_code = '' THEN
    NEW.incident_code :=
      'INC-'
      || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD')
      || '-'
      || lpad(nextval('incident_daily_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_code_generate ON incidents;
CREATE TRIGGER trg_incident_code_generate
  BEFORE INSERT ON incidents
  FOR EACH ROW EXECUTE FUNCTION fn_generate_incident_code();


-- ============================================================
-- Trigger 3: auto-create profile on auth signup
-- Fires on auth.users INSERT — creates the matching profiles row.
-- SECURITY DEFINER allows the function to write to public.profiles
-- from the auth schema context.
-- SET search_path = public prevents search-path injection attacks.
-- ON CONFLICT DO NOTHING makes it safe to replay without errors.
-- full_name defaults to empty string; updated during onboarding.
-- phone is read from auth.users.phone (populated by Supabase
-- phone OTP flow), with a fallback to raw_user_meta_data.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone_number', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();


-- ============================================================
-- Trigger 4: mirror responder location to profiles
-- Fires after every responder_locations INSERT.
-- Keeps profiles.last_known_lat/lng/last_location_updated_at
-- current so TL map views read one row instead of aggregating
-- the full location history table.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_mirror_responder_location()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.profiles
  SET
    last_known_lat           = NEW.lat,
    last_known_lng           = NEW.lng,
    last_location_updated_at = NEW.created_at
  WHERE id = NEW.responder_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_responder_location ON responder_locations;
CREATE TRIGGER trg_mirror_responder_location
  AFTER INSERT ON responder_locations
  FOR EACH ROW EXECUTE FUNCTION fn_mirror_responder_location();


-- ============================================================
-- Trigger 5: append incident_logs on status change
-- Fires after every incidents UPDATE where status changed.
-- changed_by is read from the app.current_user_id session
-- variable, which the Edge Function sets via:
--   SET LOCAL app.current_user_id = '<uuid>';
-- before performing the UPDATE. Falls back to NULL safely if
-- the variable is not set (e.g. system-initiated transitions).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_log_incident_status_change()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_changed_by uuid;
BEGIN
  BEGIN
    v_changed_by := current_setting('app.current_user_id', true)::uuid;
  EXCEPTION WHEN others THEN
    v_changed_by := NULL;
  END;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.incident_logs (
      incident_id,
      changed_by,
      old_status,
      new_status
    ) VALUES (
      NEW.id,
      v_changed_by,
      OLD.status::text,
      NEW.status::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_incident_status_change ON incidents;
CREATE TRIGGER trg_log_incident_status_change
  AFTER UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION fn_log_incident_status_change();
