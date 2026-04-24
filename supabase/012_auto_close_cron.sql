-- ============================================================
-- Migration 012 — Auto-Close Cron Job
-- Guardian Dispatch Platform
-- ============================================================
-- Schedules the auto-close-incidents Edge Function every minute.
-- Incidents stuck in pending_citizen_confirmation for longer than
-- AUTO_CLOSE_TIMEOUT_SECONDS (default 1800 = 30 min) are
-- automatically closed when the citizen doesn't respond.
--
-- BEFORE running this migration:
--
-- Step 1 — Set the secret in Supabase dashboard (Secrets):
--   AUTO_CLOSE_TIMEOUT_SECONDS=1800
--   (ESCALATION_CRON_SECRET is already set — reused here)
--
-- Step 2 — Deploy the Edge Function:
--   supabase functions deploy auto-close-incidents
--
-- Step 3 — Run this SQL in the Supabase SQL Editor.
-- ============================================================

-- Remove existing job if re-running
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-close-unconfirmed-incidents') THEN
    PERFORM cron.unschedule('auto-close-unconfirmed-incidents');
  END IF;
END;
$$;

-- Schedule auto-close check every minute
SELECT cron.schedule(
  'auto-close-unconfirmed-incidents',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://jjgdxmtghtnxiuhmfflq.supabase.co/functions/v1/auto-close-incidents',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer guardian-escalate-2026"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
