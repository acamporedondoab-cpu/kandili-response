# STATUS — Guardian Dispatch Platform

**Last Updated:** 2026-04-25 (session 15)  
**Stack:** Next.js 14 · Supabase · Firebase Cloud Messaging · React Native/Expo · TypeScript

---

## Current Sprint

**Sprint 9 — OTP Phone Verification — COMPLETE**  
Firebase Phone Auth (SMS OTP) fully wired. Citizens must verify phone before SOS. ES256 JWT fix applied to all Edge Functions.

---

## What Is Built

### Sprint 1 — Core Foundation (COMPLETE)
- Supabase project: `jjgdxmtghtnxiuhmfflq.supabase.co`
- All DB tables, triggers, RLS, indexes, enums deployed
- Next.js 14 app initialized at `/app`
- Supabase auth (email), server/client helpers, middleware
- Role-based route guards (`requireRole`)
- TypeScript types: `Profile`, `UserRole`, `Organization`
- Org helpers: `getOrganizations()`, `getOrgMembers()`
- TL dashboard at `/dashboard/tl`
- Admin panel at `/admin`
- Responder dashboard at `/dashboard/responder`
- SOS Edge Function (`dispatch-sos`) — deployed, no-verify-jwt

### Sprint 2A — Dispatch Chain (COMPLETE)

#### 2A-1 through 2A-3 — TL Incident Flow
- TL incident feed at `/dashboard/tl`
- TL incident detail + responder assignment at `/dashboard/tl/incidents/[id]`
- `assignResponder()` server action (assigns + sets status → `assigned`)
- `tl_notified_at` set on SOS dispatch

#### 2A-4 — Responder Status Updates (COMPLETE)
- `updateIncidentStatus()` server action: assigned → accepted → en_route → arrived → resolved
- Responder incident detail at `/dashboard/responder/incidents/[id]`
- Responder active incident shown on `/dashboard/responder`

#### 2A-5 — FCM Push Notifications (COMPLETE)
- Firebase project: `guardian-dispatch-bb292`
- Service account: `firebase-adminsdk-fbsvc@guardian-dispatch-bb292.iam.gserviceaccount.com`
- Next.js FCM helper: `app/app/lib/notifications/fcm.ts` (jose + RS256 JWT)
- Deno FCM helper: `supabase/functions/_shared/fcm.ts`
- `dispatch-sos` sends FCM push to all TLs on new SOS
- `assignResponder` sends FCM push to assigned responder
- **FCM token registration deferred** — needs mobile app built first

#### 2A-6 — Escalation Engine (COMPLETE + VERIFIED END-TO-END)
- Edge Function: `supabase/functions/escalate-incidents/index.ts`
- Secrets set: `ESCALATION_CRON_SECRET=guardian-escalate-2026`, `ESCALATION_TIMEOUT_SECONDS=30`
- pg_cron job `escalate-pending-incidents` fires every minute via `pg_net.http_post`
- SQL migration: `supabase/007_escalation_cron.sql`
- Level 1: `pending → escalated` after timeout (notifies `backup_tl_id`)
- Level 2: `escalated → assigned` after second timeout (auto-assigns nearest on-duty responder via Haversine)
- `escalation_events` table used as audit trail and gate
- **Tested end-to-end:** INC-20260420-0005 escalated and auto-assigned correctly

---

## Known Issues / Deferred Items

- `organizations.backup_tl_id` is NULL on test org — Level 1 escalation fires but no FCM push is sent (audit event still recorded correctly)
  - Fix: `UPDATE organizations SET backup_tl_id = '<tl_user_id>' WHERE name = 'Metro Police Unit 1';`
- FCM push delivery unverified — tokens are NULL until mobile app registers devices
- `citizen_lat` / `citizen_lng` now comes from real device GPS via mobile app ✅ (resolved)
- `citizen_lat` / `citizen_lng` still hardcoded in web test button — expected, web button is dev-only

---

## Supabase Project

| Config | Value |
|---|---|
| Project URL | `https://jjgdxmtghtnxiuhmfflq.supabase.co` |
| Anon Key | In `app/.env.local` |
| Edge Functions | `dispatch-sos`, `escalate-incidents`, `verify-phone` (all deployed with `--no-verify-jwt`) |
| pg_cron job | `escalate-pending-incidents` (every minute) |
| Extensions | `uuid-ossp`, `postgis`, `pg_cron`, `pg_net` |

---

## Firebase Project

| Config | Value |
|---|---|
| Project ID | `guardian-dispatch-bb292` |
| Service account email | `firebase-adminsdk-fbsvc@guardian-dispatch-bb292.iam.gserviceaccount.com` |
| Credentials stored | `app/.env.local` (NEVER commit), Supabase secrets |

---

## Sprint 3 — Mobile App Progress

