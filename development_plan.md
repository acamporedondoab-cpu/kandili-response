# Development Plan — Guardian Dispatch Platform

**Version:** 2.0 (Sprint-Based Restructure)  
**Last Updated:** 2026-04-15  
**Previous Version:** 1.0 (12-Phase Enterprise Rollout)  
**Reference Docs:** `project_specs.md`, `database_schema.md`, `api_logic.md`  
**Stack:** React Native/Expo · Next.js 14 · Supabase · Firebase Cloud Messaging · Google Maps API · TypeScript

---

## Strategy: MVP-First Vertical Slice

The original 12-phase plan was sequentially correct but enterprise-heavy. This restructured plan collapses the same scope into **3 sprints** optimized for a solo founder or small team building toward a working prototype as fast as possible.

### Core Principle
> Build the **full dispatch chain end-to-end first**, then layer in automation, UX polish, and production hardening afterward.

The full dispatch chain is the vertical slice:
```
Citizen SOS → Jurisdiction Match → TL Acknowledge → Assign Responder
→ Responder Accept → Status Updates → Resolve → Close
```

Everything in **Sprint 1** exists to make this chain work, nothing more.

### What Does NOT Change
- Database schema (same — all tables, triggers, RLS from Phase 0 are still built in Sprint 1)
- API logic (same — all endpoints defined in `api_logic.md` are still implemented)
- Scalability considerations (PostGIS, atomic updates, Realtime subscriptions — all preserved)
- Security model (RLS is enabled from day one — not deferred to Sprint 3)
- Audit trail requirements (incident_logs, sos_attempts — built in Sprint 1)

---

## Sprint Summary

| Sprint | Name | Original Phases Covered | Priority |
|---|---|---|---|
| Sprint 1 | Core Functional MVP | Phase 0, 1, 2, 3, 4 (core), 5 (core), 6 (core), 9 (basic) | Ship this first |
| Sprint 2 | Stability, Automation & UX | Phase 4 (full), 5 (advanced), 6 (advanced), 7, 8, 9 (full), 10 | Layer this second |
| Sprint 3 | Hardening, Security & Deployment | Phase 10 (KPI), 11, 12 | Production-ready |

---

## Sprint 1 — Core Functional MVP

### Objective
Build a working vertical slice of the complete emergency dispatch chain. By the end of Sprint 1, a real person can trigger an SOS, a TL can acknowledge and assign a responder, the responder can navigate and resolve, and a TL can close the incident. Every step is logged, every push notification fires, and the full audit trail is preserved.

**This sprint = prototype that can be demoed to stakeholders.**

---

### Features Included

#### 1A — Foundation & Infrastructure
- Supabase project created (dev environment)
- Extensions: `uuid-ossp`, `postgis`, `pg_cron` (pg_cron enabled now — jobs scheduled in Sprint 3)
- All enums created (including `acknowledged` in `incident_status`)
- All 8 tables created with correct columns, constraints, and indexes
- All 8 DB triggers implemented and verified:
  - `trg_profiles_updated_at`
  - `trg_organizations_updated_at`
  - `trg_incidents_updated_at`
  - `trg_profiles_auto_create` (auth.users → profiles)
  - `trg_mirror_responder_location`
  - `trg_incident_code_generate`
  - `trg_incident_response_time`
  - `trg_incident_log_on_status`
- RLS **enabled** on all tables — policies written and verified (not deferred)
- SQL migration files created in `/supabase/`:
  - `001_extensions.sql`
  - `002_enums.sql`
  - `003_tables.sql`
  - `004_indexes.sql`
  - `005_triggers.sql`
  - `006_rls.sql`
  - `007_cron.sql` (jobs registered but cleanup jobs scheduled in Sprint 3)
- Next.js 14 project initialized (`/app`) — TypeScript, Tailwind CSS, Supabase client
- Expo project initialized (`/mobile`) — TypeScript, NativeWind, Supabase client
- Firebase project created — Admin SDK credentials stored server-side only
- Google Maps API key configured with correct restrictions

