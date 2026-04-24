-- ============================================================
-- Migration 003 — Tables
-- Guardian Dispatch Platform
-- ============================================================
-- Run after 002_enums.sql.
-- Tables are created in dependency order.
--
-- Circular FK resolution:
--   organizations.backup_tl_id → profiles(id)
--   organizations.created_by   → profiles(id)
--   profiles.organization_id   → organizations(id)
--
-- Solution: create organizations first WITHOUT those two FKs,
-- then create profiles, then add the FKs via ALTER TABLE below.
-- ============================================================


-- ============================================================
-- Sequence: daily incident code counter
-- Used by trg_incident_code_generate to produce INC-YYYYMMDD-NNNN
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS incident_daily_seq;


-- ============================================================
-- Table 1: organizations
-- Created WITHOUT backup_tl_id and created_by FKs (circular dep).
-- Both FKs are added via ALTER TABLE after profiles is created.
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id                  uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text              NOT NULL,
  type                organization_type NOT NULL,
  base_lat            numeric(10,7)     NOT NULL,
  base_lng            numeric(10,7)     NOT NULL,
  base_location       geography(Point, 4326) GENERATED ALWAYS AS (
                        ST_MakePoint(base_lng, base_lat)::geography
                      ) STORED,
  coverage_radius_km  numeric(6,2)      NOT NULL,
  backup_tl_id        uuid,                                         -- FK added below
  is_active           boolean           NOT NULL DEFAULT true,
  deleted_at          timestamptz,
  created_by          uuid,                                         -- FK added below
  created_at          timestamptz       NOT NULL DEFAULT now(),
  updated_at          timestamptz       NOT NULL DEFAULT now()
);


-- ============================================================
-- Table 2: profiles
-- Extends auth.users (1:1). One row per user, all roles.
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id                        uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name                 text        NOT NULL,
  phone_number              text        NOT NULL UNIQUE,
  phone_verified            boolean     NOT NULL DEFAULT false,
  role                      user_role   NOT NULL DEFAULT 'citizen',
  organization_id           uuid        REFERENCES organizations(id),
  tl_priority               int,
  is_on_duty                boolean     NOT NULL DEFAULT false,
  last_known_lat            numeric(10,7),
  last_known_lng            numeric(10,7),
  last_location_updated_at  timestamptz,
  last_seen_at              timestamptz,
  fcm_token                 text,
  abuse_strike_count        int         NOT NULL DEFAULT 0,
  is_suspended              boolean     NOT NULL DEFAULT false,
  deleted_at                timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- Circular FK resolution: organizations → profiles
-- Must run after profiles is created.
-- Wrapped in DO blocks for idempotency.
-- ============================================================
DO $$ BEGIN
  ALTER TABLE organizations
    ADD CONSTRAINT fk_organizations_backup_tl_id
    FOREIGN KEY (backup_tl_id) REFERENCES profiles(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE organizations
    ADD CONSTRAINT fk_organizations_created_by
    FOREIGN KEY (created_by) REFERENCES profiles(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- Table 3: incidents
-- Core table. One row per emergency event. Full lifecycle.
-- ============================================================
CREATE TABLE IF NOT EXISTS incidents (
  id                      uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_code           text              NOT NULL UNIQUE,
  source                  incident_source   NOT NULL DEFAULT 'citizen_sos',
  citizen_id              uuid              NOT NULL REFERENCES profiles(id),
  organization_id         uuid              REFERENCES organizations(id),
  assigned_tl_id          uuid              REFERENCES profiles(id),
  assigned_responder_id   uuid              REFERENCES profiles(id),
  resolved_by             uuid              REFERENCES profiles(id),
  closed_by               uuid              REFERENCES profiles(id),
  emergency_type          emergency_type    NOT NULL,
  status                  incident_status   NOT NULL DEFAULT 'pending',
  priority_level          incident_priority NOT NULL DEFAULT 'high',
  citizen_lat             numeric(10,7)     NOT NULL,
  citizen_lng             numeric(10,7)     NOT NULL,
  citizen_address         text,
  notes                   text,
  response_time_seconds   int,
  audio_url               text,
  image_url               text,
  video_url               text,
  -- Audit timestamps
  created_at              timestamptz       NOT NULL DEFAULT now(),
  tl_notified_at          timestamptz,
  tl_assigned_at          timestamptz,
  responder_assigned_at   timestamptz,
  accepted_at             timestamptz,
  en_route_at             timestamptz,
  arrived_at              timestamptz,
  resolved_at             timestamptz,
  closed_at               timestamptz,
  escalated_at            timestamptz,
  archived_at             timestamptz,
  updated_at              timestamptz       NOT NULL DEFAULT now()
);


-- ============================================================
-- Table 4: incident_logs
-- Append-only audit trail. ON DELETE RESTRICT prevents hard
-- deletion of any incident that has log entries.
-- ============================================================
CREATE TABLE IF NOT EXISTS incident_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  uuid        NOT NULL REFERENCES incidents(id) ON DELETE RESTRICT,
  changed_by   uuid        REFERENCES profiles(id),
  old_status   text,
  new_status   text        NOT NULL,
  notes        text,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- Table 5: escalation_events
-- Records each escalation step. ON DELETE RESTRICT prevents
-- hard deletion of any incident that has escalation records.
-- ============================================================
CREATE TABLE IF NOT EXISTS escalation_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id       uuid        NOT NULL REFERENCES incidents(id) ON DELETE RESTRICT,
  escalation_level  int         NOT NULL,
  from_user_id      uuid        REFERENCES profiles(id),
  to_user_id        uuid        REFERENCES profiles(id),
  reason            text        NOT NULL DEFAULT 'timeout',
  timeout_seconds   int         NOT NULL DEFAULT 10,
  created_at        timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- Table 6: responder_locations
-- Real-time location history for on-duty responders.
-- ON DELETE CASCADE: location history removed with the profile.
-- ============================================================
CREATE TABLE IF NOT EXISTS responder_locations (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  responder_id  uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lat           numeric(10,7) NOT NULL,
  lng           numeric(10,7) NOT NULL,
  accuracy_m    numeric(8,2),
  created_at    timestamptz   NOT NULL DEFAULT now()
);


-- ============================================================
-- Table 7: notifications
-- Full delivery lifecycle log for all push notifications.
-- ON DELETE CASCADE: notifications removed with the profile.
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id               uuid                         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid                         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  incident_id      uuid                         REFERENCES incidents(id),
  type             notification_type            NOT NULL,
  title            text                         NOT NULL,
  body             text                         NOT NULL,
  delivery_status  notification_delivery_status NOT NULL DEFAULT 'sent',
  delivered_at     timestamptz,
  read_at          timestamptz,
  failed_reason    text,
  sent_at          timestamptz                  NOT NULL DEFAULT now()
);


-- ============================================================
-- Table 8: sos_attempts
-- Logs every SOS trigger including cancellations.
-- Never deleted — permanent fraud/abuse record.
-- ============================================================
CREATE TABLE IF NOT EXISTS sos_attempts (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id      uuid           NOT NULL REFERENCES profiles(id),
  incident_id     uuid           REFERENCES incidents(id),
  emergency_type  emergency_type,
  was_cancelled   boolean        NOT NULL DEFAULT false,
  cancel_reason   text,
  device_id       text,
  ip_address      inet,
  created_at      timestamptz    NOT NULL DEFAULT now()
);