**Built and bundle-verified:**
- `App.tsx` — auth state listener, role-based navigator (citizen/responder/web-redirect)
- `screens/auth/LoginScreen.tsx` — email/password login
- `screens/citizen/HomeScreen.tsx` — SOS hold-to-activate (2s), animated ring, active incident banner
- `components/EmergencyTypeModal.tsx` — Crime | Medical selection modal
- `screens/citizen/CountdownScreen.tsx` — 3s countdown with GPS capture + dispatch-sos call
- `screens/citizen/ActiveIncidentScreen.tsx` — Realtime incident status tracking
- `screens/responder/DutyScreen.tsx` — duty toggle + active incident display + Realtime subscription
- `screens/responder/IncidentScreen.tsx` — status action button (Accept → En Route → Arrived → Resolve)
- `lib/auth.ts` — signIn, signOut, getSession, getCurrentProfile
- `lib/notifications.ts` — FCM token registration via expo-notifications
- `lib/location.ts` — GPS permission + getCurrentLocation
- `types/index.ts` — Profile, Incident, UserRole, EmergencyType, IncidentStatus types

**Packages added:** `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens`, `react-native-safe-area-context`, `expo-location`, `expo-haptics`, `expo-notifications`

**Confirmed working on real device:**
- Citizen SOS hold → countdown → GPS capture → dispatch → active incident screen ✅
- Responder duty toggle → incident accept → en_route → location broadcast every 5s ✅
- Citizen/TL map shows live responder blue dot via Supabase Realtime ✅
- ETA calculated from Haversine distance (40km/h assumed) ✅
- Tap-to-expand fullscreen map modal ✅

**Bugs fixed this session:**
- `dispatch-sos` Edge Function: replaced unreliable JWKS JWT verification with `adminClient.auth.getUser()` ✅
- `fn_dispatch_sos_atomic` SQL: fixed ambiguous `incident_code` column reference in `RETURNING` clause (migration `010_fix_dispatch_sos_returning.sql` applied via Dashboard SQL Editor) ✅
- `CountdownScreen.tsx`: fixed silent crash when `error.context` is undefined in error handler ✅

**2-Way Resolution Confirmation (completed 2026-04-20):**
- SQL migration `011_citizen_confirmation.sql` applied via Dashboard SQL Editor ✅
  - `pending_citizen_confirmation` added to `incident_status` enum
  - `citizen_confirmed boolean`, `citizen_confirmed_at timestamptz` added to `incidents`
  - `fn_citizen_confirm_resolution(uuid, boolean)` SECURITY DEFINER RPC created
- Responder `IncidentScreen`: "Submit for Confirmation" replaces "Mark Resolved"; 5W incident report modal required before submitting; amber "⏳ Awaiting citizen confirmation..." footer while pending
- Citizen `ActiveIncidentScreen`: amber confirmation card ("Was your emergency handled?") with YES/NO buttons; "Yes" → optimistic UI update to resolved banner immediately
- Citizen `CitizenHistoryScreen`: "✓ Confirmed by you" green badge ✅
- Responder `ResponderHistoryScreen`: "✓ Confirmed by citizen" green badge or "⚠ Not confirmed by citizen" grey badge ✅
- Bug fixed: `pending_citizen_confirmation` missing from all 4 active-status filter arrays — incidents vanished from every view after submission; fixed in `HomeScreen`, `DutyScreen`, `TLDashboardScreen`, `incidents.ts`

**Deferred:**
- Google Maps turn-by-turn navigation (Sprint 3B)
- TL mobile view (TL uses web dashboard)
- Responder decline flow (Sprint 2C per dev plan)
- FCM push delivery: requires EAS Build (not Expo Go) — defer to production build phase

## Sprint 4 — Web Dashboard Rebuild (Session 4, 2026-04-21)

### `/dashboard/tl` — Rebuilt (COMPLETE)

**New components created:**
- `app/app/dashboard/tl/components/TLDashboard.tsx` — Client wrapper; manages all state, Realtime subscription (org-filtered), fetches incidents + resolved stats on every incident change
- `app/app/dashboard/tl/components/StatsRow.tsx` — 4 stat cards: Active Incidents (red), On Duty (emerald), Resolved Today (blue), Avg Response (amber)
- `app/app/dashboard/tl/components/IncidentQueueTable.tsx` — Tabbed table (All / Unassigned / Active / Escalated); escalated badge animates; action = Assign or View link; exports `TLIncident` and `TLResponder` interfaces
- `app/app/dashboard/tl/components/AssignResponderModal.tsx` — On-duty responders sorted by Haversine distance (graceful "unknown" fallback); per-button loading state; calls `assignResponderAction` (returns `{ success, error }`, no redirect)

**Server component (`tl/page.tsx`) rebuilt:**
- 3 parallel queries: incidents (active statuses), responders (id/name/duty/lat/lng), org name
- No `select('*')` — explicit field lists only
- Passes data as props to `TLDashboard`

**Bugs fixed:**
- `server.ts` cookie `set`/`remove` wrapped in try/catch → fixes "Cookies can only be modified in a Server Action or Route Handler" crash
- `assignResponderAction` added to `incident-actions.ts` — same logic as `assignResponder` but returns result instead of redirecting (client modal needs this)