#### 1B — Authentication (All Roles)
- Supabase Auth phone OTP enabled
- `trg_profiles_auto_create` verified (auto-creates profile row on user signup)
- **Mobile (Expo):** Registration screen, OTP verification, Login screen, JWT stored in SecureStore, role-based navigation guard, suspended account handling
- **Web (Next.js):** Login page (phone + OTP), role-based redirect (TL → TL dashboard, super_admin → admin panel), auth middleware protecting all routes
- `PATCH /profile/fcm-token` endpoint (FCM token upsert on login)
- `last_seen_at` heartbeat update on every authenticated request
- RLS verified for `profiles` (own row access by default)

#### 1C — Super Admin Bootstrap (Minimal)
- `POST /admin/organizations` — create organization (name, type, base lat/lng, coverage radius)
- `PATCH /admin/organizations/:id` — update org settings
- `PATCH /admin/users/:id/assign-org` — assign user to org, set role and TL priority
- `PATCH /admin/users/:id/suspend` — suspend / unsuspend user
- `GET /admin/users` — list users with filters
- **Web (Next.js — Admin Panel):**
  - Organizations list + create/edit form
  - Map preview of jurisdiction radius (Google Maps circle overlay)
  - Users list + assign to org form (role, TL priority, backup TL designation)
- Seeding: at least one organization, one primary TL, one backup TL, and two responders before Sprint 1 dispatch testing

#### 1D — Core Citizen SOS Flow
- `POST /incidents` (core dispatch logic):
  - SOS rate limit guard (max 3 dispatches per 10 min — returns 429)
  - Input validation (GPS range, emergency type enum)
  - Active incident check (409 if citizen already has open incident)
  - `sos_attempts` INSERT
  - `incidents` INSERT → trigger generates `incident_code`
  - Async reverse geocode (lat/lng → `citizen_address`)
  - PostGIS jurisdiction match query
  - No-jurisdiction fallback (status = `escalated`, Super Admin notified)
  - Primary TL lookup + FCM push + `tl_notified_at` set
  - Escalation timer start (critical path marker — escalation engine itself is Sprint 2)
- `GET /incidents/:id` — citizen reads own incident (RLS enforced)
- **Mobile (Expo — Citizen):**
  - Home screen with SOS button (large, center)
  - Hold-to-activate guard: 2-second continuous press detection
  - Emergency type modal: Crime | Medical
  - 3-second countdown screen with cancel button
  - Cancel flow: `sos_attempts` written with `was_cancelled = true`
  - Active Incident Tracking screen: shows `incident_code`, `status`, `emergency_type`
  - Supabase Realtime subscription (citizen → own incident channel)
  - Status updates reflect on screen in real-time without refresh

#### 1E — FCM Notification Service (Core)
- `sendNotification(userId, type, payload)` shared helper (`/lib/notifications/`)
  - Resolves `fcm_token` from `profiles`
  - Calls Firebase FCM HTTP v1 API
  - Writes `notifications` row (`delivery_status = 'sent'` on success, `'failed'` + `failed_reason` on error)
  - Handles NULL `fcm_token` gracefully (no crash, logs warning)
- All 4 notification payload templates: `incident_alert`, `assignment`, `escalation`, `status_update`
- `PATCH /notifications/:id/read` — mark notification read
- **Mobile (Expo):** FCM SDK initialized, permission request on first login, `fcm_token` sent to backend, background + foreground notification handlers, tap navigates to relevant screen
- **Web (Next.js):** FCM web push initialized for TL dashboard, browser permission request, in-app alert banner on new incident

#### 1F — Team Leader Dispatch Flow (Core)
- `PATCH /incidents/:id/acknowledge` — TL acknowledges (status: `pending/escalated → acknowledged`, sets `assigned_tl_id` atomically, TL ownership race → first wins, second gets 409)
- `GET /incidents/:id` — full incident detail (citizen GPS, status, escalation history)
- `GET /incidents/:id/responder-suggestions` — ranked on-duty responders by PostGIS distance
- `PATCH /incidents/:id/assign` — assign responder (status: `acknowledged → assigned`)
- `GET /incidents` — TL's org incident feed
- **Web (Next.js — TL Panel):**
  - Alert Feed page: live incident list with Supabase Realtime subscription (INSERT + UPDATE), urgency badges, time-since-alert, alert sound on new incident
  - Incident Detail page: citizen GPS on Google Map, incident metadata, acknowledge button, responder suggestions panel, assign button
  - Active Incident Monitor: all org incidents in progress

