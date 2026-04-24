# API Logic — Guardian Dispatch Platform

**Version:** 1.1  
**Last Updated:** 2026-04-15  
**Backend:** Supabase (PostgreSQL + Edge Functions + Realtime)  
**Reference:** `project_specs.md`, `database_schema.md`

> **Schema Change Required (v1.1):** The `incident_status` enum in `database_schema.md` must be updated to include `'acknowledged'` between `'pending'` and `'assigned'`.
> ```sql
> CREATE TYPE incident_status AS ENUM (
>   'pending', 'acknowledged', 'assigned', 'accepted',
>   'en_route', 'arrived', 'resolved', 'closed', 'escalated'
> );
> ```

---

## Module Index

| # | Module | Description |
|---|---|---|
| 1 | [Authentication & Profile Management](#1-authentication--profile-management) | Registration, login, profile setup, presence |
| 2 | [SOS Dispatch Flow](#2-sos-dispatch-flow) | Core emergency trigger, GPS, jurisdiction, routing |
| 3 | [Escalation Engine](#3-escalation-engine) | TL timeout logic, fallback routing, event logging |
| 4 | [Team Leader Incident Management](#4-team-leader-incident-management) | Alert receipt, map view, responder assignment, reassignment |
| 5 | [Responder Assignment & Status Flow](#5-responder-assignment--status-flow) | Accept, decline, status updates, resolution |
| 6 | [Incident Closure & Archiving](#6-incident-closure--archiving) | Close, notify citizen, archive |
| 7 | [Real-time Location Tracking](#7-real-time-location-tracking) | Responder GPS push, mirror, TL visibility |
| 8 | [Push Notification System](#8-push-notification-system) | FCM dispatch, delivery tracking, retry |
| 9 | [Real-time Subscriptions](#9-real-time-subscriptions) | Supabase Realtime channels per role |
| 10 | [Admin Module](#10-admin-module) | Org management, user management, KPI |
| 11 | [Abuse Prevention & Strike System](#11-abuse-prevention--strike-system) | Strike tracking, auto-suspend, review |
| 12 | [Scheduled Cleanup Jobs](#12-scheduled-cleanup-jobs) | Data retention enforcement |

---

## Global Rules

These rules apply to every module and every endpoint.

### Authentication
- Every request (except registration and login) must carry a valid Supabase JWT.
- The JWT `sub` field maps to `profiles.id`.
- Every authenticated request updates `profiles.last_seen_at = now()`.

### Role Enforcement
- Role is read from `profiles.role` — never from the client payload.
- Endpoints enforce role at the application layer AND via Supabase RLS.
- A user whose `is_suspended = true` receives `403 Forbidden` on all actions except reading their own profile.

### Soft Delete Guard
- All queries must include `WHERE deleted_at IS NULL` for `profiles` and `organizations`.
- Suspended users are not deleted — `is_suspended` flag is used instead.

### Audit Logging
- Every incident status change must produce an `incident_logs` row (via DB trigger).
- Every significant system action (escalation, assignment, suspension) must produce an `incident_logs` or equivalent row.

### Input Validation
- Validate all inputs before any DB write.
- Reject missing required fields with `400 Bad Request`.
- Reject invalid enum values with `400 Bad Request`.
- Reject GPS coordinates outside valid range (`lat: -90 to 90`, `lng: -180 to 180`) with `400 Bad Request`.

---

## 1. Authentication & Profile Management

### 1.1 Citizen Registration

**Purpose:** Register a new citizen user via phone number and OTP.

**Actors:** Citizen (unauthenticated)

**Inputs:**
- `full_name` (string, required)
- `phone_number` (string, required, E.164 format)
- `otp_code` (string, required, 6 digits)

**Validations:**
- `phone_number` must be valid E.164 format.
- `phone_number` must not already exist in `profiles`.
- `otp_code` must match the OTP issued by Supabase Auth for this phone number.

**Step-by-step Logic:**
1. Client sends phone number to Supabase Auth OTP endpoint → Supabase sends SMS OTP.
2. Client submits `full_name` + `phone_number` + `otp_code`.
3. Verify OTP via Supabase Auth.
4. On success, Supabase Auth creates `auth.users` row.
5. DB trigger `trg_profiles_auto_create` fires → inserts row into `profiles` with:
   - `role = 'citizen'`
   - `phone_verified = true`
   - `organization_id = NULL`
6. Return Supabase session JWT to client.

**DB Operations:** `auth.users` INSERT → `profiles` INSERT (trigger)

**Error Cases:**
- Invalid OTP → `401 Unauthorized`
- Phone number already registered → `409 Conflict`
- Invalid phone format → `400 Bad Request`

**Security:** No auth required. Rate-limit OTP sends per phone number (Supabase Auth handles this).

---

### 1.2 Login (All Roles)

**Purpose:** Authenticate an existing user and return a session.

**Actors:** Citizen, Team Leader, Responder, Super Admin

**Inputs:**
- `phone_number` (string, required)
- `otp_code` (string, required)

**Step-by-step Logic:**
1. Client submits phone + OTP to Supabase Auth.
2. Supabase verifies OTP and returns JWT.
3. Client receives JWT — all subsequent requests include this as `Authorization: Bearer <token>`.
4. On app load, client calls `GET /profile` (reads own `profiles` row) to hydrate role and state.
5. `profiles.last_seen_at` is updated.

**DB Operations:** `profiles` READ, `profiles` UPDATE (`last_seen_at`)

**Error Cases:**
- Wrong OTP → `401 Unauthorized`
- User is suspended (`is_suspended = true`) → `403 Forbidden` with message "Account suspended."
- User soft-deleted (`deleted_at IS NOT NULL`) → `403 Forbidden`

---

### 1.3 Profile Auto-Create (DB Trigger)

**Trigger:** `trg_profiles_auto_create` — fires AFTER INSERT on `auth.users`

**Logic:**
1. Read `new.id` (auth UID), `new.phone` from inserted auth row.
2. Insert into `profiles`:
   - `id = new.id`
   - `phone_number = new.phone`
   - `phone_verified = true`
   - `role = 'citizen'` (default — admin changes role after)
   - All other fields set to defaults.

---

### 1.4 FCM Token Registration

**Purpose:** Store or update a device's Firebase Cloud Messaging token for push notifications.

**Actors:** Any authenticated user

**Inputs:**
- `fcm_token` (string, required)

**Step-by-step Logic:**
1. Validate JWT.
2. Validate `fcm_token` is a non-empty string.
3. Update `profiles.fcm_token = fcm_token` for the authenticated user.

**DB Operations:** `profiles` UPDATE

**Error Cases:**
- Empty token → `400 Bad Request`

---

### 1.5 Presence Heartbeat

**Purpose:** Track online/offline status for TL dashboards and responder availability.

**Mechanism:** Updated automatically on every authenticated API call via middleware — no dedicated endpoint needed.

**Logic:**
- On any authenticated request: `UPDATE profiles SET last_seen_at = now() WHERE id = auth.uid()`.
- A user is considered "online" if `last_seen_at > now() - interval '5 minutes'`.
- TL dashboard uses this to indicate which responders are currently active.

---

### 1.6 Profile Update

**Purpose:** Update own profile fields.

**Actors:** Any authenticated user (own profile only)

**Allowed Fields by Role:**
- Citizen: `full_name`
- Responder: `full_name`, `is_on_duty`
- Team Leader: `full_name`
- Super Admin: any field (via Admin Module)

**Validations:**
- Cannot change `role`, `organization_id`, `phone_number`, `abuse_strike_count`, `is_suspended` from this endpoint.
- `is_on_duty` can only be set by responders.

**DB Operations:** `profiles` UPDATE

---

## 2. SOS Dispatch Flow

### 2.1 Overview

The SOS dispatch flow is the critical path of the platform. Every step must complete or surface an error — no silent failures.

```
Citizen holds SOS (2s)
    → Emergency type selected
    → 3-second countdown
    → Can cancel during countdown
    → Alert dispatched
    → GPS captured
    → sos_attempts row written
    → Incident created
    → Jurisdiction matched
    → TL notified
```

---

### 2.2 Hold-to-Activate Guard (Frontend)

**Logic (frontend only — no backend call):**
- Button must be held for ≥ 2 continuous seconds.
- If released before 2 seconds: no action, no API call.
- On 2-second hold: show emergency type modal.

---

### 2.3 Emergency Type Selection

**Logic (frontend only):**
- Modal presents: `Crime` | `Medical`
- User selects one → 3-second countdown begins.
- Selected type is held in local state — not sent to server yet.

---

### 2.4 Countdown & Cancel Window

**Logic:**
- 3-second visual countdown.
- If citizen taps Cancel during countdown:
  - Write `sos_attempts` row with `was_cancelled = true`, `cancel_reason` (optional).
  - No incident is created.
  - Return to home screen.
- If countdown completes: proceed to dispatch.

**DB Operations (on cancel):** `sos_attempts` INSERT

---

### 2.5 SOS Dispatch (POST /incidents)

**Purpose:** Create a new emergency incident and begin the dispatch chain.

**Actors:** Citizen (authenticated)

**Inputs:**
- `emergency_type` (enum: crime | medical, required)
- `lat` (numeric, required)
- `lng` (numeric, required)
- `device_id` (string, optional — for abuse tracking)

**Validations:**
- User `role` must be `citizen`.
- User `is_suspended` must be `false`.
- `lat` must be between -90 and 90.
- `lng` must be between -180 and 180.
- `emergency_type` must be a valid enum value.
- Check for active incident: citizen must not already have an open incident (`status NOT IN ('resolved', 'closed')`). If they do → `409 Conflict` with message "You already have an active incident."

**Step-by-step Logic:**
1. Validate inputs.
2. Check for existing active incident.
3. Write `sos_attempts` row: `was_cancelled = false`, `device_id`, `ip_address`.
4. Create `incidents` row:
   - `source = 'citizen_sos'`
   - `status = 'pending'`
   - `priority_level = 'high'` (default for all SOS)
   - `citizen_lat`, `citizen_lng` from input
   - `organization_id = NULL` (not yet matched)
   - DB trigger `trg_incident_code_generate` sets `incident_code`
5. Asynchronously reverse-geocode `lat/lng` → write `citizen_address` (non-blocking).
6. Run jurisdiction matching query (PostGIS `ST_DWithin`).
7. If organization found:
   - Update `incidents.organization_id`
   - Proceed to TL routing (Step 8)
8. If no organization found:
   - Set `incidents.status = 'escalated'`
   - Notify Super Admin (push notification + `notifications` row)
   - Log to `incident_logs`: `new_status = 'no_jurisdiction'`
   - Return incident to citizen so they can see it is being handled
9. Find primary TL: `profiles WHERE organization_id = org.id AND role = 'team_leader' AND tl_priority = 1 AND deleted_at IS NULL AND is_suspended = false`.
10. Send FCM push notification to primary TL's `fcm_token` (type: `incident_alert`).
11. Write `notifications` row for TL.
12. Set `incidents.tl_notified_at = now()`.
13. Update `sos_attempts.incident_id = new incident id`.
14. Start escalation timer (10 seconds) for TL response.
15. Return created incident object to citizen.

**DB Operations:**
- `sos_attempts` INSERT
- `incidents` INSERT
- `incidents` UPDATE (org match, tl_notified_at)
- `notifications` INSERT
- `incident_logs` INSERT (trigger on status change)

**Error Cases:**
- No GPS provided → `400 Bad Request`
- Active incident exists → `409 Conflict`
- No organization covers citizen GPS → incident created, super admin notified, status `escalated`
- TL has no FCM token → log warning, proceed (escalation timer still starts)

**Security:**
- JWT required, `role = 'citizen'` enforced.
- `is_suspended = true` → `403 Forbidden`.

---

### 2.6 Jurisdiction Matching Logic

**Query:**
```sql
SELECT id, name, backup_tl_id,
  ST_Distance(base_location, ST_MakePoint(:lng, :lat)::geography) AS dist_m
FROM organizations
WHERE is_active = true
  AND deleted_at IS NULL
  AND ST_DWithin(base_location, ST_MakePoint(:lng, :lat)::geography, coverage_radius_km * 1000)
ORDER BY coverage_radius_km ASC, dist_m ASC
LIMIT 1;
```

**Priority Rules:**
1. Smallest coverage radius match first (most specific jurisdiction).
2. If tie on radius, nearest base distance wins.

**Result:**
- One organization returned → use it.
- Zero organizations returned → no jurisdiction coverage → escalate to Super Admin.

---

### 2.7 SOS Rate Limiting Guard

**Purpose:** Prevent excessive repeated SOS dispatches within a short window. This is a dispatch-level guard — separate from the strike/abuse system which tracks cancellations.

**Rule:** A citizen may not dispatch more than **3 live (non-cancelled) SOS alerts within a rolling 10-minute window**.

**Check (applied inside POST /incidents before creating the incident):**
```sql
SELECT COUNT(*) FROM sos_attempts
WHERE citizen_id = :caller_id
  AND was_cancelled = false
  AND created_at > now() - interval '10 minutes';
```

**Logic:**
1. Run the rate-limit query.
2. If count ≥ 3: return `429 Too Many Requests` with message "Too many emergency alerts. Please wait before sending another."
3. Do NOT write an `sos_attempts` row for blocked requests.
4. Do NOT increment abuse strikes for rate-limited requests (this is a system guard, not a punitive action).

**Error Cases:**
- Rate limit exceeded → `429 Too Many Requests`

**Note:** The 10-minute window and 3-alert threshold are configurable. In production, tune based on real data before enforcing auto-suspend.

---

## 3. Escalation Engine

### 3.1 Overview

The escalation engine runs as a server-side timer process (Supabase Edge Function or pg_cron job) that polls for unacknowledged incidents.

```
TL notified
    → 10s timer starts
    → If TL does not acknowledge: escalate to backup TL
        → 10s timer starts
        → If backup TL does not acknowledge: notify nearest on-duty responder directly
            → If no on-duty responders: notify Super Admin
```

---

### 3.2 Escalation Check (Runs Every 5 Seconds)

**Logic:**
1. Query for incidents where:
   - `status = 'pending'`
   - `tl_notified_at IS NOT NULL`
   - `tl_assigned_at IS NULL`
   - `now() - tl_notified_at > interval '10 seconds'`
   - No `escalation_events` row exists yet for this incident at level 1.
2. For each found incident: fire Level 1 Escalation.

---

### 3.3 Level 1 Escalation — Primary TL → Backup TL

**Trigger:** Primary TL did not acknowledge within 10 seconds.

**Step-by-step Logic:**
1. Read `organization_id` from incident.
2. Read `backup_tl_id` from `organizations` row.
3. If `backup_tl_id` is NULL → skip to Level 2 immediately.
4. If backup TL exists:
   - Send FCM push notification to backup TL (type: `escalation`).
   - Write `notifications` row.
   - Write `escalation_events` row: `escalation_level = 1`, `from_user_id = primary TL id`, `to_user_id = backup TL id`, `reason = 'timeout'`.
   - Update `incidents.escalated_at = now()` (first escalation only).
   - Update `incidents.status = 'escalated'`.
   - Append `incident_logs`: `new_status = 'escalated'`, `metadata = { escalation_level: 1 }`.
5. Start 10-second timer for backup TL.

---

### 3.4 Level 2 Escalation — Backup TL → Nearest On-Duty Responder

**Trigger:** Backup TL did not acknowledge within 10 seconds (or backup TL does not exist).

**Step-by-step Logic:**
1. Query nearest on-duty responders in the organization:
   ```sql
   SELECT id, full_name, last_known_lat, last_known_lng, fcm_token
   FROM profiles
   WHERE organization_id = :org_id
     AND role = 'responder'
     AND is_on_duty = true
     AND is_suspended = false
     AND deleted_at IS NULL
     AND last_known_lat IS NOT NULL
   ORDER BY
     point(last_known_lng, last_known_lat) <-> point(:citizen_lng, :citizen_lat)
   LIMIT 3;
   ```
2. If no on-duty responders found:
   - Notify Super Admin (type: `escalation`, body: "No responders available").
   - Write `notifications` row.
   - Write `escalation_events` row: `escalation_level = 2`, `to_user_id = NULL`, `reason = 'no_responders_available'`.
   - Log to `incident_logs`.
   - Exit.
3. If responders found:
   - Notify top 3 nearest responders via FCM (type: `assignment`).
   - Write `notifications` rows for each.
   - Write `escalation_events` row: `escalation_level = 2`, `to_user_id = nearest responder id`, `reason = 'timeout'`.
   - Append `incident_logs`.

**Note:** In Level 2 direct-to-responder scenario, the first responder to accept claim the incident. Others' notifications become stale (no action needed from the unclaiming responders).

---

### 3.5 Escalation Edge Cases

| Scenario | Handling |
|---|---|
| No backup TL configured on org | Skip Level 1, go directly to Level 2 |
| No on-duty responders in org | Notify Super Admin, log as `no_responders_available` |
| Primary TL acknowledges during escalation window | Escalation timer cancels — `tl_assigned_at` being set stops escalation checks |
| Incident already assigned before escalation fires | Escalation check skips (status check: `tl_assigned_at IS NULL`) |

---

## 4. Team Leader Incident Management

### 4.1 Receive Alert & Acknowledge (PATCH /incidents/:id/acknowledge)

**Mechanism:** FCM push notification arrives on TL device. Supabase Realtime also delivers the new incident row in real-time to the TL dashboard.

**Actors:** Team Leader (authenticated)

**Validations:**
- Role must be `team_leader`.
- Incident must belong to TL's organization.
- Incident `status` must be `pending` or `escalated` (TL can acknowledge even after escalation fired, as long as no responder has been assigned).

**On notification tap / manual open:**
1. App opens incident detail view.
2. Call `PATCH /incidents/:id/acknowledge`.
3. Update `incidents`:
   - `status = 'acknowledged'`
   - `tl_assigned_at = now()` (signals TL is actively working it)
   - `assigned_tl_id = auth.uid()` (records which TL owns this incident)
4. `incident_logs` row written by trigger.
5. This acknowledgment **cancels the escalation timer** — escalation checks skip incidents where `tl_assigned_at IS NOT NULL`.
6. Return updated incident.

**TL Ownership Rule:**
- The **first TL to acknowledge** owns the incident (`assigned_tl_id` is set once and not overwritten).
- If a backup TL acknowledges during escalation, they become the owner.
- If multiple TLs see the same alert (e.g., via broadcast or admin override), only the first to call this endpoint claims ownership. Subsequent calls receive `409 Conflict` with message "Incident already acknowledged by another team leader."

**DB Operations:** `incidents` UPDATE, `incident_logs` INSERT (trigger)

**Error Cases:**
- Incident not in TL's org → `403 Forbidden`
- Incident already acknowledged by another TL → `409 Conflict`
- Incident already past `acknowledged` state → `400 Bad Request`

---

### 4.2 View Incident Detail

**Purpose:** TL reads full incident info including citizen GPS.

**Actors:** Team Leader (authenticated)

**Returns:**
- Incident fields (status, type, priority, location, timestamps)
- Citizen reverse-geocoded address
- Current incident status
- Escalation history (from `escalation_events`)

**Security:** TL can only view incidents where `incidents.organization_id = profiles.organization_id`.

---

### 4.3 Responder Suggestion Logic

**Purpose:** Present TL with a ranked list of suitable responders to assign.

**Step-by-step Logic:**
1. Query on-duty responders in the same organization:
   ```sql
   SELECT id, full_name, last_known_lat, last_known_lng, last_seen_at
   FROM profiles
   WHERE organization_id = :tl_org_id
     AND role = 'responder'
     AND is_on_duty = true
     AND is_suspended = false
     AND deleted_at IS NULL
     AND last_known_lat IS NOT NULL
   ORDER BY
     point(last_known_lng, last_known_lat) <-> point(:citizen_lng, :citizen_lat)
   LIMIT 5;
   ```
2. Return ranked list with distance from citizen in kilometers.
3. TL selects one responder from the list.

**Error Cases:**
- No on-duty responders → Return empty list with message "No on-duty responders available."

---

### 4.4 Assign Responder (PATCH /incidents/:id/assign)

**Purpose:** TL assigns a specific responder to the incident.

**Actors:** Team Leader (authenticated)

**Inputs:**
- `responder_id` (uuid, required)

**Validations:**
- JWT role must be `team_leader`.
- Incident must belong to TL's organization AND `assigned_tl_id = auth.uid()` (only the owning TL can assign).
- Incident `status` must be `acknowledged` (TL must have acknowledged the incident before assigning).
- `responder_id` must belong to same organization, have `role = 'responder'`, `is_on_duty = true`, `is_suspended = false`.
- Responder must not already be assigned to another active incident (`status NOT IN ('resolved', 'closed')`).

**Step-by-step Logic:**
1. Validate all inputs and conditions.
2. Update `incidents`:
   - `assigned_responder_id = responder_id`
   - `responder_assigned_at = now()`
   - `status = 'assigned'` (status advances from `acknowledged` to `assigned` at this point)
3. `incident_logs` row written by trigger (status change: `acknowledged` → `assigned`).
4. Send FCM push notification to responder (type: `assignment`).
5. Write `notifications` row for responder.
6. Return updated incident.

**DB Operations:** `incidents` UPDATE, `notifications` INSERT, `incident_logs` INSERT (trigger)

**Error Cases:**
- Incident not yet acknowledged → `400 Bad Request` with "Acknowledge the incident before assigning a responder."
- Caller is not the owning TL → `403 Forbidden`
- Responder already assigned to another active incident → `409 Conflict`
- Responder not on duty → `400 Bad Request`
- Responder not in same org → `403 Forbidden`

---

### 4.5 Reassign Responder (PATCH /incidents/:id/reassign)

**Purpose:** TL replaces the currently assigned responder with a different one. Used when the original responder declines or becomes unavailable.

**Actors:** Team Leader (authenticated)

**Inputs:**
- `responder_id` (uuid, required — the new responder)

**Validations:**
- JWT role must be `team_leader`.
- `assigned_tl_id` on incident must equal `auth.uid()`.
- Incident `status` must be `assigned` (TL assigned but responder has not yet accepted). Reassignment is not permitted after `accepted`.
- New `responder_id` must belong to same org, `is_on_duty = true`, `is_suspended = false`.
- New responder must not already be assigned to another active incident.
- New `responder_id` must not equal the current `assigned_responder_id`.

**Step-by-step Logic:**
1. Validate all conditions.
2. Read current `assigned_responder_id` (old responder).
3. Update `incidents`:
   - `assigned_responder_id = new responder_id`
   - `responder_assigned_at = now()` (reset to new assignment time)
   - `status` remains `assigned`
4. Send FCM push to **old responder** (type: `status_update`, body: "Your assignment has been cancelled.").
5. Write `notifications` row for old responder.
6. Send FCM push to **new responder** (type: `assignment`, standard payload).
7. Write `notifications` row for new responder.
8. Append `incident_logs` row: `new_status = 'assigned'`, `notes = 'Responder reassigned'`, `metadata = { old_responder_id, new_responder_id }`.
9. Return updated incident.

**DB Operations:** `incidents` UPDATE, `notifications` INSERT (×2), `incident_logs` INSERT

**Error Cases:**
- Incident already accepted → `400 Bad Request` with "Cannot reassign after responder has accepted."
- New responder is the same as current → `400 Bad Request`
- New responder not available or not in org → `400 Bad Request` / `403 Forbidden`

---

## 5. Responder Assignment & Status Flow

### 5.1 Receive Assignment

**Mechanism:** FCM push notification + Supabase Realtime delivers updated incident row.

**On notification tap:**
1. App navigates to assignment detail screen.
2. Call `GET /incidents/:id` — returns incident with citizen GPS for navigation.

---

### 5.2 Accept Assignment (PATCH /incidents/:id/accept)

**Actors:** Responder (authenticated)

**Two Scenarios:**

**Scenario A — Standard Assignment (TL assigned a specific responder):**
- `incidents.assigned_responder_id` already equals the calling responder's ID.
- Normal accept flow applies.

**Scenario B — Level 2 Escalation (top 3 responders notified simultaneously):**
- `incidents.assigned_responder_id` is NULL (no TL assigned anyone — multiple responders were notified).
- First to call this endpoint claims the incident.
- Race-condition protection: use an **atomic conditional update**.

**Validations:**
- Role must be `responder`.
- Responder must belong to the same `organization_id` as the incident.
- Current incident `status` must be `assigned` (Scenario A) OR `escalated` (Scenario B).
- For Scenario A: `assigned_responder_id` must equal `auth.uid()`.

**Step-by-step Logic:**
1. Validate role and org membership.
2. Determine scenario based on `incidents.assigned_responder_id`:
   - **Scenario A:** Validate `assigned_responder_id = auth.uid()`. Validate `status = 'assigned'`.
   - **Scenario B:** Validate `status = 'escalated'` and `assigned_responder_id IS NULL`.
3. Execute **atomic conditional UPDATE** (prevents race condition):
   ```sql
   UPDATE incidents
   SET assigned_responder_id = :caller_id,
       status = 'accepted',
       accepted_at = now()
   WHERE id = :incident_id
     AND (
       (status = 'assigned' AND assigned_responder_id = :caller_id)  -- Scenario A
       OR
       (status = 'escalated' AND assigned_responder_id IS NULL)       -- Scenario B
     );
   ```
4. Check rows affected:
   - If **0 rows affected** → incident was already claimed by another responder → `409 Conflict` with "Incident already claimed by another responder."
5. DB trigger `trg_incident_response_time` computes `response_time_seconds = EXTRACT(EPOCH FROM (accepted_at - created_at))::int`.
6. `incident_logs` row written by trigger.
7. Send FCM push notification to citizen (type: `status_update`, body: "A responder has accepted your emergency.").
8. Send FCM push notification to TL (type: `status_update`, body: "Responder has accepted the assignment.").
9. Write `notifications` rows.
10. Return updated incident.

**DB Operations:** `incidents` UPDATE (conditional), `notifications` INSERT, `incident_logs` INSERT (trigger)

**Error Cases:**
- Already claimed (race condition) → `409 Conflict`
- Not in same org as incident → `403 Forbidden`
- Incident in wrong status → `400 Bad Request`

---

### 5.3 Status Update Sequence

**Full incident lifecycle (all actors):**
```
pending → acknowledged → assigned → accepted → en_route → arrived → resolved → closed
```

- `pending → acknowledged`: TL acknowledges (PATCH /incidents/:id/acknowledge)
- `acknowledged → assigned`: TL assigns responder (PATCH /incidents/:id/assign)
- `assigned → accepted`: Responder accepts (PATCH /incidents/:id/accept)
- `accepted → en_route → arrived → resolved`: Responder updates (PATCH /incidents/:id/status)
- `resolved → closed`: TL or Super Admin closes (PATCH /incidents/:id/close)

**Responder-controlled transitions only:**
```
accepted → en_route → arrived → resolved
```

Responder may only move forward in the sequence. No backward transitions.

| Transition | Timestamp Set | Notification Sent To |
|---|---|---|
| `accepted` | `accepted_at` | Citizen, TL |
| `en_route` | `en_route_at` | Citizen, TL |
| `arrived` | `arrived_at` | Citizen, TL |
| `resolved` | `resolved_at` | Citizen, TL |

**Validations for each transition:**
- Role must be `responder`.
- `assigned_responder_id` must match caller.
- Status must be exactly one step behind the requested status.

**Resolution Requirement:**
- `resolved` status requires `notes` (non-empty string). Responder must submit a resolution note.

---

### 5.4 PATCH /incidents/:id/status — Shared Endpoint

**Purpose:** Single endpoint for all responder status updates.

**Actors:** Responder

**Inputs:**
- `status` (enum, required)
- `notes` (string, required only when `status = 'resolved'`)

**Step-by-step Logic:**
1. Validate role and ownership.
2. Validate status transition is valid (forward only).
3. Validate `notes` present if resolving.
4. Update `incidents.status` and corresponding timestamp.
5. DB trigger writes `incident_logs` row.
6. Send push notifications to citizen and TL.
7. Write `notifications` rows.
8. Return updated incident.

**Error Cases:**
- Invalid status transition → `400 Bad Request` with message "Invalid status transition."
- Missing `notes` on resolve → `400 Bad Request`
- Not the assigned responder → `403 Forbidden`

---

### 5.5 Decline Assignment (PATCH /incidents/:id/decline)

**Purpose:** Responder explicitly declines an assigned incident. TL is notified to reassign. This returns the incident to `acknowledged` state so the TL can select a different responder.

**Actors:** Responder (authenticated)

**Inputs:**
- `reason` (string, optional — responder's reason for declining)

**Validations:**
- Role must be `responder`.
- `incidents.assigned_responder_id` must equal `auth.uid()`.
- Incident `status` must be `assigned` (can only decline before accepting — after accept, use resolution flow).

**Step-by-step Logic:**
1. Validate role and ownership.
2. Update `incidents`:
   - `assigned_responder_id = NULL`
   - `responder_assigned_at = NULL`
   - `status = 'acknowledged'` (returns to TL's control for reassignment)
3. Append `incident_logs` row: `old_status = 'assigned'`, `new_status = 'acknowledged'`, `notes = 'Responder declined'`, `metadata = { declined_by: responder_id, reason }`.
4. Send FCM push notification to owning TL (`assigned_tl_id`) — type: `status_update`, body: "Responder [name] has declined the assignment. Please assign another responder."
5. Write `notifications` row for TL.
6. Return updated incident.

**DB Operations:** `incidents` UPDATE, `incident_logs` INSERT, `notifications` INSERT

**Error Cases:**
- Responder is not the assigned responder → `403 Forbidden`
- Incident status is not `assigned` (e.g. already accepted) → `400 Bad Request` with "Cannot decline after accepting an assignment."

**Note:** After a decline, the TL sees the incident revert to `acknowledged` status and must use PATCH /incidents/:id/assign to select a new responder.

---

## 6. Incident Closure & Archiving

### 6.1 Close Incident (PATCH /incidents/:id/close)

**Purpose:** Mark an incident as fully closed after resolution.

**Actors:** Team Leader or Super Admin

**Validations:**
- Role must be `team_leader` or `super_admin`.
- Incident `status` must be `resolved`.
- TL can only close incidents in their organization.

**Step-by-step Logic:**
1. Validate.
2. Update `incidents`:
   - `status = 'closed'`
   - `closed_at = now()`
   - `closed_by = auth.uid()`
3. `incident_logs` written by trigger.
4. Send FCM push to citizen (type: `status_update`, body: "Your incident has been closed.").
5. Write `notifications` row for citizen.
6. Return updated incident.

---

### 6.2 Archive Incident (PATCH /incidents/:id/archive)

**Purpose:** Move a closed incident to archived state for long-term legal preservation.

**Actors:** Super Admin only

**Validations:**
- Role must be `super_admin`.
- Incident `status` must be `closed`.
- `archived_at` must be NULL (cannot re-archive).

**Step-by-step Logic:**
1. Validate.
2. Update `incidents.archived_at = now()`.
3. No push notification sent (administrative action).
4. Log to `incident_logs`.

**Note:** Archived incidents remain in the database permanently. They are excluded from active dashboards by filtering `WHERE archived_at IS NULL`.

---

## 7. Real-time Location Tracking

### 7.1 Responder Location Push (POST /responder-locations)

**Purpose:** Responder's device continuously pushes GPS position while on duty.

**Actors:** Responder (authenticated)

**Inputs:**
- `lat` (numeric, required)
- `lng` (numeric, required)
- `accuracy_m` (numeric, optional)

**Validations:**
- Role must be `responder`.
- `is_on_duty` must be `true`.
- Validate lat/lng ranges.

**Step-by-step Logic:**
1. Validate.
2. Insert into `responder_locations`.
3. DB trigger `trg_mirror_responder_location` fires:
   - Updates `profiles.last_known_lat/lng/last_location_updated_at` for this responder.
4. Return `200 OK`.

**Push Frequency:** Client pushes every 5–10 seconds while on duty and while an active incident is assigned. When off duty, stop pushing.

**DB Operations:** `responder_locations` INSERT → `profiles` UPDATE (trigger)

---

### 7.2 Duty Toggle (PATCH /profile/duty)

**Purpose:** Responder goes on or off duty.

**Actors:** Responder (authenticated)

**Inputs:**
- `is_on_duty` (boolean, required)

**Step-by-step Logic:**
1. Validate role is `responder`.
2. If going off duty: check for active assigned incident. If one exists → `409 Conflict` with message "Cannot go off duty with an active incident."
3. Update `profiles.is_on_duty`.
4. If going off duty: stop location tracking on client side.
5. Return updated profile.

---

### 7.3 TL Real-time Responder Map

**Mechanism:** Supabase Realtime subscription on `profiles` table filtered by `organization_id`.

**TL subscribes to:**
```
profiles WHERE organization_id = :tl_org_id AND role = 'responder'
```

**On change:** TL map view updates responder pin positions in real-time.

---

## 8. Push Notification System

### 8.1 Notification Dispatch Logic

All push notifications follow this flow:

1. Resolve recipient's `fcm_token` from `profiles`.
2. If `fcm_token` is NULL → log warning, skip FCM send, still write `notifications` row with `delivery_status = 'failed'`, `failed_reason = 'no_fcm_token'`.
3. Call Firebase Cloud Messaging HTTP v1 API with token + payload.
4. On FCM success: write `notifications` row with `delivery_status = 'sent'`.
5. On FCM failure: write `notifications` row with `delivery_status = 'failed'`, `failed_reason = FCM error message`.

### 8.2 Notification Payload Templates

**incident_alert (to TL):**
```
title: "New Emergency Alert"
body: "[Crime/Medical] emergency near [citizen_address or GPS coords]"
data: { incident_id, incident_code, emergency_type, citizen_lat, citizen_lng }
```

**assignment (to Responder):**
```
title: "You Have Been Assigned"
body: "Report to [citizen_address] for a [Crime/Medical] emergency."
data: { incident_id, incident_code, emergency_type, citizen_lat, citizen_lng }
```

**escalation (to Backup TL or Responder):**
```
title: "Escalated Emergency — Action Required"
body: "Unacknowledged [Crime/Medical] alert has been escalated to you."
data: { incident_id, incident_code, escalation_level }
```

**status_update (to Citizen or TL):**
```
title: "Incident Update"
body: "[Dynamic message based on status]"
data: { incident_id, incident_code, new_status }
```

### 8.3 Delivery Status Tracking

FCM delivery receipts are received via webhook (if configured) or inferred:
- On FCM API success response: `delivery_status = 'sent'`
- On FCM delivery receipt callback: `delivery_status = 'delivered'`, `delivered_at = now()`
- On user tapping notification: client calls `PATCH /notifications/:id/read` → `delivery_status = 'read'`, `read_at = now()`
- On FCM API error: `delivery_status = 'failed'`, `failed_reason = error`

### 8.4 Mark Notification Read (PATCH /notifications/:id/read)

**Actors:** Any authenticated user (own notifications only)

**Logic:**
1. Validate notification belongs to caller.
2. Update `delivery_status = 'read'`, `read_at = now()`.

---

## 9. Real-time Subscriptions

All real-time data delivery uses Supabase Realtime channel subscriptions. Clients subscribe on login and unsubscribe on logout.

### 9.1 Citizen — Active Incident Tracker

**Channel:** `incidents:citizen_id=eq.:uid`

**Subscribes to:** Changes on `incidents` where `citizen_id = auth.uid()`

**Events listened:** `UPDATE`

**Client action on event:** Refresh incident status display, show status change notification in-app.

---

### 9.2 Team Leader — Incident Feed

**Channel:** `incidents:organization_id=eq.:org_id`

**Subscribes to:** INSERT and UPDATE on `incidents` where `organization_id = tl.organization_id`

**Events listened:** `INSERT` (new alert), `UPDATE` (status change)

**Client action on event:**
- INSERT: show new alert banner, play alert sound, add to feed.
- UPDATE: refresh incident card in feed.

---

### 9.3 Responder — Assignment Updates

**Channel:** `incidents:assigned_responder_id=eq.:uid`

**Subscribes to:** UPDATE on `incidents` where `assigned_responder_id = auth.uid()`

**Events listened:** `UPDATE`

**Client action on event:** Refresh assignment screen with new status.

---

### 9.4 Admin — Global Incident Feed

**Channel:** `incidents:all`

**Subscribes to:** INSERT and UPDATE on all `incidents`

**Access:** Super Admin role only (enforced server-side by RLS).

---

## 10. Admin Module

### 10.1 Create Organization (POST /admin/organizations)

**Actors:** Super Admin

**Inputs:**
- `name` (string, required)
- `type` (enum: police | medical | fire | rescue, required)
- `base_lat` (numeric, required)
- `base_lng` (numeric, required)
- `coverage_radius_km` (numeric, required, > 0)

**Validations:**
- Role must be `super_admin`.
- `coverage_radius_km` must be positive.
- `base_lat/lng` must be valid.

**Logic:**
1. Validate.
2. Insert `organizations` row.
3. PostGIS `base_location` column is auto-generated from `base_lat/lng`.
4. Return created organization.

---

### 10.2 Update Organization (PATCH /admin/organizations/:id)

**Actors:** Super Admin

**Updatable Fields:** `name`, `type`, `base_lat`, `base_lng`, `coverage_radius_km`, `backup_tl_id`, `is_active`

**Validations:**
- `backup_tl_id` must reference a user with `role = 'team_leader'` and `organization_id = this org`.
- Cannot update `deleted_at` via this endpoint.

---

### 10.3 Assign User to Organization (PATCH /admin/users/:id/assign-org)

**Purpose:** Assign a TL or responder to an organization, and optionally set TL priority.

**Actors:** Super Admin

**Inputs:**
- `organization_id` (uuid, required)
- `role` (enum, required)
- `tl_priority` (int, optional — 1 or 2, only for team_leader role)

**Validations:**
- Target user must exist and not be deleted.
- `tl_priority` only accepted if `role = 'team_leader'`.
- If `tl_priority = 1`: check no other user in org already has `tl_priority = 1`. If collision → `409 Conflict`.

**Logic:**
1. Update `profiles.organization_id`, `profiles.role`, `profiles.tl_priority`.

---

### 10.4 Suspend / Unsuspend User (PATCH /admin/users/:id/suspend)

**Actors:** Super Admin

**Inputs:**
- `is_suspended` (boolean, required)

**Logic:**
1. Validate role is `super_admin`.
2. Update `profiles.is_suspended`.
3. If suspending a responder with an active incident: do not block the suspend, but flag in response.

---

### 10.5 View Incident Logs (GET /admin/incidents)

**Actors:** Super Admin, Team Leader (own org only)

**Query Filters (optional):**
- `status` (enum)
- `emergency_type`
- `organization_id`
- `date_from`, `date_to`
- `priority_level`
- `source`

**Returns:** Paginated list of incidents with `incident_logs` embedded.

---

### 10.6 KPI Summary (GET /admin/kpi)

**Actors:** Super Admin

**Returns:**
- Average `response_time_seconds` by org and emergency type
- Total incidents by status
- Escalation rate (incidents with `escalated_at IS NOT NULL` / total)
- False alarm rate (`sos_attempts.was_cancelled = true` / total attempts)
- Notification delivery failure rate

---

## 11. Abuse Prevention & Strike System

### 11.1 Strike Increment Rules

A citizen's `abuse_strike_count` is incremented when:

| Condition | Strike Added |
|---|---|
| SOS cancelled during countdown (3rd+ cancel in 24 hours) | +1 |
| Incident created but closed as false alarm by admin | +1 |
| Incident created but citizen immediately resolved with no responder action | +1 (pending admin review) |

Cancellations 1 and 2 within 24 hours are logged but do not increment strikes (grace period for genuine mistakes).

### 11.2 Strike Threshold Actions

| Strike Count | Action |
|---|---|
| 1–2 | Warning logged, no restriction |
| 3 | In-app warning shown to citizen |
| 5 | Auto-suspend: `is_suspended = true`. Citizen cannot send SOS. |
| Admin reset | `abuse_strike_count = 0`, `is_suspended = false` |

### 11.3 Strike Increment Logic (POST /incidents — guard check)

**On SOS cancel:**
1. Count citizen's `sos_attempts` with `was_cancelled = true` in the last 24 hours.
2. If count ≥ 3: increment `profiles.abuse_strike_count += 1`.
3. Check threshold table and apply action.

### 11.4 Admin Strike Reset (PATCH /admin/users/:id/reset-strikes)

**Actors:** Super Admin

**Logic:**
1. Set `profiles.abuse_strike_count = 0`.
2. Set `profiles.is_suspended = false`.

---

## 12. Scheduled Cleanup Jobs

Implemented as Supabase pg_cron jobs or Edge Functions on a schedule.

### 12.1 Responder Location Cleanup

**Schedule:** Daily at 02:00 UTC

**Logic:**
```sql
DELETE FROM responder_locations
WHERE created_at < now() - interval '90 days';
```

---

### 12.2 Notification Cleanup

**Schedule:** Daily at 02:30 UTC

**Logic:**
```sql
DELETE FROM notifications
WHERE sent_at < now() - interval '30 days';
```

---

### 12.3 Incident Daily Sequence Reset

**Schedule:** Daily at 00:00 UTC

**Logic:**
```sql
ALTER SEQUENCE incident_daily_seq RESTART WITH 1;
```

**Purpose:** Resets the daily counter so `incident_code` numbers restart at 0001 each day (e.g. `INC-20260416-0001`).

---

## End-to-End Flow Reference

### Happy Path — Full Dispatch

```
1.  Citizen holds SOS 2s
2.  Selects "Medical"
3.  3-second countdown completes
4.  POST /incidents
      → Rate limit check (≤3 dispatches per 10 min)
      → sos_attempts INSERT
      → incidents INSERT (status: pending)
      → PostGIS jurisdiction match
      → incidents UPDATE (organization_id set)
      → TL notified via FCM
      → incidents UPDATE (tl_notified_at set)
      → Escalation timer starts (10s)
5.  TL opens alert → PATCH /incidents/:id/acknowledge
      → incidents UPDATE (status: acknowledged, tl_assigned_at, assigned_tl_id)
      → Escalation timer cancelled
6.  TL selects responder from suggestion list
7.  PATCH /incidents/:id/assign (responder_id)
      → incidents UPDATE (status: assigned, assigned_responder_id, responder_assigned_at)
      → Responder notified via FCM
8.  Responder accepts → PATCH /incidents/:id/accept
      → Atomic conditional UPDATE (race-safe)
      → incidents UPDATE (status: accepted, accepted_at, response_time_seconds computed)
      → Citizen notified, TL notified
9.  Responder goes en route
      → PATCH /incidents/:id/status (status: en_route)
10. Responder arrives
      → PATCH /incidents/:id/status (status: arrived)
11. Responder resolves with notes
      → PATCH /incidents/:id/status (status: resolved, notes: "...")
12. TL closes incident
      → PATCH /incidents/:id/close
      → incidents UPDATE (status: closed, closed_at, closed_by)
      → Citizen notified "Incident closed"
```

### Responder Decline & Reassign Path

```
7.  PATCH /incidents/:id/assign (responder_id: A)
      → incidents UPDATE (status: assigned, assigned_responder_id: A)
      → Responder A notified via FCM
8a. Responder A declines → PATCH /incidents/:id/decline
      → incidents UPDATE (status: acknowledged, assigned_responder_id: NULL)
      → TL notified "Responder declined"
8b. TL selects a different responder
      → PATCH /incidents/:id/assign (responder_id: B)
      → incidents UPDATE (status: assigned, assigned_responder_id: B)
      → Responder B notified via FCM
9.  Continue from Step 8 in Happy Path (Responder B accepts)
```

### TL Reassignment Path (Before Accept)

```
7.  PATCH /incidents/:id/assign (responder_id: A)
8.  TL changes mind → PATCH /incidents/:id/reassign (responder_id: B)
      → incidents UPDATE (assigned_responder_id: B, responder_assigned_at reset)
      → Responder A notified "Assignment cancelled"
      → Responder B notified via FCM (new assignment)
9.  Continue from Step 8 in Happy Path (Responder B accepts)
```

### Escalation Path

```
4.  TL notified (tl_notified_at set)
5.  10 seconds pass — TL does not acknowledge
6.  Escalation Engine detects timeout
      → FCM sent to backup TL
      → escalation_events INSERT (level: 1)
      → incidents UPDATE (status: escalated, escalated_at)
      → incident_logs INSERT (trigger)
7.  10 seconds pass — backup TL does not acknowledge
8.  Escalation Engine fires Level 2
      → Nearest 3 on-duty responders found
      → FCM sent to each (assigned_responder_id still NULL)
      → escalation_events INSERT (level: 2)
9.  First responder calls PATCH /incidents/:id/accept
      → Atomic conditional UPDATE claims incident (assigned_responder_id IS NULL check)
      → incidents UPDATE (assigned_responder_id: first responder, status: accepted)
      → Other 2 responders' notifications become stale — if they call accept → 409 Conflict
      → Continue from Step 9 in Happy Path
```