### `/dashboard` — Rebuilt (COMPLETE)

**`app/app/dashboard/page.tsx` rebuilt:**
- Same dark header as TL dashboard (G logo, "Guardian Dispatch", "Emergency Response Platform", Sign Out)
- Welcome section: full name, role badge (styled chip), email
- Role-based action cards:
  - `team_leader` / `super_admin` → TL Dashboard card (red, 🚨)
  - `super_admin` → Admin Panel card (purple, ⚙️)
  - `responder` → Responder Dashboard card (blue, 🚒)
  - `citizen` → SOS Test card
- User ID shown at bottom in small mono text
- Flow: user lands on `/dashboard` → clicks card → goes to `/dashboard/tl`

### `/login` — Premium Rebuild (COMPLETE, Session 5, 2026-04-21)

**Brand identity updated:** App renamed from "Guardian Dispatch" → **"Kandili Response"**

**Files:**
- `app/app/login/page.tsx` — server component: fullscreen video background + dark gradient overlay, passes error prop to LoginCard
- `app/app/login/LoginCard.tsx` — client component with all animations and interactivity

**Features built:**
- **Cinematic video background** — `herovid.mp4` autoplays muted/looped, covers full viewport (`object-cover`)
- **Dark gradient overlay** — `rgba(7,11,24)` at 55–65% opacity, keeps focus on the form
- **4.2s delayed form reveal** — card is invisible on load; after video plays, smoothly fades in + slides up (`opacity 0→1`, `translateY 24px→0`, 700ms ease-out)
- **Glassmorphism card** — `rgba(10,15,30,0.75)` + 14px backdrop blur + cyan border (`22% opacity`) + triple box-shadow (edge ring, outer glow, depth)
- **Logo** — 110px `kandili-logo.png` with soft cyan pulse animation (`logoPulse`, 3.5s ease-in-out, controlled intensity)
- **Scanning line** — thin cyan beam sweeps top→bottom every 6s, gradient fade on both ends, clipped to card via `overflow-hidden`
- **Typography** — "Kandili Response" bold white 22px; tagline cyan 80% opacity, 0.06em letter spacing
- **Input fields** — `rgba(255,255,255,0.06)` fill + cyan border on focus + soft glow ring + inner highlight; smooth 200ms transitions
- **Sign In button** — cyan→blue gradient; 3-state interactions: idle / hover (lift -2px + bright glow) / active (press +1px + dim); 200ms ease
- **Error display** — red card with dark bg, shown when `searchParams.error` is set

**Assets added:**
- `app/public/video/herovid.mp4` — background cinematic video
- `app/public/logo/kandili-logo.png` — Kandili Response logo (transparent background)

**Build status:** ✅ Clean build, `/login` route 7.2 kB

---

## Sprint 5 — Admin Panel (completed 2026-04-21, session 6)

**Decisions:**
- Responders are mobile-only — `/dashboard/responder` NOT rebuilt (not needed)
- Admin panel is the primary web control surface for super_admin

**DB migrations applied:**
- `ALTER TABLE organizations ADD COLUMN logo_url TEXT;`
- `ALTER TABLE profiles ADD COLUMN avatar_url TEXT;`
- Supabase Storage buckets created: `org-logos` (public), `responder-avatars` (public)

**Files created/modified:**
- `app/lib/supabase/admin.ts` — service role client (uses `SUPABASE_SERVICE_ROLE_KEY`)
- `app/lib/types/organization.ts` — fixed to match actual DB columns (`base_lat`, `base_lng`, `coverage_radius_km`, `logo_url`; correct enum: police/medical/fire/rescue)
- `app/lib/types/profile.ts` — added `avatar_url`
- `app/admin/actions.ts` — `createOrganizationAction`, `createMemberAction` (10-responder limit, temp password, image upload)
- `app/admin/layout.tsx` — sidebar layout, auth guards to super_admin only
- `app/admin/page.tsx` — Overview: 4 stat cards + recent incidents table (read-only)
- `app/admin/organizations/page.tsx` — org grid server component
- `app/admin/organizations/[id]/page.tsx` — org detail server component
- `app/admin/components/Sidebar.tsx` — dark sidebar with Overview + Organizations nav
- `app/admin/components/OrgGrid.tsx` — client org grid with Create button
- `app/admin/components/OrgCard.tsx` — org card (logo/initials, type badge, TL name, X/10 badge)
- `app/admin/components/CreateOrgModal.tsx` — org creation modal with logo upload + preview
- `app/admin/components/OrgDetailClient.tsx` — org detail: TL section + responders grid, Add Member button
- `app/admin/components/CreateMemberModal.tsx` — member creation: role toggle, avatar upload (responder), TL priority select
- `app/admin/components/CredentialsModal.tsx` — shows generated credentials with copy button (shown once)

**Build status:** ✅ Clean build, all 13 routes compiled

---

## Sprint 6 — Dashboard Command Center Rebuild + UI Refinement (Session 7, 2026-04-21)