#### 1G — Responder Assignment Flow (Core)
- `PATCH /incidents/:id/accept` — accept assignment (atomic conditional UPDATE, race-safe for Level 2 escalation — 409 if already claimed)
- `PATCH /incidents/:id/status` — forward-only status updates (`en_route`, `arrived`, `resolved`)
- `PATCH /profile/duty` — duty toggle (blocked if active incident exists)
- **Mobile (Expo — Responder):**
  - Duty Toggle screen (on/off switch, active incident guard)
  - Assignment Notification screen: incident type, citizen address, distance, Accept button
  - Navigation screen (post-accept): Google Maps directions to citizen, status buttons (En Route → Arrived → Resolve)
  - Resolution screen: required notes text area, Submit button
  - Supabase Realtime subscription (responder → own assignment channel)

#### 1H — Incident Closure (Basic)
- `PATCH /incidents/:id/close` — TL or Super Admin closes (status: `resolved → closed`, sets `closed_by`, `closed_at`, FCM push to citizen)
- **Mobile (Expo — Citizen):** Active Incident screen transitions to "Closed" state
- **Web (Next.js — TL Panel):** Close button on Incident Detail page (visible when status = `resolved`)

---

### Why These Features Belong in Sprint 1

Every feature above is **directly on the critical dispatch chain.** Nothing is included for polish or automation:
- Infrastructure: required for everything
- Auth: required before any user action
- Admin bootstrap: required to seed orgs, TLs, and responders so dispatch routing has a target
- Citizen SOS: the entry point of the chain
- FCM core: without push notifications, TL and responders never know an incident exists
- TL dispatch: the middle of the chain — acknowledge and assign
- Responder flow: the end of the chain — accept, navigate, resolve
- Basic closure: closes the loop on the incident lifecycle

**Explicitly excluded from Sprint 1 (deferred to Sprint 2):**
- Escalation engine: the happy path works without it; escalation is a safety net
- Real-time location tracking: TL map works with PostGIS suggestions without live tracking
- Responder decline and TL reassign: flows exist but complex paths deferred
- Full FCM delivery tracking and retry: basic send/fail is sufficient for prototype
- Abuse/strike system: rate limit guard (per 10 min) is included; strike history deferred
- Incident history screens: users can verify via Supabase dashboard during prototype phase
- KPI and reporting: no production data yet

---

### Dependencies / Notes

- **Database schema must include `acknowledged`** in `incident_status` enum before any SQL migration is run. This is called out in `api_logic.md` v1.1 header.
- Super Admin account must be manually seeded in Supabase Auth before the Admin Bootstrap UI is functional.
- PostGIS jurisdiction query must be verified with known test GPS coordinates before `POST /incidents` is built.
- FCM credentials (Firebase service account JSON) must be stored in Supabase Edge Function secrets — never in client-side code or `.env.local`.
- Google Maps API key must have HTTP referrer restrictions set (not unrestricted).
- Supabase Realtime must be enabled on `incidents` table in the Supabase dashboard before subscriptions work.
- All 8 DB triggers must be verified with direct SQL tests before moving to auth/feature work. A broken trigger in Sprint 1 causes silent data corruption that is expensive to fix later.

---

### Definition of Done — Sprint 1

The sprint is complete when the following **end-to-end scenario** passes without manual DB intervention:

1. Citizen registers via phone OTP → profile row created, role = `citizen`
2. Super Admin creates an org with a jurisdiction radius, assigns a primary TL, backup TL, and 2 responders
3. Citizen holds SOS 2 seconds → type modal → countdown → dispatch fires
4. `incidents` row created: correct `incident_code`, `status = pending`, `organization_id` set, `citizen_lat/lng` captured
5. TL receives `incident_alert` FCM push notification
6. TL opens dashboard → incident appears in Alert Feed via Realtime
7. TL clicks Acknowledge → `status = acknowledged`, `assigned_tl_id` set, `tl_assigned_at` set
8. TL views citizen GPS pin on map and responder suggestions list
9. TL assigns Responder A → `status = assigned`, responder receives `assignment` FCM push
10. Responder accepts → `status = accepted`, `accepted_at` set, `response_time_seconds` computed
11. Responder updates: En Route → `en_route_at` set → Arrived → `arrived_at` set → Resolve (with notes) → `resolved_at` set
12. TL closes incident → `status = closed`, `closed_at` set, citizen receives `status_update` FCM push
13. Citizen sees "Closed" on Active Incident screen
14. `incident_logs` has one entry per status change (verified via Supabase table)
15. Rate limit: citizen attempts 4th dispatch in 10 minutes → 429 response on app
16. Build passes, dev server starts, no console errors

---

## Sprint 2 — Stability, Automation & UX Improvements

### Objective
Layer in the features that make the platform robust and fully operational in the field. Sprint 2 adds the escalation safety net, live responder tracking, all advanced dispatch flows (decline, reassign), full notification delivery tracking, abuse monitoring, and complete incident history. By the end of Sprint 2, the platform is operationally complete — suitable for a real pilot with real organizations.

---

### Features Included

#### 2A — Escalation Engine (Supabase Edge Function + pg_cron)
- `escalation-engine` Edge Function polled every 5 seconds
- **Level 1 (10s timeout):** Primary TL no-acknowledge → find backup TL → FCM `escalation` push → `escalation_events` INSERT (level: 1) → `incidents.status = escalated` + `escalated_at`
- **Level 2 (10s timeout):** Backup TL no-acknowledge → query nearest 3 on-duty responders → FCM push to all 3 → `escalation_events` INSERT (level: 2)
- Edge cases: no backup TL (skip Level 1, fire Level 2 directly), no on-duty responders (notify Super Admin, log reason)
- Idempotency guard: check `escalation_events` before firing at each level to prevent double-escalation
- TL acknowledge during escalation window stops further escalation (escalation checks skip incidents where `tl_assigned_at IS NOT NULL`)
- **Web (Next.js — TL Panel):** Escalation history section on Incident Detail page (reads `escalation_events`), visual "Escalated" badge on incident cards

#### 2B — Real-time Location Tracking
- `POST /responder-locations` — insert GPS record, `trg_mirror_responder_location` mirrors to `profiles`
- RLS verified: responders write own rows only, TLs read org's responder profiles
- **Mobile (Expo — Responder):** Background location tracking service (Expo Location background task), GPS push every 5–10 seconds while `is_on_duty = true`, stops when duty toggled off or incident resolved, permission denial handled gracefully
- **Web (Next.js — TL Panel):** Live responder pins on Google Map, Supabase Realtime on `profiles` (filtered by org and role), pins update without refresh, online/offline indicator (`last_seen_at` within 5 min)

#### 2C — Advanced Dispatch Flows
- `PATCH /incidents/:id/decline` — responder declines assignment (status: `assigned → acknowledged`, clears `assigned_responder_id`, notifies owning TL, blocked after `accepted`)
- `PATCH /incidents/:id/reassign` — TL swaps responders before accept (notifies old responder cancelled, notifies new responder assigned, blocked after `accepted`, logs to `incident_logs`)
- **Mobile (Expo — Responder):** Decline button on Assignment Notification screen with optional reason field
- **Web (Next.js — TL Panel):** Reassign button on Incident Detail (visible when status = `assigned`, hidden after `accepted`)

#### 2D — Full FCM Delivery Tracking
- FCM delivery webhook or polling: update `notifications.delivery_status` from `sent → delivered`
- `read_at` tracking (updated when user opens notification or taps through to incident)
- Retry logic for `failed` notifications (at most 1 automatic retry per failed send)
- Token refresh handling: on FCM `INVALID_REGISTRATION` error, clear `fcm_token` in profiles, log failed notification
- `GET /admin/notifications` — admin can view notification delivery status per incident

