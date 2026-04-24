-- ============================================================
-- Migration 001 — Extensions
-- Guardian Dispatch Platform
-- ============================================================
-- Run this first. All other migrations depend on these extensions.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation (gen_random_uuid fallback)
CREATE EXTENSION IF NOT EXISTS "postgis";      -- Geospatial queries (jurisdiction matching)