### `/dashboard` — Full Rebuild (COMPLETE)

**Design:** Reference image 2 (table-based command center) — sidebar nav, metric cards, incidents table.  
**Map library:** Leaflet + CartoDB dark tiles (free, no API key) via `react-leaflet`.

**Files modified/created:**
- `app/app/dashboard/page.tsx` — 6 parallel Supabase queries (activeIncidents, enRouteCount, criticalCount, highCount, avgData, incidents) + sequential responder profile fetch; passes all as props
- `app/app/dashboard/DashboardClient.tsx` — complete rewrite: sidebar, sticky header, 3 metric cards, incidents table with View Live
- `app/app/dashboard/ViewLiveModal.tsx` — NEW: Leaflet map modal, real-time responder GPS via Supabase Realtime, Haversine ETA, custom DivIcon markers

**Key features:**
- Fixed sidebar (220px): Kandili logo, role label, role-based nav links (Overview / Incident Center / Admin Panel / Responder Hub)
- Sticky dark header: Command Center title + bell + profile dropdown
- 3 metric cards: Active Incidents (red), Units En Route (blue), Avg Response Time (green)
- Incidents table: Code · Type · Priority · Location · Status · Organization · Responder (read-only name) · Time Ago · View Live
- View Live modal: Leaflet map, red glow dot (incident), blue glow dot (responder), live GPS updates via Supabase Realtime channel, distance km + ETA display, info bar

**Bugs fixed:**
- `Module not found: Can't resolve '@supabase/auth-helpers-nextjs'` in ViewLiveModal — fixed by importing `createClient` from `../lib/supabase/client` (uses `@supabase/ssr`)
- `Type 'Set<any>' can only be iterated through when using '--downlevelIteration'` — fixed by replacing `[...new Set(...)]` with `Array.from(new Set(...))`

**Build status:** ✅ Clean build, `/dashboard` = 7.43 kB

---

### `/dashboard` — UI Refinement Pass (Session 7, 2026-04-21)

**DashboardClient.tsx refined — no layout changes, polish only:**

**Metric cards:**
- Context-aware subtext: "No active alerts" (0 incidents), "Critical: X · High: Y" (active), "No data yet" (no avg response)
- Red pulse-ring keyframe animation on Active Incidents card when `activeIncidents > 0`
- Stronger border contrast (`borderColor}42`), darker card background (`#0B1020`)

**Table:**
- "Created" column replaced with **"Time Ago"** (`timeAgo()` helper: "just now" / "3m ago" / "2h ago" / "1d ago")
- Critical priority badge: breathing pulse animation (`critical-pulse` keyframe)
- Row hover highlight (`dash-row` CSS class, `transition: background 0.12s`)

**View Live button:**
- Hover: lift -1px + cyan glow box-shadow (`view-live-btn` CSS class)

**Sidebar:**
- Logo reduced 30px → 26px, vertically centered with brand name
- Role label (`SUPER ADMIN` / `TEAM LEADER`) moved directly under "Kandili Response" with `paddingLeft: 35` (text-aligned, not icon-aligned)
- Active nav item: 3px left border (was 2px), `rgba(0,229,255,0.12)` background (was 0.10)
- **Bottom user profile card removed entirely** — eliminated duplicate user info

**Header dropdown:**
- Profile trigger now shows first name + email (two lines, cleaner)
- Dropdown now includes: user info header → **Profile** item → **Sign Out** item
- Sign Out removed from sidebar (was duplicated there)

**Build status:** ✅ Clean build, all 13 routes compiled, `/dashboard` = 7.43 kB

---

## Sprint 7 — TL Dashboard Incident Queue Enhancements (Session 8, 2026-04-21)

### Incident Queue — Resolved Panel + PDF Export (COMPLETE)

**Problem solved:** TL queue "All" tab was empty when no active incidents existed. "Resolved Today" tab existed but had no historical data and no export capability.

**Files modified:**
- `app/app/dashboard/tl/components/TLDashboard.tsx` — `fetchResolvedStats` now queries from the 1st of the current month (was today only); derives `resolvedToday` count client-side by filtering returned data
- `app/app/dashboard/tl/components/IncidentQueueTable.tsx` — major enhancements:

**Changes to IncidentQueueTable.tsx:**
- `ResolvedRow` — extracted as a reusable component (used in both All and Resolved Today tabs); includes expandable detail panel with timeline, stats, and structured responder report
- **All tab** — active incidents table (unchanged) + "This Month's Resolved" section below; incidents grouped by date (e.g. "April 21, 2026 — 3 incidents"); each date group is collapsible via chevron; uses `expandedDateGroups: Set<string>` state
- **Resolved Today tab** — now filters `resolvedIncidents` (full month) for today only; same `ResolvedRow` component
- **PDF Export** — `exportIncidentPDF()` function: opens new browser tab with fully formatted HTML report (incident details, timeline, responder report), auto-triggers print dialog for Save as PDF; HTML-escaped to prevent XSS; "↓ Export PDF" button appears in every expanded incident panel
- `resolvedTodayList` derived client-side from full month data; tab badge count updated accordingly