#### 2E — Responder Decline Race-Condition Verification
- Test: simulate 3 responders notified via Level 2 escalation, all call `/accept` simultaneously
- Confirm only the first succeeds (atomic conditional UPDATE on `assigned_responder_id IS NULL`)
- Confirm subsequent callers receive 409 Conflict
- Document result in QA log

#### 2F — Incident History & Audit Log Viewer
- `GET /incidents` — full filter support: status, type, date range, priority, source
- `GET /incidents/:id/logs` — full `incident_logs` audit trail per incident
- `PATCH /incidents/:id/archive` — Super Admin archives closed incident (sets `archived_at`, blocked if not `closed`)
- **Mobile (Expo — Citizen):** Incident History screen (own past incidents, ordered by `created_at DESC`, tap for read-only detail)
- **Web (Next.js — TL Panel):** Incident History page (org incidents, all statuses, filterable), Incident Log viewer (chronological `incident_logs` per incident)
- **Web (Next.js — Admin Panel):** Archive button on closed incidents

#### 2G — Abuse Prevention & Strike System
- Strike increment logic: on each SOS cancel, count citizen cancels in last 24 hours — increment `abuse_strike_count` on 3rd+ cancel in window
- Threshold enforcement: in-app warning at 3 strikes, auto-suspend at 5 strikes (`is_suspended = true`)
- `PATCH /admin/users/:id/reset-strikes` — reset `abuse_strike_count = 0`, `is_suspended = false`
- **Mobile (Expo — Citizen):** Warning banner at 3 strikes, SOS button disabled with "Account suspended" message at 5+ strikes
- **Web (Next.js — Admin Panel):** Strike count visible per user, reset button with confirmation dialog

---

### Why These Features Belong in Sprint 2

**Escalation engine:** The happy path works without it. Escalation is a safety net — important for production but not needed to prove the dispatch chain works. Building it second allows Sprint 1 to focus on the core flow without the complexity of timer-based automation.

**Real-time location tracking:** The TL can assign responders using the PostGIS distance-based suggestion query (built in Sprint 1) without live GPS pins. Live tracking is a UX improvement that makes the TL dashboard more useful in real deployments.

**Decline and reassign:** Edge cases in the assignment flow. The core accept path is Sprint 1; the error correction paths are Sprint 2.

**Full FCM delivery tracking:** Sprint 1 gives us fire-and-forget notifications. Sprint 2 gives us visibility into whether they were received. Important for production but not needed for the prototype demo.

**Incident history and archive:** No production data in Sprint 1. History screens are a read feature — they become useful once there's historical data to review.

**Abuse/strike system:** Rate limiting (per 10 min) is already in Sprint 1. The strike accumulation system requires user behavior patterns to tune correctly — better to observe real usage patterns in Sprint 1 before locking in thresholds.

---

### Dependencies / Notes

- Sprint 1 fully complete and tested before Sprint 2 begins.
- Escalation engine requires a way to invoke the Edge Function on a schedule. Supabase pg_cron can call an Edge Function via HTTP — this is the recommended approach. pg_cron fires every 5 seconds at minimum (1-minute granularity native; 5-second polls require an internal loop or invocation pattern — verify Supabase Edge Function timeout limits first).
- Background location tracking on iOS requires the `UIBackgroundModes location` entitlement in `app.config.ts`. This must be present before submitting to App Store or TestFlight.
- The escalation engine's Level 2 "notify 3 nearest responders" requires that responder GPS is up to date in `profiles.last_known_lat/lng`. If a responder has not pushed a location recently (e.g., no location tracking yet), fall back to org base lat/lng for distance calculation.
- Decline and reassign endpoints are defensive flows — test them explicitly with `status` edge cases to confirm blocked states (e.g., decline after accept) return correct error codes.

---

### Definition of Done — Sprint 2

