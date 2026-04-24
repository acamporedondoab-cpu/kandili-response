-- ============================================================
-- Migration 009 - Open Incident Uniqueness Guard
-- Guardian Dispatch Platform
-- ============================================================
-- Run after 008_dispatch_sos_atomic.sql.
--
-- Purpose:
-- Add a hard database guard so one citizen cannot have more than
-- one active incident at the same time.
--
-- Important:
-- This migration will fail if duplicate open incidents already
-- exist in the table. Run the audit query below first.
-- ============================================================


-- ============================================================
-- Preflight audit
-- Run this manually before executing the CREATE INDEX statement.
-- Expected result: zero rows.
-- ============================================================
-- SELECT
--   citizen_id,
--   count(*) AS open_incident_count,
--   array_agg(id ORDER BY created_at DESC) AS incident_ids
-- FROM public.incidents
-- WHERE status IN (
--   'pending',
--   'acknowledged',
--   'assigned',
--   'accepted',
--   'en_route',
--   'arrived'
-- )
-- GROUP BY citizen_id
-- HAVING count(*) > 1;


-- ============================================================
-- Hard guardrail: one open incident per citizen
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_incidents_one_open_per_citizen
  ON public.incidents (citizen_id)
  WHERE status IN (
    'pending',
    'acknowledged',
    'assigned',
    'accepted',
    'en_route',
    'arrived'
  );
