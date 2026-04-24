-- ============================================================
-- Migration 004 — Indexes
-- Guardian Dispatch Platform
-- ============================================================
-- Run after 003_tables.sql.
-- All indexes use CREATE INDEX IF NOT EXISTS for idempotency.
-- incident_code already has an implicit index from the UNIQUE
-- constraint — not duplicated here.
-- ============================================================


-- ============================================================
-- profiles
-- ============================================================

-- Find all TLs or responders in an org (assignment queries)
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id
  ON profiles (organization_id);

-- Filter by role across the platform (admin, TL dashboards)
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON profiles (role);

-- Find on-duty responders quickly (escalation + nearest responder)
CREATE INDEX IF NOT EXISTS idx_profiles_is_on_duty
  ON profiles (is_on_duty)
  WHERE is_on_duty = true;


-- ============================================================
-- organizations
-- ============================================================

-- Filter active orgs (jurisdiction matching, admin views)
CREATE INDEX IF NOT EXISTS idx_organizations_is_active
  ON organizations (is_active)
  WHERE is_active = true;

-- PostGIS spatial index — required for ST_DWithin jurisdiction queries
CREATE INDEX IF NOT EXISTS idx_organizations_base_location
  ON organizations USING GIST (base_location);


-- ============================================================
-- incidents
-- ============================================================

-- Citizen looks up their own incidents
CREATE INDEX IF NOT EXISTS idx_incidents_citizen_id
  ON incidents (citizen_id);

-- TL dashboard: all incidents in my organization
CREATE INDEX IF NOT EXISTS idx_incidents_organization_id
  ON incidents (organization_id);

-- TL dashboard: incidents assigned to me
CREATE INDEX IF NOT EXISTS idx_incidents_assigned_tl_id
  ON incidents (assigned_tl_id);

-- Responder dashboard: incidents assigned to me
CREATE INDEX IF NOT EXISTS idx_incidents_assigned_responder_id
  ON incidents (assigned_responder_id);

-- Filter by status (most common query predicate)
CREATE INDEX IF NOT EXISTS idx_incidents_status
  ON incidents (status);

-- Filter by emergency type
CREATE INDEX IF NOT EXISTS idx_incidents_emergency_type
  ON incidents (emergency_type);

-- Time-based sorting and range queries (admin reports, cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_incidents_created_at
  ON incidents (created_at DESC);

-- Composite: TL dashboard — active incidents for my org, newest first
CREATE INDEX IF NOT EXISTS idx_incidents_organization_status_created
  ON incidents (organization_id, status, created_at DESC);

-- Composite: pending incident queue — status + time for escalation engine
CREATE INDEX IF NOT EXISTS idx_incidents_status_created
  ON incidents (status, created_at DESC);


-- ============================================================
-- incident_logs
-- ============================================================

-- Fetch full audit trail for a single incident
CREATE INDEX IF NOT EXISTS idx_incident_logs_incident_id
  ON incident_logs (incident_id);


-- ============================================================
-- escalation_events
-- ============================================================

-- Fetch all escalation steps for a single incident
CREATE INDEX IF NOT EXISTS idx_escalation_events_incident_id
  ON escalation_events (incident_id);


-- ============================================================
-- responder_locations
-- ============================================================

-- Most recent location per responder (TL map view)
-- DESC so the latest row is found first
CREATE INDEX IF NOT EXISTS idx_responder_locations_responder_created
  ON responder_locations (responder_id, created_at DESC);


-- ============================================================
-- notifications
-- ============================================================

-- Fetch all notifications for a user (inbox)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications (user_id);

-- Fetch all notifications linked to an incident
CREATE INDEX IF NOT EXISTS idx_notifications_incident_id
  ON notifications (incident_id);

-- Find undelivered or failed notifications (retry logic)
CREATE INDEX IF NOT EXISTS idx_notifications_delivery_status
  ON notifications (delivery_status)
  WHERE delivery_status IN ('sent', 'failed');


-- ============================================================
-- sos_attempts
-- ============================================================

-- Fetch SOS history for a citizen (abuse strike queries)
CREATE INDEX IF NOT EXISTS idx_sos_attempts_citizen_id
  ON sos_attempts (citizen_id);

-- Link SOS attempt to a resulting incident
CREATE INDEX IF NOT EXISTS idx_sos_attempts_incident_id
  ON sos_attempts (incident_id);