1. **Escalation path verified end-to-end:** Primary TL does not acknowledge in 10s → backup TL notified. Backup TL does not acknowledge in 10s → 3 nearest on-duty responders each receive FCM push. First responder to accept claims incident; others receive 409.
2. **Idempotency:** Escalation engine does not double-fire if polled multiple times while incident is in escalation window.
3. **Responder decline works:** Responder declines → status reverts to `acknowledged`, TL receives push, TL can reassign.
4. **TL reassign works:** TL reassigns before accept → old responder notified cancelled, new responder notified assigned. Reassign after accept returns 400.
5. **Live location tracking:** On-duty responder GPS pins appear on TL map and update in real-time. Pins stop updating when responder goes off duty.
6. **FCM delivery status:** `notifications` table reflects `delivered` status after successful delivery. `failed` rows include `failed_reason`. NULL token case handled.
7. **Strike system:** 3rd cancel in 24h increments strike, in-app warning shown. 5th strike auto-suspends citizen. Admin can reset strikes.
8. **Incident history:** Citizen sees own past incidents. TL can filter org history by status/type/date. Audit log readable per incident.
9. **Race condition test passed** (documented): Level 2 concurrent accept — only one responder claims, others get 409.
10. All Sprint 1 flows still pass (regression check).

---

## Sprint 3 — Hardening, Security & Production Readiness

### Objective
Harden the platform for production. Audit every security surface, complete the admin analytics tools, activate data retention jobs, run end-to-end QA across all platforms, and deploy to production environments. By the end of Sprint 3, the platform is suitable for a real organization to operate with real users.

---

### Features Included

#### 3A — Scheduled Data Cleanup Jobs (pg_cron)
- `cleanup_responder_locations` (daily at 02:00 UTC):
  - DELETE responder_locations rows older than 90 days
- `cleanup_notifications` (daily at 02:30 UTC):
  - DELETE notifications rows older than 30 days
- `reset_incident_daily_seq` (daily at 00:00 UTC):
  - ALTER SEQUENCE incident_daily_seq RESTART WITH 1
- All 3 jobs verified: manual trigger test, correct rows deleted (not too many, not too few), sequence reset confirmed with correct `incident_code` suffix after reset

#### 3B — Admin KPI Dashboard
- `GET /admin/kpi` — KPI summary:
  - Average response time by org (`response_time_seconds` aggregation)
  - Incidents by status (count breakdown)
  - Escalation rate (incidents where `escalated_at IS NOT NULL` / total)
  - False alarm rate (`sos_attempts.was_cancelled` / total SOS attempts)
  - FCM delivery failure rate (`notifications.delivery_status = 'failed'` / total sent)
- `GET /admin/incidents` — full incident log with all filters (status, type, org, date range, priority, source)
- **Web (Next.js — Admin Panel):**
  - KPI dashboard page: bar chart (avg response time by org), pie chart (incident status distribution), escalation rate trend, false alarm rate trend
  - Full incident log table with all filter controls
  - Export to CSV (basic — for external reporting)

#### 3C — Full Security Audit
- RLS policies verified for every table and every role using Supabase Policy Tester with role-specific JWTs:
  - Citizen cannot read another citizen's incident
  - Responder cannot read incidents not assigned to them
  - TL cannot read incidents outside their org
  - Super Admin can read all rows in all tables
  - No role can write to `incident_logs` directly (trigger only)
  - No role can write to `escalation_events` directly (engine only)
- No service role key exposed in any client-side code or public environment variable
- All API routes enforce JWT validation before any DB operation
- `role` is always read from `profiles` on the server side, never trusted from client payload
- All admin endpoints blocked to non-super_admin roles
- Google Maps API key has correct HTTP referrer restrictions
- Firebase service account JSON not present in any client bundle or repo

#### 3D — End-to-End QA (All Platforms)
Test scenarios across iOS, Android, and web:

