-- ============================================================
-- Migration 019 — Barangay-based Jurisdiction Matching
-- ============================================================
-- Adds barangay columns to organizations and incidents.
-- Updates fn_dispatch_sos_atomic to try exact barangay match
-- first, then fall back to the existing distance-based match.
-- One org = one barangay (1:1 in PH context).
-- ============================================================

-- 1. Add barangay to organizations (nullable — existing orgs work unchanged)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS barangay text;

-- 2. Add citizen_barangay to incidents (audit trail + display)
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS citizen_barangay text;

-- ============================================================
-- 3. Replace fn_dispatch_sos_atomic with barangay support
-- Drop old 5-arg signature first so CREATE OR REPLACE works.
-- ============================================================
DROP FUNCTION IF EXISTS public.fn_dispatch_sos_atomic(uuid, numeric, numeric, text, text);

CREATE OR REPLACE FUNCTION public.fn_dispatch_sos_atomic(
  p_citizen_id    uuid,
  p_lat           numeric,
  p_lng           numeric,
  p_emergency_type text,
  p_notes         text DEFAULT NULL,
  p_barangay      text DEFAULT NULL
)
RETURNS TABLE(
  result_code       text,
  incident_id       uuid,
  incident_code     text,
  organization_id   uuid,
  organization_name text,
  distance_km       double precision,
  sos_attempt_id    uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_profile         record;
  v_existing        record;
  v_org             record;
  v_org_found       boolean := false;
  v_incident        record;
  v_sos_attempt_id  uuid;
  v_safe_notes      text;
  v_safe_barangay   text;
BEGIN
  -- Input validation
  IF p_lat IS NULL OR p_lng IS NULL
    OR p_lat < -90 OR p_lat > 90
    OR p_lng < -180 OR p_lng > 180
  THEN
    RETURN QUERY SELECT 'invalid_coordinates'::text, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::double precision, NULL::uuid;
    RETURN;
  END IF;

  IF p_emergency_type NOT IN ('crime', 'medical') THEN
    RETURN QUERY SELECT 'invalid_emergency_type'::text, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::double precision, NULL::uuid;
    RETURN;
  END IF;

  v_safe_notes    := NULLIF(left(btrim(COALESCE(p_notes, '')), 500), '');
  v_safe_barangay := NULLIF(lower(trim(COALESCE(p_barangay, ''))), '');

  -- Serialize concurrent SOS for the same citizen
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_citizen_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'profile_not_found'::text, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::double precision, NULL::uuid;
    RETURN;
  END IF;

  IF v_profile.role <> 'citizen'::public.user_role THEN
    RETURN QUERY SELECT 'forbidden_role'::text, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::double precision, NULL::uuid;
    RETURN;
  END IF;

  IF v_profile.is_suspended THEN
    RETURN QUERY SELECT 'account_suspended'::text, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::double precision, NULL::uuid;
    RETURN;
  END IF;

  IF COALESCE(v_profile.abuse_strike_count, 0) >= 3 THEN
    RETURN QUERY SELECT 'abuse_blocked'::text, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::double precision, NULL::uuid;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.sos_attempts
    WHERE citizen_id = p_citizen_id
      AND created_at >= now() - interval '15 seconds'
  ) THEN
    RETURN QUERY SELECT 'rate_limited'::text, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::double precision, NULL::uuid;
    RETURN;
  END IF;

  -- Block if citizen already has an active incident
  SELECT i.id, i.incident_code INTO v_existing
  FROM public.incidents i
  WHERE i.citizen_id = p_citizen_id
    AND i.status IN (
      'pending', 'acknowledged', 'escalated', 'assigned',
      'accepted', 'en_route', 'arrived', 'pending_citizen_confirmation'
    )
  ORDER BY i.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT 'active_incident_exists'::text, v_existing.id::uuid, v_existing.incident_code::text, NULL::uuid, NULL::text, NULL::double precision, NULL::uuid;
    RETURN;
  END IF;

  -- ── Org matching: barangay first, distance fallback ──────────────────────
  -- Primary: exact barangay match (case-insensitive)
  IF v_safe_barangay IS NOT NULL THEN
    SELECT o.id, o.name, 0.0::double precision AS distance_km
    INTO v_org
    FROM public.organizations o
    WHERE o.is_active = true
      AND o.deleted_at IS NULL
      AND o.barangay IS NOT NULL
      AND lower(trim(o.barangay)) = v_safe_barangay
      AND (
        (p_emergency_type = 'crime'   AND o.type = 'police')
        OR
        (p_emergency_type = 'medical' AND o.type = 'medical')
      )
    LIMIT 1;

    IF FOUND THEN
      v_org_found := true;
    END IF;
  END IF;

  -- Fallback: nearest org within coverage radius
  IF NOT v_org_found THEN
    SELECT o.id, o.name, o.distance_km
    INTO v_org
    FROM public.fn_find_nearest_org(p_lng, p_lat, p_emergency_type) o
    LIMIT 1;

    IF FOUND THEN
      v_org_found := true;
    END IF;
  END IF;

  IF NOT v_org_found THEN
    RETURN QUERY SELECT 'no_org_found'::text, NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::double precision, NULL::uuid;
    RETURN;
  END IF;
  -- ─────────────────────────────────────────────────────────────────────────

  INSERT INTO public.sos_attempts (citizen_id, incident_id, emergency_type)
  VALUES (p_citizen_id, NULL, p_emergency_type::public.emergency_type)
  RETURNING sos_attempts.id INTO v_sos_attempt_id;

  INSERT INTO public.incidents (
    source, citizen_id, organization_id, emergency_type,
    status, priority_level, citizen_lat, citizen_lng,
    citizen_barangay, notes, tl_notified_at
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
    v_safe_barangay,
    v_safe_notes,
    now()
  )
  RETURNING incidents.id, incidents.incident_code INTO v_incident;

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
-- 4. Permissions for new signature
-- ============================================================
REVOKE ALL ON FUNCTION public.fn_dispatch_sos_atomic(uuid, numeric, numeric, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_dispatch_sos_atomic(uuid, numeric, numeric, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.fn_dispatch_sos_atomic(uuid, numeric, numeric, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_dispatch_sos_atomic(uuid, numeric, numeric, text, text, text) TO service_role;