**Architecture decision:** All resolved incidents stored permanently in Supabase `incidents` table — no archiving needed. "All" tab = current month. Past months will be accessible via a future Incident History page.

**Build status:** ✅ Clean build, all 14 routes compiled

---

## Sprint 9 — OTP Phone Verification (Session 10, 2026-04-22)

### Firebase Phone Auth + Supabase Verification Gate (COMPLETE)

**Goal:** Citizens must verify their phone number once before they can use SOS. One phone number per account. Verification uses Firebase Phone Auth (OTP via SMS). Free tier: 10,000 verifications/month.

**DB migration applied (`supabase/013_phone_verification.sql`):**
- `phone_number` made nullable (existing users not blocked at login)
- Replaced blanket UNIQUE constraint with partial unique index — allows NULLs, enforces uniqueness when set
- `phone_verified boolean` column already existed on `profiles`

**Files created/modified:**
- `mobile/lib/firebase.ts` — Firebase app + auth initialization (guarded against double-init); config from `EXPO_PUBLIC_FIREBASE_*` env vars
- `mobile/screens/citizen/PhoneVerificationScreen.tsx` — 2-step screen: enter phone → send OTP via Firebase → enter 6-digit code → confirm → call `verify-phone` Edge Function
- `mobile/App.tsx` — citizens with `phone_verified === false` see `PhoneVerificationScreen` instead of main app; `onVerified` callback updates profile state in-place
- `mobile/types/index.ts` — `Profile` type updated with `phone_number: string | null` and `phone_verified: boolean`
- `supabase/functions/verify-phone/index.ts` — NEW Edge Function: validates Supabase JWT, checks phone format, updates `profiles` with `phone_verified = true`; returns 409 if phone already registered to another account
- `supabase/functions/dispatch-sos/index.ts` — added `phone_verified` gate server-side (double-check even if client bypassed)

**Packages installed:** `firebase`, `expo-firebase-recaptcha`, `react-native-webview`

**Bugs fixed this session:**

1. **`react-native-webview` missing** — `expo-firebase-recaptcha` needs it as a peer dependency but it wasn't auto-installed. Fix: `npm install react-native-webview`.

2. **Edge Function 401 — ES256 JWT unsupported** — Two separate issues compounded:
   - The Supabase Edge Runtime's built-in JWT verifier doesn't support ES256 (used by all new Supabase projects). Fix: deploy all Edge Functions with `--no-verify-jwt`.
   - `adminClient.auth.getUser(token)` pattern also fails with ES256. Fix: switched to user-client pattern — `createClient(URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })` then `userClient.auth.getUser()`. Applied to both `verify-phone` and `dispatch-sos`.

3. **`supabase.functions.invoke` error body not surfaced** — Generic "non-2xx" message hid real errors. Fix: switched to raw `fetch()` call in `PhoneVerificationScreen` which gives access to actual HTTP status + JSON body.

**Deployment note (permanent rule for this project):**
```bash
npx supabase functions deploy <name> --no-verify-jwt
```
All Edge Functions on this project must use `--no-verify-jwt` — the project uses ES256 JWTs which the platform verifier rejects.

**Verified working:** OTP sent via Firebase → 6-digit code entered → status 200 → citizen lands on Home screen ✅

---

## Sprint 8 — Admin Panel Enhancements (Session 9, 2026-04-22)

### Admin Overview Page — Stat Card Additions (COMPLETE)
- Added 5th stat card: **Avg Response Time** (assigned → resolved, today only)
- Displays in human-readable format: "14m" or "1h 6m"; shows "—" if no data

### Remove Organization — Soft Delete + Undo (COMPLETE)
- **`app/app/admin/organizations/actions.ts`** — server action: sets `deleted_at = now()`, `is_active = false`, revalidates `/admin/organizations`
- **`app/app/admin/components/RemoveOrgButton.tsx`** — `'use client'` component with 5-second deferred delete:
  - Clicking "Remove" starts a live "Undo (5s)" amber countdown
  - Clicking undo cancels both timers before server action fires
  - Countdown reaches 0 → `removeOrganization()` fires → org card disappears automatically
  - Timers cleaned up on unmount via `useEffect`
- **`app/app/admin/components/OrgCard.tsx`** — footer updated to flex row: "Open Command" link (flex: 1) + `RemoveOrgButton`

### pg_cron Auto-Close Job (COMPLETE)
- `supabase/012_auto_close_cron.sql` run in Supabase SQL Editor ✅
- Auto-closes incidents that are `resolved` but citizen confirmation never came (configurable timeout)

### CreateOrgModal Type Dropdown Fix (COMPLETE)
- Select options were invisible (white text on white browser-default background)
- Fixed by adding `colorScheme: 'dark'` to `<select>` and explicit `background: '#0B1020', color: 'white'` to each `<option>`

---