**Happy path:** Citizen SOS → TL acknowledge → assign responder → accept → en route → arrived → resolve → close  
**Escalation path:** Primary TL timeout → backup TL → backup TL timeout → Level 2 responders → first accept claims  
**Race condition:** 3 responders notified simultaneously, all attempt accept, only first succeeds  
**Decline and reassign:** Responder declines → TL reassigns → new responder accepts  
**No jurisdiction:** Citizen GPS outside all org radii → `escalated`, Super Admin notified  
**Rate limit:** 4th SOS in 10 min → 429 on citizen app, no incident created  
**Strike system:** 3 cancels → warning, 5 strikes → auto-suspend, SOS disabled  
**Suspended user:** Cannot dispatch SOS, cannot access dashboard  
**Auth edge cases:** Expired JWT, invalid OTP, missing FCM token  
**Realtime reconnection:** Drop network mid-incident, reconnect, subscription recovers without user action

#### 3E — Performance Review
- PostGIS jurisdiction query: < 200ms under simulated load with multiple organizations
- Incident feed load time: < 1 second for TL dashboard
- Realtime subscription reconnection: < 5 seconds after network drop
- Location push (`POST /responder-locations`): < 100ms response time
- Escalation engine Edge Function: verify it completes within Supabase Edge Function timeout limits before next poll fires

#### 3F — Production Deployment
- Supabase production project created (separate from dev)
- All SQL migration files run cleanly on production Supabase
- Production environment variables set across all platforms:
  - Supabase production URL and anon key
  - Firebase service account credentials (Supabase Edge Function secrets)
  - Google Maps API key (with production domain restrictions)
- Expo EAS Build configured for iOS and Android (production build profile)
- Expo app submitted to internal distribution (TestFlight for iOS, Play Internal Testing for Android)
- Next.js dashboard deployed to Vercel (production environment)
- Custom domain configured if applicable
- Supabase Auth SMS/OTP template customized with platform branding

---

### Why These Features Belong in Sprint 3

**Scheduled cleanup jobs:** There is no meaningful data to clean up in Sprint 1 or 2 (dev/prototype environment). These jobs are operational infrastructure for production scale — they belong in the production readiness sprint.

**KPI dashboard:** KPI metrics require real historical incident data to be meaningful. Building charting infrastructure before production data exists produces empty dashboards. Sprint 3 is when the first real data is generated.

**Full security audit:** The RLS policies are written and enabled from Sprint 1. The audit in Sprint 3 is a dedicated verification pass — methodical testing of every role/table combination using real JWTs. This is a pre-production gate, not a first-time setup.

**End-to-end QA:** Meaningful cross-platform QA requires the full feature set from Sprints 1 and 2 to be complete. Partial QA in earlier sprints is done per-feature, not as a comprehensive regression suite.

**Performance review:** Performance benchmarks need the full data model and feature set to be accurate. Running perf tests on a half-built system produces misleading results.

**Production deployment:** Only after security audit and full QA pass. Not before.

---

### Dependencies / Notes

- Sprint 2 fully complete and tested before Sprint 3 begins.
- A dedicated Supabase **production** project must be created before Sprint 3 deployment. Never run SQL migrations directly against a production project without testing against dev first.
- All 7 SQL migration files from Sprint 1 must be version-controlled in `/supabase/`. Production migration is a replay of these same files.
- Expo EAS Build requires an Apple Developer account (iOS) and a Google Play developer account (Android). These accounts must be active before Sprint 3 deployment begins.
- pg_cron cleanup jobs must be verified against **copies** of production-scale data if possible. A job that deletes too aggressively in production is not recoverable (for non-legal data). Verify the DELETE WHERE clause exactly.
- The `reset_incident_daily_seq` job carries one specific risk: the `trg_incident_code_generate` trigger must correctly generate `0001` on the first incident of each new day after reset. Verify this with a direct SQL test post-reset.

---

### Definition of Done — Sprint 3 (MVP Complete)

Per `project_specs.md` MVP Definition of Done:

| # | Requirement | Verified In |
|---|---|---|
| 1 | Citizen can register/login | Sprint 1 |
| 2 | Citizen can send SOS alert | Sprint 1 |
| 3 | GPS auto-captures successfully | Sprint 1 |
| 4 | System routes alert by jurisdiction | Sprint 1 |
| 5 | TL receives notification | Sprint 1 |
| 6 | TL can assign responder | Sprint 1 |
| 7 | Responder receives assignment | Sprint 1 |
| 8 | Responder can update incident status | Sprint 1 |
| 9 | Incident logs save successfully | Sprint 1 |
| 10 | Escalation logic works | Sprint 2 |

