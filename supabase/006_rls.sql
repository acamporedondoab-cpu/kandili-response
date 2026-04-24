-- ============================================================
-- Migration 006 — Row Level Security
-- Guardian Dispatch Platform
-- ============================================================
-- Run after 005_triggers.sql.
-- Service role (used by all Edge Functions) bypasses RLS
-- automatically — no service-role policies are written here.
-- FORCE ROW LEVEL SECURITY is intentionally omitted: it would
-- block Supabase's internal postgres-role operations (migrations,
-- trigger execution, etc.).
-- All policies use DROP IF EXISTS + CREATE for idempotency.
-- ============================================================


-- ============================================================
-- Step 1: Enable RLS on all application tables
-- ============================================================
ALTER TABLE organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE responder_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_attempts        ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- Step 2: Helper functions
-- Both functions are SECURITY DEFINER so they can read profiles
-- without triggering the profiles RLS policy — preventing
-- infinite recursion when these helpers are used inside the
-- profiles table's own policies.
-- SET search_path = public prevents search-path injection.
-- STABLE tells the planner the result is constant within a
-- single query, allowing it to cache the call.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_current_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION fn_current_user_org()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;


-- ============================================================
-- Step 3: Upgrade fn_log_incident_status_change to SECURITY DEFINER
-- The trigger runs under the invoking user's context by default.
-- Without SECURITY DEFINER, a responder updating their incident
-- status would cause the trigger to fail when it tries to INSERT
-- into incident_logs — because no user has a direct INSERT policy
-- on that append-only table. SECURITY DEFINER lets the trigger
-- always write audit entries regardless of who triggers the update.
-- ============================================================
ALTER FUNCTION fn_log_incident_status_change() SECURITY DEFINER;
ALTER FUNCTION fn_log_incident_status_change() SET search_path = public;


-- ============================================================
-- Table: organizations
-- All authenticated users can read organizations — needed for
-- jurisdiction display and org selection during onboarding.
-- Only super_admin can create or modify orgs.
-- No DELETE policy — orgs are soft-deleted via is_active/deleted_at.
-- ============================================================
DROP POLICY IF EXISTS "organizations: authenticated users can read" ON organizations;
CREATE POLICY "organizations: authenticated users can read"
  ON organizations FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "organizations: super_admin can insert" ON organizations;
CREATE POLICY "organizations: super_admin can insert"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (fn_current_user_role() = 'super_admin');

DROP POLICY IF EXISTS "organizations: super_admin can update" ON organizations;
CREATE POLICY "organizations: super_admin can update"
  ON organizations FOR UPDATE
  TO authenticated
  USING  (fn_current_user_role() = 'super_admin')
  WITH CHECK (fn_current_user_role() = 'super_admin');


-- ============================================================
-- Table: profiles
-- SELECT: own profile always; same-org members (TL and responders
--         need to see org colleagues for assignment and map views);
--         super_admin sees everyone.
-- INSERT: fn_handle_new_user trigger (SECURITY DEFINER) handles
--         citizen registration automatically. super_admin can
--         insert directly for bootstrapping admin accounts.
-- UPDATE: own profile (self-service: full_name, fcm_token, etc.);
--         super_admin can update any profile (role, org, suspension).
-- No DELETE policy — profiles are soft-deleted via deleted_at.
-- ============================================================
DROP POLICY IF EXISTS "profiles: own or same-org or admin can read" ON profiles;
CREATE POLICY "profiles: own or same-org or admin can read"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR organization_id = fn_current_user_org()
    OR fn_current_user_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "profiles: super_admin can insert" ON profiles;
CREATE POLICY "profiles: super_admin can insert"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (fn_current_user_role() = 'super_admin');

DROP POLICY IF EXISTS "profiles: own or admin can update" ON profiles;
CREATE POLICY "profiles: own or admin can update"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR fn_current_user_role() = 'super_admin'
  )
  WITH CHECK (
    id = auth.uid()
    OR fn_current_user_role() = 'super_admin'
  );


-- ============================================================
-- Table: incidents
-- SELECT: role-scoped — citizen sees own; responder sees assigned;
--         TL sees all in their org; super_admin sees all.
-- INSERT: Edge Function (service role) only — the SOS dispatch
--         flow always goes through an Edge Function, never a
--         direct client insert. No authenticated INSERT policy.
-- UPDATE: responder can update their assigned incident (status
--         transitions: accepted → en_route → arrived → resolved);
--         TL can update any org incident (acknowledge, assign,
--         close); super_admin can update any incident.
-- No DELETE policy — incidents are never hard-deleted.
-- ============================================================
DROP POLICY IF EXISTS "incidents: citizen sees own" ON incidents;
CREATE POLICY "incidents: citizen sees own"
  ON incidents FOR SELECT
  TO authenticated
  USING (
    citizen_id = auth.uid()
    AND fn_current_user_role() = 'citizen'
  );

