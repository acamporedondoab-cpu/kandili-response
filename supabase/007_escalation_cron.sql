-- ============================================================
-- Migration 007 — Escalation Cron Job
-- Guardian Dispatch Platform
-- ============================================================
-- Schedules the escalate-incidents Edge Function every minute
-- using pg_cron + pg_net.
--
-- BEFORE running this migration:
--
-- Step 1 — Secrets are already set via CLI:
--   ESCALATION_CRON_SECRET=guardian-escalate-2026
--   ESCALATION_TIMEOUT_SECONDS=30
--
-- Step 2 — Run this full migration in the Supabase SQL Editor.
-- ============================================================

-- Enable pg_net (Supabase includes it by default, this is idempotent)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove existing job if re-running
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'escalate-pending-incidents') THEN
    PERFORM cron.unschedule('escalate-pending-incidents');
  END IF;
END;
$$;

-- Schedule the escalation check every minute
SELECT cron.schedule(
  'escalate-pending-incidents',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://jjgdxmtghtnxiuhmfflq.supabase.co/functions/v1/escalate-incidents',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer guardian-escalate-2026"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
