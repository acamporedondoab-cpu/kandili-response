-- ============================================================
-- Migration 008 - SOS Dispatch RPC
-- Guardian Dispatch Platform
-- ============================================================
-- Run after 007_escalation_cron.sql.
--
-- Purpose:
-- 1. Bring fn_find_nearest_org under migration control.
-- 2. Add fn_dispatch_sos_atomic() so SOS creation is handled
--    inside a single database transaction.
--
-- Why this exists:
-- - The previous app-side flow checked for an open incident and
--   then inserted a new incident in separate queries.
-- - Under concurrent requests, that can create duplicates.
-- - This RPC serializes per-citizen SOS dispatch by locking the
--   citizen's profile row before checking and inserting.
--
-- Service role is the only caller.
-- ============================================================


-- ============================================================
-- Function 1: find nearest organization for an SOS request
-- Managed here so new environments can rebuild cleanly from
-- migrations alone.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_find_nearest_org(
  p_lng numeric,
  p_lat numeric,
  p_emergency_type text
)
RETURNS TABLE(
  id uuid,
  name text,
  type organization_type,
  coverage_radius_km numeric,
  distance_km double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  SELECT
    o.id,
    o.name,
    o.type,
    o.coverage_radius_km,
    ST_Distance(
      o.base_location,
      ST_MakePoint(p_lng, p_lat)::geography
    ) / 1000.0 AS distance_km
  FROM organizations o
  WHERE
    o.is_active = true
    AND o.deleted_at IS NULL
    AND (
      (p_emergency_type = 'crime'   AND o.type = 'police')
      OR
      (p_emergency_type = 'medical' AND o.type = 'medical')
    )
    AND ST_DWithin(
      o.base_location,
      ST_MakePoint(p_lng, p_lat)::geography,
      o.coverage_radius_km * 1000
    )
  ORDER BY distance_km ASC
  LIMIT 1;
$$;


-- ============================================================
-- Function 2: atomic SOS dispatch
-- Result codes let the Edge Function map business outcomes to
-- HTTP responses without guessing from generic SQL failures.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_dispatch_sos_atomic(
  p_citizen_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_emergency_type text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(
  result_code text,
  incident_id uuid,
  incident_code text,
  organization_id uuid,
  organization_name text,
  distance_km double precision,
  sos_attempt_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_profile         public.profiles%ROWTYPE;
  v_existing        record;
  v_org             record;
  v_incident        record;
  v_sos_attempt_id  uuid;
  v_safe_notes      text;
BEGIN
  -- Input validation is repeated here so the DB remains the final
  -- source of truth even if an API caller bypasses the Edge Function.
  IF p_lat IS NULL
    OR p_lng IS NULL
    OR p_lat < -90
    OR p_lat > 90
    OR p_lng < -180
    OR p_lng > 180
  THEN
    RETURN QUERY
    SELECT
      'invalid_coordinates'::text,
      NULL::uuid,
      NULL::text,
      NULL::uuid,
      NULL::text,
      NULL::double precision,
      NULL::uuid;
    RETURN;
  END IF;

  IF p_emergency_type NOT IN ('crime', 'medical') THEN
    RETURN QUERY
    SELECT
      'invalid_emergency_type'::text,
      NULL::uuid,
      NULL::text,
      NULL::uuid,
      NULL::text,
      NULL::double precision,
      NULL::uuid;
    RETURN;
  END IF;

  v_safe_notes := NULLIF(left(btrim(COALESCE(p_notes, '')), 500), '');

  -- Serialize concurrent SOS requests for the same citizen.
  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = p_citizen_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      'profile_not_found'::text,
      NULL::uuid,
      NULL::text,
      NULL::uuid,
      NULL::text,
      NULL::double precision,
      NULL::uuid;
    RETURN;
  END IF;

  IF v_profile.role <> 'citizen'::public.user_role THEN
    RETURN QUERY
    SELECT
      'forbidden_role'::text,
      NULL::uuid,
      NULL::text,
      NULL::uuid,
      NULL::text,
      NULL::double precision,
      NULL::uuid;
    RETURN;
  END IF;

  IF v_profile.is_suspended THEN
    RETURN QUERY
    SELECT
      'account_suspended'::text,
      NULL::uuid,
      NULL::text,
      NULL::uuid,
      NULL::text,
      NULL::double precision,
      NULL::uuid;
    RETURN;
  END IF;

  IF COALESCE(v_profile.abuse_strike_count, 0) >= 3 THEN
    RETURN QUERY
    SELECT
      'abuse_blocked'::text,
      NULL::uuid,
      NULL::text,
      NULL::uuid,
      NULL::text,
      NULL::double precision,
      NULL::uuid;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sos_attempts
    WHERE citizen_id = p_citizen_id
      AND created_at >= now() - interval '15 seconds'
  ) THEN
    RETURN QUERY
    SELECT
      'rate_limited'::text,
      NULL::uuid,
      NULL::text,
      NULL::uuid,
      NULL::text,
      NULL::double precision,
      NULL::uuid;
    RETURN;
  END IF;

  SELECT
    i.id,
    i.incident_code
  INTO v_existing
  FROM public.incidents i
  WHERE i.citizen_id = p_citizen_id
    AND i.status IN (
      'pending',
      'acknowledged',
      'assigned',
      'accepted',
      'en_route',
      'arrived'
    )
  ORDER BY i.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      'active_incident_exists'::text,
      v_existing.id::uuid,
      v_existing.incident_code::text,
      NULL::uuid,
      NULL::text,
      NULL::double precision,
      NULL::uuid;
    RETURN;
  END IF;

  SELECT
    o.id,
    o.name,
    o.distance_km
  INTO v_org
  FROM public.fn_find_nearest_org(p_lng, p_lat, p_emergency_type) o
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      'no_org_found'::text,
      NULL::uuid,
      NULL::text,
      NULL::uuid,
      NULL::text,
      NULL::double precision,
      NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.sos_attempts (
    citizen_id,
    incident_id,
    emergency_type
  )
  VALUES (
    p_citizen_id,
    NULL,
    p_emergency_type::public.emergency_type
  )
  RETURNING id INTO v_sos_attempt_id;

  INSERT INTO public.incidents (
    source,
    citizen_id,
    organization_id,
    emergency_type,
    status,
    priority_level,
    citizen_lat,
    citizen_lng,
    notes,
    tl_notified_at
  )
  VALUES (
    'citizen_sos'::public.incident_source,
    p_citizen_id,
    v_org.id,
    p_emergency_type::public.emergency_type,
    'pending'::public.incident_status,
    'high'::public.incident_priority,
    p_lat,
    p_lng,
    v_safe_notes,
    now()
  )
  RETURNING id, incidents.incident_code INTO v_incident;

  UPDATE public.sos_attempts
  SET incident_id = v_incident.id
  WHERE id = v_sos_attempt_id;

  RETURN QUERY
  SELECT
    'created'::text,
    v_incident.id::uuid,
    v_incident.incident_code::text,
    v_org.id::uuid,
    v_org.name::text,
    v_org.distance_km::double precision,
    v_sos_attempt_id;
END;
$$;


-- ============================================================
-- Permissions
-- Edge Functions call this via service role only.
-- ============================================================
REVOKE ALL ON FUNCTION public.fn_dispatch_sos_atomic(uuid, numeric, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_dispatch_sos_atomic(uuid, numeric, numeric, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.fn_dispatch_sos_atomic(uuid, numeric, numeric, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_dispatch_sos_atomic(uuid, numeric, numeric, text, text) TO service_role;
