# PROJECT SPECS — Emergency Response Dispatch Platform

---

# Project Name
Guardian Dispatch (Working Title)

---

# Project Purpose
Build a modern emergency response dispatch platform that digitizes emergency intake, routing, assignment, and tracking to reduce delays caused by traditional dispatcher handoff systems.

---

# Core Problem Being Solved
Traditional emergency dispatch suffers from:

- Manual questioning delays
- Caller often cannot provide exact location
- Multiple handoffs between caller → dispatcher → responder
- Repetitive verbal relay of details
- Delayed jurisdiction identification
- No real-time responder tracking
- Manual follow-up and reporting

---

# Primary Goal
Reduce emergency response time by automating dispatch workflow and routing emergency alerts directly to the proper response organization.

---

# Target Users

## Citizen
Regular civilians who may need emergency assistance.

## Team Leader (TL)
Dispatcher/team lead responsible for receiving alerts and assigning responders.

## Responder
Personnel deployed to physically respond to incidents.

## Super Admin
Platform administrator managing organizations/system.

---

# Supported Emergency Types (MVP)

- Crime
- Medical

---

# Core User Flow

## Citizen Emergency Flow
1. User opens app
2. Holds SOS button for 2 seconds
3. Emergency type modal appears:
   - Crime
   - Medical
4. User selects emergency type
5. 3-second countdown begins
6. User may cancel during countdown
7. Emergency alert is sent

---

## Dispatch Flow
1. System captures citizen GPS
2. System matches nearest jurisdiction based on organization radius
3. Alert routed to nearest Team Leader
4. Team Leader receives notification
5. Team Leader views incident details/map
6. Team Leader assigns nearest responder
7. Responder accepts assignment
8. Responder updates status until resolved

---

# Dispatch Rules (Confirmed — 2026-04-24)

## Rule 1 — Jurisdiction Matching
- Find all active orgs where incident GPS falls within `coverage_radius_km`
- Multiple matches → smallest radius first, then nearest base distance
- No match → nearest active org by base distance (no citizen goes unanswered)
- `organization_id` fixed at creation; only changes on cross-org transfer (Stage 5)

## Rule 2 — SOS Notification Target
- Alert routes to PRIMARY TL only — the on-duty TL with lowest `tl_priority` number
- NOT broadcast to all TLs — one at a time to maintain command hierarchy
- If no TL is on duty at SOS time → skip to Stage 3 (direct responder dispatch)

## Rule 3 — Escalation Chain

### Stage 1 — Primary TL (timeout: 60s)
- Notify primary TL (`tl_priority = 1`, `is_on_duty = true`)
- Required: TL must Acknowledge
- Timeout → Stage 2
- Status: `pending`

### Stage 2 — Backup TL (timeout: 60s)
- Notify backup TL: check `organizations.backup_tl_id` first, fallback `tl_priority = 2` on-duty
- Required: Backup TL must Acknowledge
- Timeout → Stage 3
- Status: `escalated`
- If no backup TL exists or none on duty → skip immediately to Stage 3

### Stage 3 — Direct Responder, Same Org (timeout: 45s)
- System auto-assigns nearest on-duty responder in matched org (Haversine)
- Required: Responder must Accept within 45s
- Timeout → Stage 4
- Status: `assigned`

### Stage 4 — Next Responder Loop, Same Org (timeout: 45s each)
- Unassign current responder → assign next nearest on-duty responder same org
- Repeat for each remaining on-duty responder, nearest-first
- All exhausted → Stage 5

### Stage 5 — Cross-Org Transfer
- Find nearest active org of SAME TYPE (police→police, medical→medical) with ≥1 on-duty responder
- Update `organization_id` on incident to receiving org
- Notify original org’s Primary TL: "Incident transferred to [Org Name] — no available responders"
- Receiving org enters Stage 3 directly (no TL delay — already critical)

## Rule 4 — TL Acknowledge → Assign Window (120s)
- After TL acknowledges, escalation pauses
- TL has 120s to assign a responder
- No assignment within 120s → escalation resumes at Stage 3 (bypass TL)

## Rule 5 — Responder Acceptance (45s)
- Responder receives FCM push
- Must Accept within 45s or next responder is tried
- On accept: `accepted_at` set, `response_time_seconds` computed, status → `accepted`

