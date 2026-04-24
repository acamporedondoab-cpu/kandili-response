-- ============================================================
-- Migration 011 — 2-Way Resolution Confirmation
-- Guardian Dispatch Platform
-- ============================================================
-- Adds citizen confirmation step before final resolution.
-- Flow: arrived → pending_citizen_confirmation → resolved
-- The citizen must confirm the incident was truly handled.
-- ============================================================

-- Add new enum value (must be outside a transaction block in Postgres)
ALTER TYPE public.incident_status ADD VALUE IF NOT EXISTS 'pending_citizen_confirmation' AFTER 'arrived';

-- Add citizen confirmation columns
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS citizen_confirmed boolean,
  ADD COLUMN IF NOT EXISTS citizen_confirmed_at timestamptz;

-- ============================================================
-- RPC: citizen confirms or disputes resolution
-- Called by the citizen's mobile app after seeing the prompt.
-- SECURITY DEFINER so we can verify ownership and update safely.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_citizen_confirm_resolution(
  p_incident_id uuid,
  p_confirmed boolean
)
RETURNS TABLE(result_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_incident record;
BEGIN
  SELECT id, citizen_id, status
  INTO v_incident
  FROM public.incidents
  WHERE id = p_incident_id
    AND citizen_id = auth.uid()
    AND status = 'pending_citizen_confirmation'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text;
    RETURN;
  END IF;

  IF p_confirmed THEN
    UPDATE public.incidents
    SET
      status = 'resolved',
      citizen_confirmed = true,
      citizen_confirmed_at = now(),
      resolved_at = now()
    WHERE id = p_incident_id;

    RETURN QUERY SELECT 'confirmed'::text;
  ELSE
    -- Citizen disputes — send back to arrived so responder can re-assess
    UPDATE public.incidents
    SET status = 'arrived'
    WHERE id = p_incident_id;

    RETURN QUERY SELECT 'disputed'::text;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_citizen_confirm_resolution(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_citizen_confirm_resolution(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_citizen_confirm_resolution(uuid, boolean) TO authenticated;