## Sprint 10 — Citizen Auth UI Rebuild (COMPLETE — 2026-04-22, sessions 10–12) ✅

**Goal:** Rebuild all 3 citizen auth screens using a shared component library at root `/components/`. All screens design-approved by user.

---

### Architecture decisions

- **NativeWind NOT used** — all styling uses `StyleSheet.create()`. NativeWind className props have no effect in this project (not installed in mobile app). Every component is pure React Native StyleSheet.
- **Shared components live at root `/components/`** — not inside `/mobile`. Metro config must be told to watch the root folder or imports will fail at runtime.
- **`assets/logo.png` must exist at root** — `LogoHeader` uses `require("../assets/logo.png")` which resolves relative to `/components/`. A copy of `mobile/assets/logo.png` was placed at root `assets/logo.png`.
- **Root `tsconfig.json`** — added to resolve IDE TypeScript errors (`react-native` path not found). Maps `react-native` and `react` to `mobile/node_modules/`.

---

### Infrastructure fixes (one-time, permanent)

**`mobile/metro.config.js`** — two additions required for cross-folder imports to work:
```js
config.watchFolders = [rootDir];                        // Metro watches root /components
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];  // resolves react-native from mobile/
```

Without `watchFolders`: `UnableToResolveError` at runtime (Metro doesn't know about root components).  
Without `nodeModulesPaths`: `Unable to resolve "react-native"` from components (Metro looks in root node_modules which doesn't exist).

---

### Components built (root `/components/`)

| Component | Purpose |
|---|---|
| `LogoHeader.tsx` | App logo + colored tagline |
| `AvatarBadge.tsx` | User avatar circle (blue) with red + badge |
| `InputField.tsx` | Glassmorphism input card: label, icon, prefix, helper, TextInput |
| `PrimaryButton.tsx` | Solid red CTA button |
| `TrustCard.tsx` | Privacy/safety card with shield icon, centered layout |

---

### Screens rebuilt (all design-approved ✅)

**`mobile/screens/citizen/CitizenRegisterScreen.tsx`**
- Layout: `LogoHeader → AvatarBadge → title block → 3× InputField → PrimaryButton → helper text → divider → sign in link → TrustCard → staff link`
- Logic preserved: Firebase Phone Auth, `FirebaseRecaptchaVerifierModal`, form validation, `onContinue` / `onSignIn` / `onStaffLogin` props

**`mobile/screens/citizen/CitizenSignInScreen.tsx`**
- Same layout pattern as register screen using identical shared components
- Avatar replaced with 👋 wave icon in blue circle (no `+` badge — returning user context)
- Single InputField (phone only), button text "Send Code"
- Logic preserved: `SecureStore` auto-fill of saved phone, Firebase OTP, `onContinue` / `onRegister` / `onStaffLogin` props

**`mobile/screens/citizen/CitizenOtpScreen.tsx`**
- Clean design — no logo, no decorative elements
- 🔐 icon in red-tinted circle, centered heading + masked phone number
- 6 digit boxes: dark empty state → red border + red tint when filled
- Auto-submits on 6th digit, backspace navigates back through boxes
- 30s resend countdown → "Resend Code" blue link
- Logic preserved: Firebase credential verify, `citizen-auth` Edge Function, Supabase sign-in, `SecureStore` save

---

**`mobile/screens/auth/LoginScreen.tsx`** (rebuilt session 13)
- Layout: logo (160×160) → "Kandili Dispatch" (fontSize 26, bold) → "Emergency Response Platform" subtitle → EMAIL InputField → PASSWORD InputField (secureTextEntry) → PrimaryButton "Sign In" → helper text
- No shield badge, no title block — brand name is the only heading
- `secureTextEntry` prop threaded through `InputField` → `TextInput`
- Logic preserved: `signIn()`, `handleLogin()`, `onLoginSuccess` prop, `canLogin` disabled state, loading ActivityIndicator

---

### UI iteration log (bugs fixed / polish applied)

| Issue | Fix |
|---|---|
| Red background orb (`.pinRed`) on screen | Removed entirely — design had moved on |
| "WeTrack" text block under AvatarBadge | Removed — redundant with title block |
| NativeWind `className` props not working | Rebuilt all 5 components with `StyleSheet` — NativeWind not installed |
| `UnableToResolveError` for LogoHeader | Added `watchFolders = [rootDir]` to `metro.config.js` |
| `Unable to resolve "react-native"` from components | Added `nodeModulesPaths` to `metro.config.js` |
| Logo missing at runtime | Copied `mobile/assets/logo.png` → root `assets/logo.png` |
| IDE TypeScript errors (react-native not found) | Added root `tsconfig.json` with `paths` mapping |
| Visible border line on Continue button | Removed `borderWidth: 1` + `borderColor` from `PrimaryButton` |
| Button not red enough | `backgroundColor: #DC2626` (solid, no shadow/overlay/gradient) |
| Logo appearing horizontally stretched | Reduced to 110×110 then 160×160; `resizeMode="contain"` |
| TrustCard icon/text not centered | Added `alignItems: "center"` to card + `textAlign: "center"` on all text |
| Tagline removed accidentally | Restored as multi-color inline text (see below) |
| Input label visually too dominant | Reduced label to `fontSize: 10`, muted gray; input text to `fontSize: 16`, white |
| `secureTextEntry` prop not wired in InputField | Declared as prop but not passed to TextInput — fixed by adding `secureTextEntry={secureTextEntry}` to TextInput |
| Shield badge on LoginScreen | Removed — only brand block needed |
| "Staff Sign In" title on LoginScreen | Removed — redundant with "Kandili Dispatch" brand name |
| Blue decorative circle (`.pinBlue`) on 3 screens | Removed from LoginScreen, CitizenSignInScreen, CitizenRegisterScreen |

---

### Final component state (session 13)

**`LogoHeader.tsx`**
- Logo: `width: 160, height: 160`, `resizeMode="contain"`
- Tagline: `"One Tap. "` (gray `#94a3b8`) + `"We Track. "` (blue `#3b82f6`) + `"We Respond—Fast."` (red `#DC2626`)
- Font: `fontSize: 14`, `fontWeight: "600"`, centered

**`PrimaryButton.tsx`**
- Pure solid `backgroundColor: #DC2626`, no shadow, no border, no gradient
- Height: `56px`, `borderRadius: 16`, white bold text

**`InputField.tsx`**
- Label: `fontSize: 10`, `color: #4b6a8a` (muted) — visually secondary
- Input text: `fontSize: 16`, `color: #ffffff` — visually dominant
- Helper: `fontSize: 11`, `color: #374d6a` — smallest, lightest

**`TrustCard.tsx`** — fully centered: icon top, title below, description below; `textAlign: "center"` on all

**`AvatarBadge.tsx`** — blue circle with person emoji, absolute-positioned red `+` badge bottom-right

---

---

## Session 14 — Citizen Auth Fixes + Dashboard Fixes (2026-04-24)

### citizen-auth Edge Function — Rewrite (COMPLETE) ✅

**Problem:** Returning citizen with test phone `+639170000001` kept failing OTP screen with cascading errors across 3 attempts.

**Root cause chain:**
1. `admin.auth.admin.listUsers()` only returns 50 users by default — existing accounts not found → tried to recreate → unique constraint on `phone_number` failed
2. Switched to `getUserByEmail()` — **does not exist** in supabase-js v2 → TypeError → Deno returned plain "Internal Server Error" → mobile hit "JSON Parse error: Unexpected character: I"
3. Found user by email but auth user record was missing (orphaned profile) → `signInWithPassword` returned "Invalid login credentials"

**Final fix (`supabase/functions/citizen-auth/index.ts`):**
- Lookup by `profiles.phone_number` first (DB query, not auth API)
- If profile found: call `getUserById(existingProfile.id)` to check auth user exists
- If auth user missing (orphaned state): recreate with same UUID via `createUser({ id: existingProfile.id, ... })`
- If auth user email mismatched: `updateUserById()` to sync it
- New user path unchanged: create auth user + profile
- `full_name` fallback: `full_name?.trim() || phone` (avoids NOT NULL violation when no registrationData)

**Rule clarified:** OTP verification only happens once at registration. Sign-in must not trigger OTP.

---

### Dashboard Fixes (COMPLETE) ✅

**Fix 1 — Admin incident center showed admin's own name as TL:**
- `[orgId]/page.tsx` now fetches all team_leaders for the org (`tl_priority` ordered)
- Derives `onDutyTL = tls.find(t => t.is_on_duty)` and `tlName = onDutyTL?.full_name ?? 'No TL On Duty'`
- Passes real `tlsOnDutyCount` to `TLDashboard`

**Fix 2 — Incident history responder name showed "Unknown":**
- `fetchResolvedStats` query now joins profiles: `responder_profile:profiles!assigned_responder_id(full_name)`
- `ResolvedIncident` type updated with `responder_profile?: { full_name: string } | null`
- `ResolvedRow` uses joined name first: `inc.responder_profile?.full_name ?? responderMap[...] ?? 'Unknown'`
- Cast required: `data as unknown as ResolvedIncident[]` (Supabase infers FK join as array, not object)

**Fix 3 — StatsRow 5th card "Team Leaders On Duty":**
- `StatsRow.tsx` expanded from 4 to 5 cards (sky-blue color scheme)
- Grid changed: `grid-cols-2 lg:grid-cols-5`
- `TLDashboard` tracks count locally; duty toggle adjusts ±1 without page reload
- Both TL's own dashboard and admin view pass real `tlsOnDutyCount`

**Fix 4 — Admin view showed wrong duty status + could toggle TL duty:**
- `[orgId]/page.tsx` was hardcoding `tlIsOnDuty={false}` — fixed to `tlIsOnDuty={!!onDutyTL}`
- Added `readOnly?: boolean` prop to `TLDashboard`
- When `readOnly={true}` (admin view): duty toggle button replaced with non-interactive status badge (same visual, no `onClick`)
- TL's own dashboard unaffected (`readOnly` defaults to `false`)

---

---

## Session 15 — Bug Fixes: Permissions, Cross-Org Transfer, Realtime (2026-04-25)

### Bug 1 — Admin Could Acknowledge Incidents (FIXED) ✅

**Problem:** `acknowledgeTLAction` server action allowed both `team_leader` and `super_admin` roles to acknowledge incidents. Admin should be read-only in the TL incident flow.

**Fixes applied:**
- `app/app/lib/supabase/incident-actions.ts` — role check tightened from `role !== 'team_leader' && role !== 'super_admin'` to `role !== 'team_leader'` only. Admin is now blocked at the server action level.
- `app/app/dashboard/tl/incidents/[id]/page.tsx` — added `userRole` state, fetches current user's role from `profiles` on mount. `canAcknowledge = userRole === 'team_leader'`. Acknowledge button hidden for admin. Acknowledged banner split into its own independent conditional so it still shows when already acknowledged, regardless of viewer role.

---

### Bug 2 — Cross-Org Transfer Context Missing (FIXED) ✅

**Problem:** When the escalation engine transfers an incident to another org, the receiving TL had zero context about why or where it came from.

**Fixes applied:**
- `supabase/014_cross_org_transfer.sql` — NEW migration: adds `original_org_id uuid REFERENCES organizations(id)` and `transfer_reason text` to the `incidents` table. **Must be run manually in Supabase SQL Editor.**
- `app/app/dashboard/tl/incidents/[id]/page.tsx` — `transfer_reason` added to SELECT query and `Incident` type. When `transfer_reason` is set, a purple banner renders above the acknowledge card:
  > ↔ Transferred from [Original Org Name] — no available responders
- Ownership/assignment logic untouched.

---

### Bug 3 — TL Dashboard Infinite Loading (FIXED) ✅

**Problem:** `/dashboard/tl` sometimes entered a permanent loading/skeleton state with no error shown and no way to recover.

**Fixes applied:**
- `app/app/dashboard/tl/error.tsx` — NEW Next.js error boundary for the `/dashboard/tl` route. Shows the error message (or a safe fallback) and a "Try again" button that calls `reset()`. Prevents the page from being silently stuck.

---

### Bug 4 — Realtime Using router.refresh() (FIXED + STABILISED) ✅

**Problem:** `DashboardClient.tsx` used `router.refresh()` inside the Supabase realtime listener. This caused Next.js to re-render the server component, which recreated the router reference, which re-triggered the `useEffect`, causing a re-subscription loop — high CPU, duplicate listeners, possible infinite loop.

**Fix — Phase 1 (remove fetch pattern):**
- Removed `router`, `useRouter`, `fetchLiveIncidents()`, and all Supabase queries from inside the realtime listener.
- Replaced with pure local state updates using `payload.new` / `payload.old`:
  - `UPDATE` → find by `id`, replace row only if `status` changed
  - `INSERT` → prepend if not already in list, cap at 10
  - `DELETE` → filter out by `id`
- Added `liveIncidents` state initialised from server-fetched `incidents` prop.

**Fix — Phase 2 (stabilise subscription):**
- Moved `createClient()` inside the `useEffect` — client is scoped to the effect, not the render cycle.
- Changed dependency array from `[supabase]` to `[]` — effect runs exactly once on mount, never re-subscribes.
- Removed module-level `const supabase = useMemo(() => createClient(), [])` — no longer needed.
- Removed `useMemo` from the React import.
- `orgId` removed from props destructuring (was only used by the deleted fetch). Kept as optional in the type interface since the server still passes it.

**Files changed:** `app/app/dashboard/DashboardClient.tsx`, `app/app/dashboard/page.tsx`

**Result:** Zero API calls in the realtime path. Every status change is instant, in-memory, and loop-free.

---

## Next Steps

1. ~~End-to-end test: Register → OTP → Home flow on real device~~ ✅ verified working
2. Profile screen (mobile app — citizen/responder view + edit)
3. Sprint 3B: Google Maps navigation for responder
4. Responder distance sorting on TL assignment modal — verify with real GPS coordinates
5. Set `backup_tl_id` on test org for Level 1 escalation FCM push
6. Register FCM tokens on real device (requires EAS Build)
7. Production build prep

### Completed (previously listed as pending)
- ✅ Incident History page (`/dashboard/incident-history`) — COMPLETE
- ✅ TL incident detail page rebuild (`/dashboard/tl/incidents/[id]`) — dark theme — COMPLETE

---

## Test Accounts

| Role | Email | Notes |
|---|---|---|
| Super Admin | `admin@guardian.dev` | Created in Supabase Auth |
| Team Leader | `tl@guardian.dev` | Assigned to Metro Police Unit 1 |
| Responder | `responder@guardian.dev` | Assigned to Metro Police Unit 1, is_on_duty=true |
| Citizen | `citizen@guardian.dev` | Used for SOS testing |
