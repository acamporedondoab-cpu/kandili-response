# Guardian Dispatch Project — Master Context

## Project Status

**Current Sprint:** Sprint 1B
**Current Progress:** Task 1B-1 Complete
**Next Task:** Sprint 1B-2 — Supabase Client Setup

---

## Sprint 1A — Database Foundation (COMPLETE)

### 001_extensions.sql

Enabled core PostgreSQL extensions:

* uuid-ossp
* PostGIS

**Purpose:**

* UUID generation for primary keys
* Geospatial jurisdiction/radius queries

---

### 002_enums.sql

Created enum types:

* user_role
* emergency_type
* organization_type
* incident_status
* incident_priority
* incident_source
* notification_delivery_status
* notification_type

---

### 003_tables.sql

Created core tables:

* organizations
* profiles
* incidents
* incident_logs
* escalation_events
* responder_locations
* notifications
* sos_attempts

---

### 004_indexes.sql

Created indexes for:

* performance optimization
* dashboard filtering
* geospatial lookup
* foreign key relations

---

### 005_triggers.sql

Created trigger/functions for:

* auto updated_at timestamps
* incident code generation
* auth user → auto profile creation
* responder GPS mirroring
* incident status audit logs

---

### 006_rls.sql

Implemented:

* Row Level Security on all major tables
* Helper functions
* Access policies by user role/org

---

## Frontend / Mobile Initialization (COMPLETE)

### Next.js Web App Initialized

**Location:** `/app`

Installed/Configured:

* Next.js 14
* TypeScript
* TailwindCSS
* ESLint
* Supabase packages

---

### Expo Mobile App Initialized

**Location:** `/mobile`

Installed/Configured:

* Expo Blank TypeScript Template
* Expo Go Verified Working
* Mobile folder structure created

---

## Environment Variables Setup (COMPLETE)

Created:

* `/app/.env.local`
* `/mobile/.env`

Configured:

* Supabase URL
* Supabase Publishable/Anon Key

---

## Sprint 1B Progress

### Task 1B-1 — Auth + Auto Profile Verification (COMPLETE)

Configured:

* Enabled Email Auth Provider
* Disabled Confirm Email for Dev Mode

Verified:

* Auth user creation works
* Trigger auto-creates profile row
* Auth → Profile pipeline working end-to-end

---

## Major Bug Encountered + Resolution

### Issue

Creating second auth user caused:

`Database error creating new user`

---

### Root Cause

`profiles.phone_number` column was:

* UNIQUE
* NOT NULL

Trigger inserted:

* Empty string `''` for every signup

---

### Why It Failed

**First User:**

* phone_number = `''` → Allowed

**Second User:**

* duplicate `''` → Violates UNIQUE constraint

---

### Initial Failed Fix Attempt

Changed trigger to insert NULL.

**New Problem:**

* `full_name` column was NOT NULL
* NULL violated constraint

---

### Final Successful Fix

#### Schema Fix

Ran:

```sql
ALTER TABLE profiles
ALTER COLUMN phone_number DROP NOT NULL;
```

#### Trigger Fix

Final insert logic:

```sql
full_name = ''
phone_number = NULL
role = 'citizen'
```

---

### Result

Auth pipeline now supports:

* unlimited email users
* no duplicate phone conflicts
* proper nullable phone handling

---

## Test Users Created

Accounts:

* [testcitizen@guardian.dev](mailto:testcitizen@guardian.dev)
* [admin@guardian.dev](mailto:admin@guardian.dev)

Password:

* TestPass123!

---

## Important Architecture Decision

### MVP Auth Strategy

Using:

* Email/Password Auth

Instead of:

* Phone OTP

Reason:

* Deferred Twilio/SMS setup due to cost
* Infra complexity
* PH SMS concerns
* Faster MVP build speed

Future migration to OTP remains possible.

---

## Important Development Learnings

Best Practice:

* UNIQUE columns should use NULL defaults, not blank strings

---

## Project Folder Structure

```bash
/emergency-response-app
│
├── /app
├── /mobile
└── /supabase
```

---

## Immediate Next Task

### Sprint 1B-2 — Supabase Client Setup

Planned Scope:

* Web browser client
* Web server client
* Mobile client
* Environment verification

---
## Task 1B-2 — Supabase Client Setup (COMPLETE)

Implemented:

### Web Clients
- app/lib/supabase/client.ts
- app/lib/supabase/server.ts

### Mobile Client
- mobile/lib/supabase/client.ts

### Installed Dependencies
- @supabase/ssr
- @supabase/supabase-js
- expo-secure-store

Verified:
- Next.js compiles successfully
- Expo builds successfully
- SecureStore adapter works

Result:
Project now has production-ready Supabase connection layer for web and mobile.

## Task 1B-3 — Middleware and Session Management (COMPLETE)

