-- ============================================================
-- Migration 002 — Enums
-- Guardian Dispatch Platform
-- ============================================================
-- Run after 001_extensions.sql.
-- All enum types must exist before any table that references them.
-- Each block uses EXCEPTION WHEN duplicate_object for idempotency
-- (PostgreSQL does not support CREATE TYPE IF NOT EXISTS).
-- ============================================================


-- User roles across the platform
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'citizen',
    'team_leader',
    'responder',
    'super_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- Emergency categories (MVP: crime and medical)
DO $$ BEGIN
  CREATE TYPE emergency_type AS ENUM (
    'crime',
    'medical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- Organization categories
DO $$ BEGIN
  CREATE TYPE organization_type AS ENUM (
    'police',
    'medical',
    'fire',
    'rescue'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- Full incident lifecycle status
-- 'acknowledged' sits between 'pending' and 'assigned':
--   pending → acknowledged (TL claims incident) → assigned (TL assigns responder)
DO $$ BEGIN
  CREATE TYPE incident_status AS ENUM (
    'pending',
    'acknowledged',
    'assigned',
    'accepted',
    'en_route',
    'arrived',
    'resolved',
    'closed',
    'escalated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- Incident urgency levels
DO $$ BEGIN
  CREATE TYPE incident_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- How an incident was created
DO $$ BEGIN
  CREATE TYPE incident_source AS ENUM (
    'citizen_sos',
    'dispatcher_manual',
    'api_external'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- FCM push notification delivery states
DO $$ BEGIN
  CREATE TYPE notification_delivery_status AS ENUM (
    'sent',
    'delivered',
    'read',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- FCM push notification categories
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'incident_alert',
    'assignment',
    'escalation',
    'status_update'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