## Rule 6 — Active Incident Lock
- Once accepted, incident locked to that responder
- No re-assignment unless TL manually unassigns
- Status progression responder-driven: `accepted → en_route → arrived → resolved`

## Rule 7 — 2-Way Resolution Confirmation
- Responder submits 5W report → status → `pending_citizen_confirmation`
- Citizen prompted: "Was your emergency handled?"
- YES → `resolved`
- No response within 10 minutes → auto-close → `closed` (pg_cron)
- NO → `resolved` with dispute flag (admin review — future)

## Rule 8 — Dispatch Model (MVP)
- One responder notified at a time (sequential, nearest-first)
- Future: broadcast to all on-duty, first-to-accept wins

---

# Jurisdiction Logic

Organizations define:

- Base Location Pin
- Coverage Radius (KM)

Example:

Sto Niño Police Station:
- Base Pin = GPS Location
- Radius = 3KM

Routing Rule:
System finds which organization radius contains the citizen’s GPS.

If multiple match:
Priority Order:
1. Smallest radius match first
2. Then nearest base distance

Cross-org fallback:
- Same organization type only (police→police, medical→medical)
- Jurisdiction is a soft preference — never leaves a citizen without response

---

# Incident Status Lifecycle

- Pending
- Assigned
- Accepted
- En Route
- Arrived
- Resolved
- Closed
- Escalated

---

# Incident Logging / Audit Trail

Each incident must log:

- Alert Created Timestamp
- TL Assigned Timestamp
- Responder Assigned Timestamp
- Accepted Timestamp
- Arrival Timestamp
- Resolution Timestamp

Purpose:
- Reporting
- Accountability
- Analytics
- Audit Trail

---

# Citizen App Screens

1. Login/Register
2. Home Dashboard
3. SOS Modal
4. Countdown Modal
5. Active Incident Tracking
6. Incident History
7. Profile/Settings

---

# Team Leader Dashboard Screens

1. Alert Feed
2. Incident Detail View
3. Map View
4. Responder Suggestions
5. Active Incident Monitor

---

# Responder App Screens

1. Duty Toggle Screen
2. Assignment Notification
3. Navigation Screen
4. Resolution Screen

---

# Admin Dashboard Features

- Create/Edit Organizations
- Assign Team Leaders
- Assign Responders
- Configure Jurisdiction Radius
- Configure Backup TL
- Manage Users
- View Incident Logs

---

# Security / Abuse Prevention

- OTP Verification
- Hold-to-Activate SOS
- Countdown Cancel Option
- Incident Logging
- Strike/Abuse Monitoring
- Admin Review Tools

---

# Tech Stack

## Frontend Mobile
React Native / Expo

## Dashboard / Admin
Next.js

## Backend / Database / Auth
Supabase

## Maps / Routing
Google Maps API

## Notifications
Firebase Cloud Messaging

## SMS Backup (Future)
Twilio / Local SMS Gateway

---

# MVP Definition of Done

The MVP is complete when:

1. Citizen can register/login
2. Citizen can send SOS alert
3. GPS auto-captures successfully
4. System routes alert by jurisdiction
5. TL receives notification
6. TL can assign responder
7. Responder receives assignment
8. Responder can update incident status
9. Incident logs save successfully
10. Escalation logic works

---

---

# Sprint 10 — Citizen Mobile Sign-Up / Phone Auth Flow

## Feature Overview
Replace admin-only citizen creation with a self-service phone-first registration flow inside the mobile app. Citizens register and log in using their phone number via Firebase OTP. No email or password required. Access to all citizen features (SOS, history, profile) is blocked until OTP is verified.

---

## User Flow

### New User
1. Open app → `CitizenLoginScreen`
2. Enter phone number → tap Send Code → Firebase SMS sent
3. `CitizenOtpScreen` → enter 6-digit code → auto-submits on 6th digit
4. Firebase verifies OTP → Edge Function `citizen-auth` called
5. Supabase account created silently (synthetic credentials, citizen never sees them)
6. `profiles` row created with `role = citizen`
7. Phone saved to AsyncStorage (pre-fills on next open)
8. → `CitizenProfileSetupScreen` (first time only)
9. Enter full name (required), email (optional), add photo (optional)
10. → Citizen Home Screen