**Sprint 3 additional gates:**
- All end-to-end test scenarios pass on iOS, Android, and web
- Full RLS security audit passes with zero cross-role data leaks
- No service role key present in any client-side code
- All 3 pg_cron jobs running on production Supabase
- Performance benchmarks met (jurisdiction query < 200ms, incident feed < 1s)
- Expo app available on TestFlight and Play Internal Testing
- Next.js dashboard live on Vercel

---

## Build Order (Condensed)

```
Sprint 1 (Prototype)
├── 1A Infrastructure & Database
├── 1B Authentication
├── 1C Admin Bootstrap
├── 1D Citizen SOS Core
├── 1E FCM Notifications Core
├── 1F TL Dispatch Core
├── 1G Responder Flow Core
└── 1H Basic Incident Closure

Sprint 2 (Full Operations)
├── 2A Escalation Engine          [depends on Sprint 1 complete]
├── 2B Real-time Location         [depends on 1B, 1G]
├── 2C Decline & Reassign         [depends on 1F, 1G]
├── 2D Full FCM Delivery          [depends on 1E]
├── 2E Race Condition Verification [depends on 2A, 2C]
├── 2F Incident History & Archive  [depends on Sprint 1]
└── 2G Abuse & Strike System       [depends on 1D]

Sprint 3 (Production Ready)
├── 3A Scheduled Cleanup Jobs     [depends on Sprint 2]
├── 3B Admin KPI Dashboard        [depends on Sprint 2, real data]
├── 3C Security Audit             [depends on Sprint 2]
├── 3D End-to-End QA              [depends on Sprint 2]
├── 3E Performance Review         [depends on Sprint 2]
└── 3F Production Deployment      [depends on 3C, 3D]
```

---

## Risk Register

| Risk | Sprint | Mitigation |
|---|---|---|
| PostGIS queries return wrong org or no org | 1 | Test jurisdiction query with known GPS coordinates before building `POST /incidents` |
| FCM token refresh invalidates stored tokens | 1, 2 | Upsert token on every app open; handle FCM `INVALID_REGISTRATION` by clearing stored token |
| Escalation engine double-fires | 2 | Idempotency guard: check `escalation_events` before firing at each level |
| Race condition in Level 2 accept | 1, 2 | Atomic conditional UPDATE; verified under concurrent load in Sprint 2 |
| iOS background location tracking revoked | 2 | `UIBackgroundModes location` configured; prompt user to re-enable; degrade without crashing |
| Sequence reset causes duplicate `incident_code` | 3 | `UNIQUE` constraint catches collisions; verify trigger behavior after reset in Sprint 3 |
| RLS misconfiguration exposes cross-org data | 1, 3 | RLS enabled from day one (Sprint 1); dedicated audit pass in Sprint 3 |
| Supabase Realtime drops connection mid-incident | 1, 2 | Reconnection logic with exponential backoff on all Realtime subscriptions from Sprint 1 |
| Escalation engine exceeds Edge Function timeout | 2 | Test function execution time before deploying; use lightweight queries with proper indexes |
| pg_cron cleanup deletes wrong rows in production | 3 | Verify DELETE WHERE clause against production data copy before running live |

---

## Notes

- **No code is written until this plan is approved.**
- Sprint 1 is the most critical sprint. It must be complete and fully passing before Sprint 2 begins. Do not carry incomplete Sprint 1 work into Sprint 2 — partial dispatch chains are not testable.
- The `acknowledged` status added in `api_logic.md` v1.1 requires `database_schema.md` to be updated before any SQL migration is run. Update `database_schema.md` as the first action before Sprint 1 begins.
- Each sprint should end with a recorded demo walkthrough of the full dispatch chain — this serves as the regression baseline for the next sprint.
- Scalability is preserved by building on the same PostGIS + Supabase + RLS + Realtime foundation from the original Phase 0. Sprint reorganization changes delivery order, not architecture.
