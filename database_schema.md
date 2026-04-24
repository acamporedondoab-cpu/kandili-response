# Database Schema — Guardian Dispatch Platform

**Version:** 1.0  
**Last Updated:** 2026-04-15  
**Database:** Supabase (PostgreSQL)

---

## Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
```

---

## Enums

```sql
CREATE TYPE user_role AS ENUM ('citizen', 'team_leader', 'responder', 'super_admin');

CREATE TYPE emergency_type AS ENUM ('crime', 'medical');

CREATE TYPE organization_type AS ENUM ('police', 'medical', 'fire', 'rescue');

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

CREATE TYPE incident_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE incident_source AS ENUM ('citizen_sos', 'dispatcher_manual', 'api_external');

CREATE TYPE notification_delivery_status AS ENUM ('sent', 'delivered', 'read', 'failed');

CREATE TYPE notification_type AS ENUM (
  'incident_alert',
  'assignment',
  'escalation',
  'status_update'
);
```

---

## Tables

---

### 1. `profiles`

Extends Supabase `auth.users`. One row per user for all roles.

```sql
CREATE TABLE profiles (
  id                        uuid          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name                 text          NOT NULL,
  phone_number              text          NOT NULL UNIQUE,
  phone_verified            boolean       NOT NULL DEFAULT false,
  role                      user_role     NOT NULL DEFAULT 'citizen',
  organization_id           uuid          REFERENCES organizations(id),         -- NULL for citizens & super_admins
  tl_priority               int,                                                -- 1 = primary TL, 2 = backup TL
  is_on_duty                boolean       NOT NULL DEFAULT false,               -- Responder duty toggle
  last_known_lat            numeric(10,7),                                      -- Mirrored from responder_locations
  last_known_lng            numeric(10,7),
  last_location_updated_at  timestamptz,
  last_seen_at              timestamptz,                                        -- Online/offline presence tracking
  fcm_token                 text,                                               -- Firebase push notification token
  abuse_strike_count        int           NOT NULL DEFAULT 0,
  is_suspended              boolean       NOT NULL DEFAULT false,
  deleted_at                timestamptz,                                        -- Soft delete — NULL = active
  created_at                timestamptz   NOT NULL DEFAULT now(),
  updated_at                timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_last_seen_at ON profiles(last_seen_at DESC);
```

**Notes:**
- `tl_priority`: only set for `team_leader` role. `1` = primary TL, `2` = backup TL.
- `last_seen_at`: updated on every authenticated API call. A user is "online" if `last_seen_at > now() - interval '5 minutes'`.
- `deleted_at`: all queries must filter `WHERE deleted_at IS NULL` for active users.

---

### 2. `organizations`

Emergency response organizations (police stations, hospitals, etc.).

```sql
CREATE SEQUENCE incident_daily_seq;

CREATE TABLE organizations (
  id                  uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text              NOT NULL,
  type                organization_type NOT NULL,
  base_lat            numeric(10,7)     NOT NULL,
  base_lng            numeric(10,7)     NOT NULL,
  base_location       geography(Point, 4326) GENERATED ALWAYS AS (
                        ST_MakePoint(base_lng, base_lat)::geography
                      ) STORED,                                               -- PostGIS spatial column
  coverage_radius_km  numeric(6,2)      NOT NULL,
  backup_tl_id        uuid              REFERENCES profiles(id),             -- Designated backup TL for escalation
  is_active           boolean           NOT NULL DEFAULT true,
  deleted_at          timestamptz,                                            -- Soft delete
  created_by          uuid              REFERENCES profiles(id),
  created_at          timestamptz       NOT NULL DEFAULT now(),
  updated_at          timestamptz       NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_is_active ON organizations(is_active);
CREATE INDEX idx_organizations_backup_tl_id ON organizations(backup_tl_id);
CREATE INDEX idx_organizations_base_location ON organizations USING GIST(base_location);
```

**Jurisdiction Query (finds correct org for a citizen GPS):**

```sql
-- Priority: smallest radius first, then nearest base distance
SELECT *,
  ST_Distance(base_location, ST_MakePoint(:lng, :lat)::geography) AS dist_m
FROM organizations
WHERE is_active = true
  AND deleted_at IS NULL
  AND ST_DWithin(base_location, ST_MakePoint(:lng, :lat)::geography, coverage_radius_km * 1000)
ORDER BY coverage_radius_km ASC, dist_m ASC
LIMIT 1;
```

---

### 3. `incidents`

Core table. One row per emergency event. Stores the full lifecycle and all audit timestamps.

```sql
CREATE TABLE incidents (
  id                      uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_code           text              NOT NULL UNIQUE,                 -- e.g. INC-20260415-0042
  source                  incident_source   NOT NULL DEFAULT 'citizen_sos',
  citizen_id              uuid              NOT NULL REFERENCES profiles(id),
  organization_id         uuid              REFERENCES organizations(id),
  assigned_tl_id          uuid              REFERENCES profiles(id),
  assigned_responder_id   uuid              REFERENCES profiles(id),
  resolved_by             uuid              REFERENCES profiles(id),         -- Who marked resolved
  closed_by               uuid              REFERENCES profiles(id),         -- Who marked closed
  emergency_type          emergency_type    NOT NULL,
  status                  incident_status   NOT NULL DEFAULT 'pending',
  priority_level          incident_priority NOT NULL DEFAULT 'high',
  citizen_lat             numeric(10,7)     NOT NULL,
  citizen_lng             numeric(10,7)     NOT NULL,
  citizen_address         text,                                              -- Reverse-geocoded
  notes                   text,
  response_time_seconds   int,                                               -- KPI: accepted_at - created_at
  audio_url               text,                                              -- Future: audio evidence
  image_url               text,                                              -- Future: photo evidence
  video_url               text,                                              -- Future: video evidence
  -- Audit timestamps
  created_at              timestamptz       NOT NULL DEFAULT now(),          -- Alert created
  tl_notified_at          timestamptz,                                       -- Alert sent to TL
  tl_assigned_at          timestamptz,                                       -- TL acknowledged
  responder_assigned_at   timestamptz,                                       -- TL assigned responder
  accepted_at             timestamptz,                                       -- Responder accepted
  en_route_at             timestamptz,                                       -- Responder en route
  arrived_at              timestamptz,                                       -- Responder on scene
  resolved_at             timestamptz,                                       -- Incident resolved
  closed_at               timestamptz,                                       -- Incident closed
  escalated_at            timestamptz,                                       -- First escalation fired
  archived_at             timestamptz,                                       -- Soft archive (legal preservation)
  updated_at              timestamptz       NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_incidents_incident_code ON incidents(incident_code);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_citizen_id ON incidents(citizen_id);
CREATE INDEX idx_incidents_organization_id ON incidents(organization_id);
CREATE INDEX idx_incidents_assigned_tl_id ON incidents(assigned_tl_id);
CREATE INDEX idx_incidents_assigned_responder_id ON incidents(assigned_responder_id);
CREATE INDEX idx_incidents_created_at ON incidents(created_at DESC);
CREATE INDEX idx_incidents_source ON incidents(source);
CREATE INDEX idx_incidents_priority_level ON incidents(priority_level);
```

**incident_code format:** `INC-YYYYMMDD-NNNN` (zero-padded daily sequence, generated by trigger).

**response_time_seconds:** Auto-computed by trigger when `accepted_at` is set:
```sql
EXTRACT(EPOCH FROM (accepted_at - created_at))::int
```

**archive rule:** `archived_at` can only be set when `status = 'closed'`. Incidents are never hard-deleted.

---

### 4. `incident_logs`

Append-only audit trail. Records every status change and significant action. Never deleted.

```sql
CREATE TABLE incident_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  uuid        NOT NULL REFERENCES incidents(id) ON DELETE RESTRICT,
  changed_by   uuid        REFERENCES profiles(id),    -- NULL = system/automated action
  old_status   text,                                   -- Status before change
  new_status   text        NOT NULL,                   -- Status after change or event label
  notes        text,
  metadata     jsonb,                                  -- Extra structured data (GPS snapshot, escalation info, etc.)
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_incident_logs_incident_id ON incident_logs(incident_id);
CREATE INDEX idx_incident_logs_created_at ON incident_logs(created_at DESC);
```

**Notes:**
- `ON DELETE RESTRICT` prevents hard-deleting an incident that has log entries.
- Auto-populated via DB trigger on `incidents.status` change.
- `metadata` jsonb is used for unstructured extras (e.g. location snapshot, FCM delivery result).

---

### 5. `escalation_events`

Records each escalation step fired during an incident. Never deleted.

```sql
CREATE TABLE escalation_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id       uuid        NOT NULL REFERENCES incidents(id) ON DELETE RESTRICT,
  escalation_level  int         NOT NULL,              -- 1 = primary→backup TL, 2 = backup TL→responder
  from_user_id      uuid        REFERENCES profiles(id), -- Who timed out (was skipped)
  to_user_id        uuid        REFERENCES profiles(id), -- Who was escalated to
  reason            text        NOT NULL DEFAULT 'timeout',
  timeout_seconds   int         NOT NULL DEFAULT 10,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_escalation_events_incident_id ON escalation_events(incident_id);
CREATE INDEX idx_escalation_events_level ON escalation_events(escalation_level);
```

---

### 6. `responder_locations`

Real-time location history for on-duty responders. Retained 90 days.

```sql
CREATE TABLE responder_locations (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  responder_id  uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lat           numeric(10,7) NOT NULL,
  lng           numeric(10,7) NOT NULL,
  accuracy_m    numeric(8,2),
  created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_responder_locations_responder_id ON responder_locations(responder_id);
CREATE INDEX idx_responder_locations_created_at ON responder_locations(created_at DESC);
```

**Notes:**
- Latest row is mirrored to `profiles.last_known_lat/lng/last_location_updated_at` via DB trigger.
- Rows older than 90 days are removed by a scheduled cleanup job (non-legal data).

---

### 7. `notifications`

Full delivery lifecycle log for all push notifications.

```sql
CREATE TABLE notifications (
  id               uuid                         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid                         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  incident_id      uuid                         REFERENCES incidents(id),
  type             notification_type            NOT NULL,
  title            text                         NOT NULL,
  body             text                         NOT NULL,
  delivery_status  notification_delivery_status NOT NULL DEFAULT 'sent',
  delivered_at     timestamptz,                            -- FCM confirmed delivery
  read_at          timestamptz,                            -- User opened notification
  failed_reason    text,                                   -- FCM error if failed
  sent_at          timestamptz                  NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_incident_id ON notifications(incident_id);
CREATE INDEX idx_notifications_delivery_status ON notifications(delivery_status);
```

**Delivery status flow:** `sent` → `delivered` → `read` (or `failed` at any point).

---

### 8. `sos_attempts`

Logs every SOS trigger — including cancellations. Used for abuse detection and security auditing. Never deleted.

```sql
CREATE TABLE sos_attempts (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id      uuid            NOT NULL REFERENCES profiles(id),
  incident_id     uuid            REFERENCES incidents(id),  -- NULL if cancelled before dispatch
  emergency_type  emergency_type,
  was_cancelled   boolean         NOT NULL DEFAULT false,
  cancel_reason   text,
  device_id       text,                                      -- Device fingerprint
  ip_address      inet,                                      -- Client IP at trigger time
  created_at      timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX idx_sos_attempts_citizen_id ON sos_attempts(citizen_id);
CREATE INDEX idx_sos_attempts_was_cancelled ON sos_attempts(was_cancelled);
CREATE INDEX idx_sos_attempts_created_at ON sos_attempts(created_at DESC);
CREATE INDEX idx_sos_attempts_device_id ON sos_attempts(device_id);
CREATE INDEX idx_sos_attempts_ip_address ON sos_attempts(ip_address);
```

---

## Relationships Summary

```
auth.users (Supabase Auth)
    └── profiles (1:1)
          ├── organizations (many:1)           ← TLs and responders belong to one org
          ├── incidents [citizen_id] (1:many)
          ├── incidents [assigned_tl_id] (1:many)
          ├── incidents [assigned_responder_id] (1:many)
          ├── incidents [resolved_by] (1:many)
          ├── incidents [closed_by] (1:many)
          ├── responder_locations (1:many)
          ├── notifications (1:many)
          └── sos_attempts (1:many)

organizations
    ├── incidents (1:many)
    └── profiles [backup_tl_id] (many:1)

incidents
    ├── incident_logs (1:many)           ON DELETE RESTRICT
    ├── escalation_events (1:many)       ON DELETE RESTRICT
    ├── notifications (1:many)
    └── sos_attempts (1:many)
```

---

## Soft Delete / Archive Strategy

| Table | Strategy | Column | Rule |
|---|---|---|---|
| `profiles` | Soft delete | `deleted_at` | Set timestamp, filter `WHERE deleted_at IS NULL`. Auth account disabled in parallel. |
| `organizations` | Soft delete | `deleted_at` | Set timestamp + `is_active = false`. Excluded from jurisdiction queries. |
| `incidents` | Archive only | `archived_at` | Set timestamp. Incident must be `closed` before archiving. Never hard-deleted. |
| `incident_logs` | Never deleted | — | `ON DELETE RESTRICT`. Permanent audit trail. |
| `escalation_events` | Never deleted | — | `ON DELETE RESTRICT`. Permanent audit trail. |
| `sos_attempts` | Never deleted | — | Permanent fraud/abuse record. |
| `responder_locations` | 90-day retention | — | Scheduled cleanup job removes rows older than 90 days. |
| `notifications` | 30-day retention | — | Scheduled cleanup job removes rows older than 30 days. |

---

## RLS Policy Summary

| Table | Citizen | Team Leader | Responder | Super Admin |
|---|---|---|---|---|
| `profiles` | Own row only | Own row + org members (read) | Own row only | All rows |
| `organizations` | Read matched org | Read own org | Read own org | Full CRUD |
| `incidents` | Own incidents only | All org incidents | Assigned incidents only | All rows |
| `incident_logs` | Own incident logs | Org incident logs | Assigned incident logs | All rows |
| `escalation_events` | None | Org escalations | Assigned escalations | All rows |
| `responder_locations` | None | Read org responders | Own rows only | All rows |
| `notifications` | Own only | Own only | Own only | All rows |
| `sos_attempts` | Own only | None | None | All rows |

---

## DB Triggers

| Trigger | Table | Event | Action |
|---|---|---|---|
| `trg_profiles_updated_at` | `profiles` | BEFORE UPDATE | Sets `updated_at = now()` |
| `trg_organizations_updated_at` | `organizations` | BEFORE UPDATE | Sets `updated_at = now()` |
| `trg_incidents_updated_at` | `incidents` | BEFORE UPDATE | Sets `updated_at = now()` |
| `trg_profiles_auto_create` | `auth.users` | AFTER INSERT | Creates default `profiles` row |
| `trg_mirror_responder_location` | `responder_locations` | AFTER INSERT | Updates `profiles.last_known_lat/lng/last_location_updated_at` |
| `trg_incident_code_generate` | `incidents` | BEFORE INSERT | Generates `INC-YYYYMMDD-NNNN` code |
| `trg_incident_response_time` | `incidents` | BEFORE UPDATE | Computes `response_time_seconds` when `accepted_at` is set |
| `trg_incident_log_on_status` | `incidents` | AFTER UPDATE | Appends row to `incident_logs` when `status` changes |

---

## Incident Lifecycle Reference

```
[citizen SOS]
      │
      ▼
  pending  ──── (jurisdiction matched, TL notified) ────►  assigned
                                                                │
                                              (TL assigns responder)
                                                                │
                                                                ▼
                                                           accepted
                                                                │
                                                           en_route
                                                                │
                                                            arrived
                                                                │
                                                            resolved
                                                                │
                                                             closed
                                                                │
                                                          [archived]

  Any stage ──── (timeout, no response) ────► escalated
```

---

## KPI / Reporting Fields

| Field | Table | Purpose |
|---|---|---|
| `response_time_seconds` | `incidents` | Time from SOS to responder acceptance |
| `tl_notified_at` | `incidents` | Dispatch delay measurement |
| `escalated_at` | `incidents` | Escalation rate tracking |
| `abuse_strike_count` | `profiles` | Abuse/false alarm monitoring |
| `delivery_status` | `notifications` | FCM delivery success rate |
| `was_cancelled` | `sos_attempts` | False trigger rate |