Implemented:
- Root-level middleware.ts in correct Next.js project root
- Route protection for /dashboard
- Redirect unauthenticated users → /login
- Redirect authenticated users from /login → /dashboard
- Next.js matcher config setup

Major Bugs Resolved:
- Middleware initially placed in wrong nested folder and was not executing
- .env.local used incorrect EXPO_PUBLIC variables instead of NEXT_PUBLIC
- Confirmed env loading and middleware execution after fixes

Verified:
- /dashboard redirects to /login when not authenticated
- Middleware works correctly in App Router structure

## Task 1B-4 — Login / Signup UI and Supabase Auth Actions (COMPLETE)

Implemented:
- Server Actions auth file: app/app/auth/actions.ts
- Login page with Supabase signInWithPassword
- Signup page with Supabase signUp
- Logout action with Supabase signOut
- Dashboard page showing logged-in user/email/ID
- Middleware-protected dashboard access
- Redirect authenticated/unauthenticated users properly

Major Bugs Resolved:
- Incorrect Supabase import paths due to nested app/lib structure
- Accidentally deleted lib folder and rebuilt manually
- Fixed invisible input styling
- Fixed stale error query param issue after signup rate-limit

Verified:
- Signup works
- Login works
- Logout works
- Protected routes redirect correctly
- Dashboard only accessible when authenticated

## Task 1B-5 — Role / Profile Sync / Admin Promotion (COMPLETE)

Implemented:
- Created Profile TypeScript schema matching profiles table
- Built getCurrentUserWithProfile helper
- Built requireRole guard helper
- Promoted admin@guardian.dev to super_admin via SQL
- Updated dashboard to display user role/profile data
- Added Admin Panel placeholder page
- Enforced role-based access to /admin route

Major Bugs Resolved:
- Multiple import path mismatches due to nested folder structure
- guard.ts / guards.ts naming mismatch
- Folder structure confusion between /auth and /lib/auth

Verified:
- super_admin can access /admin
- citizen users redirected away from /admin
- dashboard displays correct role per user
- role-based UI rendering works

## Task 1B-6 — Organization / Team Leader Foundation (COMPLETE)

Implemented:
- Added Profile Type definitions
- Added Organization Type definitions
- Built organization helper queries
- Seeded Metro Police Unit 1 organization
- Created TL and responder users
- Assigned users to organization and roles
- Built Team Leader Dashboard
- Added responder listing / on-duty display
- Added TL dashboard link from main dashboard

Major Bugs Resolved:
- Schema mismatch on organizations insert (base_lat/base_lng/coverage_radius_km required)
- Self-import duplicate function bug in organizations.ts
- Multiple import path corrections due to nested folder structure
- Missing responder auth user causing empty team list

Verified:
- TL dashboard loads for TL/super_admin
- Citizens blocked from TL dashboard
- TL sees assigned responders
- Team hierarchy functioning correctly

## Task 2A-1 — Incident / Dispatch Foundation (COMPLETE)

Implemented:
- Added nearest organization geo-routing SQL function
- Added incident helper functions
- Added TL incident queue page
- Added admin incident stats panel
- Installed/configured Supabase CLI
- Built Edge Function structure
- Deployed dispatch-sos serverless function
- Implemented incident creation via Edge Function
- Integrated nearest-org routing into dispatch logic
- Successfully created first real incident via API

Current Temporary Limitation:
- citizen_id is hardcoded for testing inside dispatch-sos function
- Will be replaced by JWT auth extraction in future sprint

Verified:
- dispatch-sos endpoint deployed live
- SOS request successfully creates DB incident
- Correct organization auto-selected by geo function
- Incident code generated properly
- Incident visible in TL queue/admin stats

# Emergency Response App — Project Context Update

## Current Sprint Status

* **Task 2A-1 COMPLETE**

  * Edge Function deployed and live (`dispatch-sos`)
  * Incident creation working
  * Geo-routing / nearest organization lookup working
  * TL/Admin incident visibility confirmed working

* **Task 2A-2 COMPLETE**

  * Replaced hardcoded `citizen_id` with authenticated JWT user extraction
  * ES256 JWT verified via `jose` + JWKS endpoint (bypasses GoTrue limitation)
  * Deployed with `--no-verify-jwt` flag (gateway skips check; function handles auth)
  * Duplicate incident protection working (409 on active incident)
  * Abuse/suspension/role checks working
  * TL notifications inserted to DB on dispatch
  * End-to-end test confirmed: 200 response with correct `incident_code`

## Bookmarked Future Improvements

* Incident Queue should later display responder name/assignment in TL queue UI.

## Resume Point for Next Session

* Continue from **Task 2A-2 final JWT validation / authenticated dispatch testing**.


## Resume Instruction For Future Chats

Use this prompt:

`Continue Guardian Dispatch project using PROJECT_CONTEXT. Current sprint is Sprint 1B. We finished 1B-1 and are starting 1B-2.`