### Returning User
1. Open app → `CitizenLoginScreen` (phone pre-filled from AsyncStorage)
2. Tap Send Code → Firebase SMS sent
3. Enter OTP → Firebase verifies
4. Edge Function finds existing Supabase account
5. Client signs into Supabase silently
6. → Citizen Home Screen (skip profile setup — already complete)

---

## Screens

### CitizenLoginScreen
- Phone number input (E.164 format, e.g. +639171234567)
- Auto-fill phone from AsyncStorage if available
- "Send Code" button
- Firebase reCAPTCHA (invisible)
- Link: "For emergency responders or team leaders, contact your administrator"

### CitizenOtpScreen
- 6-digit OTP input
- Auto-submit when 6th digit entered
- Resend code option (30-second cooldown)
- Back button to change phone number

### CitizenProfileSetupScreen (first-time only)
- Full name input (required)
- Email input (optional — stored if provided)
- Profile photo (optional — tap to upload from camera or gallery)
- "Complete Setup" button (disabled until full name entered)
- "Skip Photo" visible below button
- After save → Citizen Home Screen
- Persistent banner on Home Screen until photo added: "Add your photo — helps responders identify you"

---

## Auth Architecture

**Firebase** = OTP delivery and phone verification
**Supabase** = session, data, and RLS layer

**Bridge mechanism:**
- After Firebase OTP verified, client has `firebaseUID`
- Synthetic Supabase credentials derived client-side:
  - Email: `firebase_{firebaseUID}@guardian.internal`
  - Password: `firebaseUID`
- Call Edge Function `citizen-auth` with phone + firebaseUID
- Edge Function creates Supabase account + profile if new user
- Client calls `supabase.auth.signInWithPassword()` with synthetic credentials
- Supabase session stored as normal

**Security:** Firebase OTP is the security gate. UID is a long random string — not guessable. Citizens never see or interact with the synthetic email/password.

---

## Database Changes

No schema changes needed. Existing `profiles` table already has:
- `id` (matches Supabase auth UID)
- `full_name`
- `phone_number`
- `phone_verified`
- `role`

New columns to add:
- `email` (text, nullable) — optional citizen-provided email
- `avatar_url` (text, nullable) — Supabase Storage URL for profile photo

---

## Edge Function: citizen-auth

**Endpoint:** POST `/functions/v1/citizen-auth`
**Auth:** No JWT required (called before Supabase session exists)
**Secret guard:** `CITIZEN_AUTH_SECRET` header checked

**Input:**
```json
{ "phone": "+639171234567", "firebase_uid": "abc123..." }
```

**Logic:**
1. Validate inputs
2. Check if Supabase user exists with synthetic email
3. If not: `adminClient.auth.admin.createUser()` + create `profiles` row
4. If yes: user exists, no action
5. Return `{ email, password }` for client to sign in

**Output:**
```json
{ "email": "firebase_abc123@guardian.internal", "password": "abc123..." }
```

---

## Storage

Supabase Storage bucket: `avatars`
- Path: `avatars/{user_id}.jpg`
- Public read, authenticated write (RLS: own file only)

---

## Profile Completion Detection

After sign-in, check `profiles.full_name`:
- `null` or empty → show `CitizenProfileSetupScreen`
- Set → go to Citizen Home

---

## What "Done" Means

- [ ] New citizen can register with phone number only
- [ ] OTP verification required — no bypass
- [ ] Returning citizen logs in with phone + OTP (no password entry)
- [ ] Phone auto-saved and pre-filled on next app open
- [ ] Full name saved to profiles
- [ ] Optional email saved if provided
- [ ] Optional photo uploaded to Supabase Storage and avatar_url saved
- [ ] Persistent "Add photo" nudge shown on Home if no avatar
- [ ] `role = citizen` set on all new profiles
- [ ] Existing non-citizen users (TL, responder, admin) unaffected

---

# Future Features (Post MVP)

- Voice Emergency Trigger
- Power Button Shortcut Trigger
- Silent SOS Mode
- Audio/Video Auto Recording
- Polygon Boundary Jurisdictions
- AI Dispatch Suggestions
- National Scaling / Cloud Infra