DROP POLICY IF EXISTS "incidents: responder sees assigned" ON incidents;
CREATE POLICY "incidents: responder sees assigned"
  ON incidents FOR SELECT
  TO authenticated
  USING (
    assigned_responder_id = auth.uid()
    AND fn_current_user_role() = 'responder'
  );

DROP POLICY IF EXISTS "incidents: TL sees org incidents" ON incidents;
CREATE POLICY "incidents: TL sees org incidents"
  ON incidents FOR SELECT
  TO authenticated
  USING (
    fn_current_user_role() = 'team_leader'
    AND organization_id = fn_current_user_org()
  );

DROP POLICY IF EXISTS "incidents: super_admin sees all" ON incidents;
CREATE POLICY "incidents: super_admin sees all"
  ON incidents FOR SELECT
  TO authenticated
  USING (fn_current_user_role() = 'super_admin');

DROP POLICY IF EXISTS "incidents: responder can update assigned" ON incidents;
CREATE POLICY "incidents: responder can update assigned"
  ON incidents FOR UPDATE
  TO authenticated
  USING (
    assigned_responder_id = auth.uid()
    AND fn_current_user_role() = 'responder'
  )
  WITH CHECK (
    assigned_responder_id = auth.uid()
    AND fn_current_user_role() = 'responder'
  );

DROP POLICY IF EXISTS "incidents: TL can update org incidents" ON incidents;
CREATE POLICY "incidents: TL can update org incidents"
  ON incidents FOR UPDATE
  TO authenticated
  USING (
    fn_current_user_role() = 'team_leader'
    AND organization_id = fn_current_user_org()
  )
  WITH CHECK (
    fn_current_user_role() = 'team_leader'
    AND organization_id = fn_current_user_org()
  );

DROP POLICY IF EXISTS "incidents: super_admin can update any" ON incidents;
CREATE POLICY "incidents: super_admin can update any"
  ON incidents FOR UPDATE
  TO authenticated
  USING  (fn_current_user_role() = 'super_admin')
  WITH CHECK (fn_current_user_role() = 'super_admin');


-- ============================================================
-- Table: incident_logs
-- Append-only audit trail. No user INSERT policy — rows are
-- written exclusively by fn_log_incident_status_change (now
-- SECURITY DEFINER, upgraded in Step 3 above).
-- SELECT mirrors incident visibility: each actor can read logs
-- for incidents they can see.
-- No UPDATE or DELETE — append-only by design (ON DELETE RESTRICT
-- on the FK also prevents incident hard-deletion).
-- ============================================================
DROP POLICY IF EXISTS "incident_logs: citizen sees own incident logs" ON incident_logs;
CREATE POLICY "incident_logs: citizen sees own incident logs"
  ON incident_logs FOR SELECT
  TO authenticated
  USING (
    fn_current_user_role() = 'citizen'
    AND EXISTS (
      SELECT 1 FROM incidents
      WHERE incidents.id = incident_logs.incident_id
        AND incidents.citizen_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "incident_logs: responder sees assigned incident logs" ON incident_logs;
CREATE POLICY "incident_logs: responder sees assigned incident logs"
  ON incident_logs FOR SELECT
  TO authenticated
  USING (
    fn_current_user_role() = 'responder'
    AND EXISTS (
      SELECT 1 FROM incidents
      WHERE incidents.id = incident_logs.incident_id
        AND incidents.assigned_responder_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "incident_logs: TL sees org incident logs" ON incident_logs;
CREATE POLICY "incident_logs: TL sees org incident logs"
  ON incident_logs FOR SELECT
  TO authenticated
  USING (
    fn_current_user_role() = 'team_leader'
    AND EXISTS (
      SELECT 1 FROM incidents
      WHERE incidents.id = incident_logs.incident_id
        AND incidents.organization_id = fn_current_user_org()
    )
  );

DROP POLICY IF EXISTS "incident_logs: super_admin sees all" ON incident_logs;
CREATE POLICY "incident_logs: super_admin sees all"
  ON incident_logs FOR SELECT
  TO authenticated
  USING (fn_current_user_role() = 'super_admin');


-- ============================================================
-- Table: escalation_events
-- Written by the escalation Edge Function (service role).
-- No user INSERT policy.
-- SELECT: TL of the incident's org sees escalation history
--         (shown in the incident detail panel); super_admin sees all.
-- Responders are not shown escalation mechanics — they receive
-- only a push notification that they have been assigned.
-- No UPDATE or DELETE.
-- ============================================================
DROP POLICY IF EXISTS "escalation_events: TL sees org escalations" ON escalation_events;
CREATE POLICY "escalation_events: TL sees org escalations"
  ON escalation_events FOR SELECT
  TO authenticated
  USING (
    fn_current_user_role() = 'team_leader'
    AND EXISTS (
      SELECT 1 FROM incidents
      WHERE incidents.id = escalation_events.incident_id
        AND incidents.organization_id = fn_current_user_org()
    )
  );

DROP POLICY IF EXISTS "escalation_events: super_admin sees all" ON escalation_events;
CREATE POLICY "escalation_events: super_admin sees all"
  ON escalation_events FOR SELECT
  TO authenticated
  USING (fn_current_user_role() = 'super_admin');


-- ============================================================
-- Table: responder_locations
-- Responders INSERT their own GPS rows directly from the mobile
-- app — this is the one table with a user-facing INSERT policy.
-- TL of the same org can SELECT to render the live responder map.
-- Responders can read their own location history.
-- Super_admin reads all.
-- No UPDATE or DELETE by users — cleanup is a scheduled job
-- (Sprint 3, pg_cron) deleting rows older than 90 days.
-- ============================================================
DROP POLICY IF EXISTS "responder_locations: responder inserts own" ON responder_locations;
CREATE POLICY "responder_locations: responder inserts own"
  ON responder_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    responder_id = auth.uid()
    AND fn_current_user_role() = 'responder'
  );

DROP POLICY IF EXISTS "responder_locations: responder reads own" ON responder_locations;
CREATE POLICY "responder_locations: responder reads own"
  ON responder_locations FOR SELECT
  TO authenticated
  USING (
    responder_id = auth.uid()
    AND fn_current_user_role() = 'responder'
  );

DROP POLICY IF EXISTS "responder_locations: TL reads same-org responders" ON responder_locations;
CREATE POLICY "responder_locations: TL reads same-org responders"
  ON responder_locations FOR SELECT
  TO authenticated
  USING (
    fn_current_user_role() = 'team_leader'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = responder_locations.responder_id
        AND profiles.organization_id = fn_current_user_org()
    )
  );

DROP POLICY IF EXISTS "responder_locations: super_admin reads all" ON responder_locations;
CREATE POLICY "responder_locations: super_admin reads all"
  ON responder_locations FOR SELECT
  TO authenticated
  USING (fn_current_user_role() = 'super_admin');


-- ============================================================
-- Table: notifications
-- Each user sees and manages only their own notifications.
-- INSERT is done exclusively by Edge Functions (service role).
-- UPDATE allows a user to mark their own notification as read
-- (the app sets delivery_status = 'read' and read_at = now()).
-- No DELETE.
-- ============================================================
DROP POLICY IF EXISTS "notifications: user reads own" ON notifications;
CREATE POLICY "notifications: user reads own"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications: user updates own" ON notifications;
CREATE POLICY "notifications: user updates own"
  ON notifications FOR UPDATE
  TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ============================================================
-- Table: sos_attempts
-- Written by Edge Function (service role) during SOS dispatch.
-- The citizen-facing SOS action always goes through an Edge
-- Function — no direct client INSERT.
-- SELECT: citizen sees own SOS history; super_admin sees all
--         (for abuse review and strike management).
-- No UPDATE or DELETE — permanent fraud/abuse record.
-- ============================================================
DROP POLICY IF EXISTS "sos_attempts: citizen reads own" ON sos_attempts;
CREATE POLICY "sos_attempts: citizen reads own"
  ON sos_attempts FOR SELECT
  TO authenticated
  USING (
    citizen_id = auth.uid()
    AND fn_current_user_role() = 'citizen'
  );

DROP POLICY IF EXISTS "sos_attempts: super_admin reads all" ON sos_attempts;
CREATE POLICY "sos_attempts: super_admin reads all"
  ON sos_attempts FOR SELECT
  TO authenticated
  USING (fn_current_user_role() = 'super_admin');
