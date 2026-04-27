# STATUS — Guardian Dispatch Platform

**Last Updated:** 2026-04-28 (session 24)  
**Stack:** Next.js 14 · Supabase · Firebase Cloud Messaging · React Native/Expo · TypeScript

---

## Current Sprint

**Sprint 15 (Session 24) — Inline TL Assignment + Status Guards + Dead Code Removal + APK + Vercel Deploy — COMPLETE**  
TL incident detail page now assigns responders inline (no page navigation). Assignment blocked server-side when incident is already in progress. Dead `updateIncidentStatus` function that bypassed citizen confirmation removed. APK build (EAS preview) completed and installed on device. Web deployed to Vercel via GitHub push.

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

## Session 16 — Admin Dashboard Single Source of Truth + Responder Web Page (2026-04-25)

### Admin Dashboard — Single Source of Truth Refactor (COMPLETE) ✅

**Problem:** Admin dashboard metric cards (`liveActiveCount`, `liveEnRouteCount`, `liveCriticalCount`, `liveHighCount`) were separate state from `liveIncidents` array and could diverge when realtime events arrived out of order.

**Fix:**
- Removed 5 separate state variables from `DashboardClient.tsx`; kept only `liveIncidents: Incident[]`
- All metrics now derived: `const activeCount = liveIncidents.filter(...)` — impossible to diverge from the table
- Rewrote realtime `useEffect`: INSERT appends row immediately + async join-fetch to populate org/responder; UPDATE patches row; DELETE removes row — no `router.refresh()`, no re-subscription loop
- Embedded `responder_profile` (with `id`) into `Incident` type — eliminated separate `liveResponders` lookup state
- Simplified `page.tsx`: removed 4 separate COUNT queries, added responder join to incidents select, limit increased 10 → 50
- Exported `Incident` type from `DashboardClient.tsx` for ESLint-safe cast in `page.tsx`

**Bug fixed this change:** `router.refresh()` inside realtime listener was creating a re-subscription loop (high CPU, duplicate listeners). Now zero API calls in the realtime path — all updates are pure in-memory state mutations.

### Responder Incident Detail Page — Full Rebuild (COMPLETE) ✅

**File:** `app/app/dashboard/responder/incidents/[id]/page.tsx`
- Rebuilt as client component with dark theme matching TL incident page
- Realtime subscription on individual incident (`id=eq.{id}` filter)
- Status action buttons: Accept → En Route → Arrived (calls `updateIncidentStatusAction`)
- Arrived state shows "Submit Report →" button which opens 5W incident report form
- Report submission calls `resolveWithReportAction` → sets `pending_citizen_confirmation`, computes `response_time_seconds`, sends FCM push to citizen

**New server actions in `incident-actions.ts`:**
- `updateIncidentStatusAction` — web-responder status transitions (assigned → accepted → en_route → arrived), scoped to `assigned_responder_id = current.userId`
- `resolveWithReportAction` — sets `pending_citizen_confirmation` + notes + response_time_seconds + FCM push to citizen

### Migrations applied

- `supabase/014_cross_org_transfer.sql` ✅ — adds `original_org_id` and `transfer_reason` to incidents table.
- `supabase/015_realtime_replica_identity.sql` ✅ — `ALTER TABLE incidents REPLICA IDENTITY FULL`.

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

---

## Session 17 — Realtime Fixes + Response Time Formula + SOS Duplicate Guard (2026-04-25)

### Bug 1 — All Dashboards Not Reflecting Status Updates in Real Time (FIXED) ✅

**Problem:** After multi-window test (TL, Admin, Responder in separate Chrome windows), all dashboards showed stale statuses after status changes on mobile. INSERT events worked but UPDATE events were not reflected without a manual page refresh.

**Root causes:**
- Migration `015_realtime_replica_identity.sql` was not yet applied — `REPLICA IDENTITY FULL` is required for Supabase Realtime filtered `postgres_changes` subscriptions to receive UPDATE/DELETE events correctly.
- All three dashboards (TL, Admin, Responder) were missing a reconnect-refetch pattern — after a WebSocket disconnect/reconnect, missed events were never caught up.

**Fixes applied:**
- Migration `015` applied (`ALTER TABLE incidents REPLICA IDENTITY FULL`) ✅
- `TLDashboard.tsx` — added reconnect-refetch: `subscribe()` callback calls `fetchIncidents()` + `fetchResolvedStats()` on reconnect (skips first subscribe via `firstSubscribe` flag)
- `app/app/dashboard/responder/incidents/[id]/page.tsx` — same reconnect-refetch pattern added to individual incident subscription
- Admin dashboard — reconnect-refetch added; additionally a **10-second polling fallback** (`setInterval(refetchAll, 10000)`) added to `DashboardClient.tsx` to guard against events silently dropped by Supabase Realtime's RLS evaluation for unfiltered `postgres_changes` subscriptions (admin uses `fn_current_user_role()` SECURITY DEFINER which can fail in the Realtime code path)

**Realtime delay summary after fix:**
| Dashboard | Mechanism | Expected delay |
|---|---|---|
| TL | Filtered WebSocket | 1–3 seconds |
| Responder | Filtered WebSocket | 1–3 seconds |
| Admin | Polling (10s) + WebSocket fallback | 0–10 seconds |

---

### Bug 2 — Admin Dashboard Showing 0 Active Incidents (FIXED) ✅

**Problem:** Admin Overview showed 0 active incidents and empty recent incidents table while TL dashboard correctly showed live data.

**Root cause:** Migration `014` added `original_org_id uuid REFERENCES organizations(id)` — a second FK from `incidents` to `organizations`. PostgREST could no longer resolve the ambiguous `organizations(name)` join expression, returning a silent error.

**Fixes applied (3 files):**
- `app/app/dashboard/page.tsx` — `organizations(name)` → `organizations!organization_id(name)`
- `app/app/dashboard/DashboardClient.tsx` — same fix in `refetchAll()` join
- `app/app/admin/page.tsx` — same fix

---

### Bug 3 — Responder Back Button Infinite Loading Loop (FIXED) ✅

**Problem:** Clicking Back on the responder incident detail page navigated to `/dashboard/responder` which would hang forever in a loading skeleton with no error.

**Root cause:** `getResponderActiveIncident()` had no timeout — if the DB query was slow, the server component waited indefinitely.

**Fix:** `app/app/dashboard/responder/page.tsx` — wrapped the query in `Promise.race([getResponderActiveIncident(...), new Promise(resolve => setTimeout(() => resolve(null), 5000))])`. Page now renders "No active incident" at most 5 seconds later.

---

### Average Response Time Formula — Changed to True Response Time (COMPLETE) ✅

**Problem:** Both TL and Admin showed "Avg Response Time" calculated as `responder_assigned_at → resolved_at` (dispatch-to-close), which is resolution time, not response time.

**Fix:**
- Both dashboards now calculate `created_at → arrived_at` (report to on-scene arrival)
- Only incidents where responder marked **Arrived** (`arrived_at` is not null) are counted
- Subtitle label updated from `"Assigned → resolved"` → `"Report → on scene"` on both dashboards

**Files changed:** `app/app/admin/page.tsx`, `app/app/dashboard/tl/components/TLDashboard.tsx`, `app/app/dashboard/tl/components/StatsRow.tsx`

---

### Bug 4 — Citizen Could Submit New SOS While Incident Was Escalated or Awaiting Confirmation (FIXED) ✅

**Problem:** Citizen with an incident in `escalated` or `pending_citizen_confirmation` status could submit a new SOS, creating a duplicate active incident. The mobile UI guard correctly blocked these statuses, but the backend SQL function and DB unique index did not.

**Root cause:** Both `fn_dispatch_sos_atomic` (application-level check) and `uq_incidents_one_open_per_citizen` unique index only listed 6 statuses: `pending, acknowledged, assigned, accepted, en_route, arrived`. Missing: `escalated`, `pending_citizen_confirmation`.

**Fix — migration `016_fix_sos_duplicate_guard.sql` (applied ✅):**
- Dropped and recreated `uq_incidents_one_open_per_citizen` unique index with all 8 active statuses
- `fn_dispatch_sos_atomic` active-incident check updated to match — all validation logic preserved, only status list expanded

**All 3 layers now consistent:**
| Layer | Statuses covered |
|---|---|
| Mobile UI (`HomeScreen`) | All 8 ✅ |
| SQL function check | All 8 ✅ |
| DB unique index | All 8 ✅ |

---

## Session 19 — Admin Dashboard Enhancements + Org Edit + Access Control (2026-04-26)

### Organization Detail — Edit Support (COMPLETE ✅)

**Files created/modified:**
- `app/app/admin/organizations/actions.ts` — added `updateOrganization()` server action: updates `name`, `coverage_radius_km`, `base_lat`, `base_lng`, `backup_tl_id`; if `primaryTlId` provided, sets that profile to `tl_priority = 1` and demotes all other TLs in the org to `tl_priority = 2`
- `app/app/admin/components/EditOrgModal.tsx` — NEW modal with fields: org name, coverage radius, HQ latitude/longitude (2-column grid), primary TL dropdown, backup TL dropdown; optimistic `onSaved(updated)` callback; validation + error display
- `app/app/admin/components/OrgDetailClient.tsx` — added `liveOrg` state for instant header update after save; `showEditOrg` state + "✎ Edit" button; calls `router.refresh()` after save for full data sync

**Behavior:**
- Edit button opens modal pre-populated with current org values
- Primary TL dropdown initialised from `tl_priority === 1` (falls back to first TL)
- Org header updates instantly on save (optimistic), then server data resyncs
- TLs and responders cannot be removed from this page (by design)

---

### Organization Detail — Duty Status Grouping (COMPLETE ✅)

**Problem:** Org detail page listed all TLs and responders in a flat list with no duty status grouping or visual separation.

**Fix:**
- Added `DutyGroup` sub-component: colored dot + label header (ON DUTY / OFF DUTY), `dimmed` prop at 55% opacity for off-duty group
- TLs split into `tlsOnDuty` / `tlsOffDuty`; responders split into `respondersOnDuty` / `respondersOffDuty`
- On-duty group rendered first at full opacity; off-duty group dimmed below
- `Section` component updated with optional `summary` prop: shows "X on duty · Y off duty"
- `MemberRow` now shows duty status dot + "On Duty" / "Off Duty" label (was missing before)

---

### Access Control — Responders and Citizens Blocked from Web (COMPLETE ✅)

**Problem:** Responders and citizens could access the web dashboard — web is for super_admin and team_leader only.

**Two-layer fix:**
1. `app/app/lib/auth/actions.ts` — `login()` action: after successful auth, fetches profile role; if `responder` or `citizen`, signs them out immediately and redirects to `/login?error=...`
2. `app/app/dashboard/page.tsx` — early redirect for existing sessions: if role is `responder` or `citizen`, redirects to login page (handles users already authenticated before the block was added)

**Error message:** `"Responders and citizens use the Kandili Response mobile app."`

**Bug fixed during this change:**
- First draft used "Guardian Dispatch" in the error message — corrected to "Kandili Response"

---

### Admin Overview — Dashboard Upgrades (COMPLETE ✅)

**Changes to `app/app/dashboard/page.tsx`:**
- Added `resolvedQ` — count query: incidents with `status IN ('resolved', 'closed')` created today
- Added `timelineQ` — selects `created_at, emergency_type` for all incidents in last 24h
- Changed `incQ.limit(50)` → `limit(10)` (recent incidents table now shows last 10 only)
- Builds `hourBuckets[24]` server-side from timeline data (index 0 = oldest hour, 23 = current)
- Builds `typeCounts` (sorted by count desc) from same timeline dataset — one query, two derived values
- Passes `resolvedToday`, `timeline`, `typeCounts` as new props to `DashboardClient`

**Changes to `app/app/dashboard/DashboardClient.tsx`:**
- Added **4th metric card** "Resolved Today" (bright green `#22C55E`, CheckCircle2 icon) — count of today's incidents that are resolved/closed
- Metric card grid changed from `repeat(3, 1fr)` → `repeat(4, 1fr)`
- Added **`ActivityChart`** component: 24 CSS bars (flex layout), height proportional to incident volume, current-hour bar bright cyan, empty bars shown at minimum height; time labels at 24h/18h/12h/6h/Now
- Added **`TypeBreakdown`** component: colored dot per type, count + horizontal progress bar, last 24h scope; types mapped to colors (Crime=blue, Medical=red, Fire=orange, Rescue=green, etc.)
- Insights row layout: `1fr 300px` grid — chart takes remaining space, type panel fixed 300px
- Recent Incidents table subtitle updated: "Last 50" → "Last 10"
- Realtime INSERT handler slice cap: 50 → 10; `refetchAll()` limit: 50 → 10

**Data scope confirmed:**
- TL overview is scoped to their own organization (`organization_id` filter applied for all non-`super_admin` roles across all 4 queries)

**Build status:** ✅ Clean TypeScript check + Next.js build

---

## Session 18 — Mobile Profile Screens + Home Screen Enhancements (2026-04-26)

### Mobile Profile Screens — All 3 Roles (COMPLETE ✅ — design approved)

**Files created:**
- `mobile/screens/citizen/ProfileScreen.tsx`
- `mobile/screens/responder/ResponderProfileScreen.tsx`
- `mobile/screens/tl/TLProfileScreen.tsx`

**Features (all three screens):**
- Avatar upload via `expo-image-picker` → Supabase Storage bucket `avatars` (folder path: `userId/timestamp.ext`)
- Editable full name + email with validation; email change triggers Supabase confirmation email
- Read-only phone number with green "Verified" badge
- Role badge (CITIZEN / RESPONDER / TEAM LEADER) under avatar
- Save button with loading state; alerts for success/email taken/validation errors

**Responder-specific:** duty status indicator banner (ON DUTY / OFF DUTY) with note to toggle from dashboard  
**TL-specific:** ON/OFF duty toggle switch updates `is_on_duty` in DB in real time; TEAM LEADER badge

**Migrations applied ✅:**
- `supabase/017_avatars_bucket.sql` — creates `avatars` public storage bucket
- `supabase/018_avatars_rls_fix.sql` — RLS uses `storage.foldername(name)` for folder-based paths (`userId/timestamp.ext`)

---

### DutyScreen (Responder Home) Enhancements (COMPLETE ✅ — design approved)

**File:** `mobile/screens/responder/DutyScreen.tsx`

**Before:** Header showed "Guardian Dispatch"; no sidebar; emoji standby icon; no org branding  
**After:**
- Header shows real org name + org logo image (from `organizations.logo_url`, Supabase `org-logos` bucket); falls back to letter initial if no logo uploaded
- Hamburger button (top-right) opens slide-in sidebar modal with: centered avatar + full name + role + org name; History link; Profile link; Sign Out button
- Full name greeting: "Good morning / afternoon / evening, [First Name]"
- Professional standby state: Feather `radio` icon in 80×80 indigo circle (no emoji)
- `fetchOrgName()` selects `name, logo_url` from `organizations` on mount

---

### TLDashboardScreen Enhancements (COMPLETE ✅ — design approved)

**File:** `mobile/screens/tl/TLDashboardScreen.tsx`

**Changes this session:**
- Added `orgLogoUrl` state; `fetchOrgName()` updated to select `name, logo_url`
- Header now shows actual org logo image when `logo_url` is set; letter initial badge as fallback
- Sidebar profile section centered (`alignItems: 'center'`, `textAlign: 'center'` on name/org text, avatar bumped 64→72px)

---

### Bug Fix — localhost:3000 Infinite Load (FIXED ✅)

**Problem:** Next.js dev server process (PID 14432) was alive (port LISTENING) but not accepting HTTP connections — `curl` returned exit code 7 (connection refused).  
**Root cause:** Node process crashed internally but stayed resident, holding the port.  
**Fix:** `Stop-Process -Id 14432 -Force` then `npm run dev` restart. Server up in 3.3s; curl confirmed `307` redirect.

---

## Session 20 — Barangay Jurisdiction Matching + Dashboard Fix (2026-04-26)

### Barangay-Based Org Matching — Full Implementation (COMPLETE ✅)

**Problem:** Org jurisdiction was matched purely by PostGIS distance (ST_DWithin radius from `base_location`). No concept of barangay boundaries — a citizen 1km from a station in the wrong barangay could be misrouted.

**New matching flow:**
1. Mobile reverse-geocodes GPS → extracts `r.district` (Expo LocationGeocodedAddress) = barangay name in Philippines
2. Normalized: lowercase, strip "Barangay"/"Brgy." prefix → e.g. `"Brgy. Calumpang"` → `"calumpang"`
3. Sent to edge function as `barangay` field with 2s timeout (non-blocking — falls back to null on timeout)
4. SQL `fn_dispatch_sos_atomic` tries exact barangay match first; if no match, falls back to existing distance query

**Files changed:**
- `supabase/019_barangay_jurisdiction.sql` — NEW migration (applied ✅): adds `organizations.barangay text`, `incidents.citizen_barangay text`; drops old 5-arg `fn_dispatch_sos_atomic`, recreates with 6th param `p_barangay text DEFAULT NULL`; barangay-first matching logic; re-grants to service_role
- `mobile/lib/location.ts` — `reverseGeocode()` now returns "Brgy. X, City" format; new `getBarangay()` function extracts normalized barangay from `r.district`
- `mobile/screens/citizen/CountdownScreen.tsx` — auth token fetch + `getBarangay()` run in parallel (`Promise.all` with 2s race timeout); `barangay` sent in dispatch body
- `supabase/functions/dispatch-sos/index.ts` — accepts `barangay` from body, sanitizes, passes as `p_barangay` to RPC; **redeployed ✅**
- `app/app/lib/types/organization.ts` — added `barangay: string | null`
- `app/app/admin/organizations/actions.ts` — `updateOrganization()` now saves `barangay` (auto-lowercased)
- `app/app/admin/actions.ts` — `createOrganizationAction` saves `barangay` (auto-lowercased)
- `app/app/admin/components/EditOrgModal.tsx` — Barangay input field added with hint text; Field component supports optional `hint` prop
- `app/app/admin/components/CreateOrgModal.tsx` — Barangay input field added

**Fallback chain:**
1. Exact barangay match (primary)
2. PostGIS ST_DWithin radius from `base_location` (fallback — unchanged)

---

### Dashboard By Type — "crime" → "Police" Label Fix (COMPLETE ✅)

**Problem:** DB stores `emergency_type = 'crime'` but mobile displays label "POLICE". By Type chart showed "crime" instead of "Police" and count appeared low because user was comparing 24h count to all-time count.

**Fix:**
- Added `TYPE_LABELS: Record<string, string> = { crime: 'Police' }` constant to `DashboardClient.tsx`
- `TypeBreakdown` now renders `TYPE_LABELS[type] ?? type` — "crime" displays as "Police", all others show capitalized as-is

---

---

## Session 21 — Incident Media Upload + Web Dashboard Media Display (2026-04-27)

### Mobile Media Upload (COMPLETE ✅)

**Problem:** No way for citizens or responders to attach photo/video evidence to incidents.

**Files created/modified:**
- `mobile/lib/media.ts` — `uploadIncidentMedia()` (reads file as base64 → ArrayBuffer, uploads to `incident-media` Supabase Storage, inserts `incident_media` row storing path); `fetchIncidentMedia()` (fetches rows, resolves storage paths to public URLs via `getPublicUrl()`, passes through legacy full-URL rows unchanged)
- `mobile/screens/responder/IncidentScreen.tsx` — "Add Media" button opens `expo-image-picker` (camera or gallery); description modal after pick; uploads via `uploadIncidentMedia()`; shows `AttachedMedia` grid in incident detail
- `mobile/package.json` — added `expo-image-picker`, `base64-arraybuffer`

**Storage:** `incident-media` bucket (public); paths stored as `incidentId/timestamp-random.ext`

**Migrations applied:**
- `supabase/019_barangay_jurisdiction.sql` — already applied
- `supabase/020_incident_media.sql` — creates `incident_media` table with RLS: citizen (own incidents), org TL/responders (same org), super_admin (all)
- `supabase/021_media_bucket_policies.sql` — storage policies for upload/read
- `supabase/022_fix_media_bucket_policies.sql` — **MUST BE APPLIED IN SUPABASE SQL EDITOR** — reverts bucket to `public = true` (migration 021 inadvertently made it private); drops complex JOIN policies; creates simple `authenticated` INSERT + `public` SELECT policies

---

### Web Dashboard Media Display (COMPLETE ✅)

All three web views now show attached media thumbnails when expanding an incident row.

**Pattern used (lazy fetch on expand):** `useEffect` gated on `isExpanded` (or component mount for detail page) fetches `incident_media` only when needed — avoids N+1 queries on page load.

**Files modified:**

**`app/app/dashboard/incident-history/IncidentHistoryClient.tsx`** (`IncidentRow` component):
- Added `useEffect` + `createClient` import
- Added `IncidentMedia` type, `media` state, `lightboxUrl` state
- `useEffect` fetches media when `isExpanded` becomes true; resolves storage paths → public URLs
- Media grid rendered before PDF Export button: photo thumbnails (click → lightbox) + video links + description caption
- Lightbox overlay (full-screen dark modal with click-away dismiss)

**`app/app/dashboard/tl/components/IncidentQueueTable.tsx`** (`ResolvedRow` component):
- Same lazy-fetch pattern added
- Media grid + lightbox added before PDF Export button
- Hydration error fixed: `suppressHydrationWarning` on time-ago `<td>` (server/client render `Date.now()` at different instants → `"23m ago"` vs `"24m ago"`)

**`app/app/dashboard/tl/incidents/[id]/page.tsx`**:
- Added media section: `IncidentMedia` type, `media`/`lightboxUrl` state
- Non-blocking `useEffect` fetches media after main `load()` completes
- Media grid + lightbox rendered in main layout before closing `</main>`

---

### Bugs Fixed This Session

| Bug | Root cause | Fix |
|---|---|---|
| Media not showing on any web dashboard | No media fetch/display code existed in any web component | Added lazy-fetch-on-expand pattern to all 3 locations |
| Admin Incident History still blank after TL fix | `IncidentHistoryClient.tsx` is a completely separate component from `IncidentQueueTable.tsx` — needed same fix independently | Added identical pattern to `IncidentRow` in `IncidentHistoryClient.tsx` |
| Import path wrong in `IncidentQueueTable.tsx` | Used 4 levels up (`../../../../lib/...`) but file is only 3 levels deep (`components/` → `tl/` → `dashboard/` → `app/`) | Corrected to `../../../lib/supabase/client` |
| TypeScript implicit `any` in Supabase `.then()` callback | Destructured `{ data }` had no type annotation | Added explicit type: `.then(({ data }: { data: IncidentMedia[] \| null }) => {` |
| Hydration mismatch: `"23m ago"` vs `"24m ago"` | `getElapsed()` calls `Date.now()` at render; server and client render at different timestamps | `suppressHydrationWarning` on the `<td>` |
| Web images broken (403/404) after migration 021 | Migration 021 set bucket to `private = true` via storage policies; `getPublicUrl()` returns a URL but CDN denies it for private buckets | Migration 022 reverts bucket to `public = true` |

---

## Session 22 — Media History + Video Limits + Bug Fixes (2026-04-27)

### History Screens — Media Attachments (COMPLETE ✅)

**Problem:** All three history screens (Citizen, Responder, TL) showed resolved incident cards as static/read-only. Attached photos and videos could not be viewed.

**Root cause:** `MediaGallery` component was never added to history screen cards. It was only wired into active incident views.

**Files modified:**
- `mobile/screens/citizen/CitizenHistoryScreen.tsx` — added `MediaGallery` import + `<MediaGallery incidentId={item.id} />` after citizen confirmation badge
- `mobile/screens/tl/TLHistoryScreen.tsx` — same
- `mobile/screens/responder/ResponderHistoryScreen.tsx` — same

---

### Video Duration Limits (COMPLETE ✅)

**Changes to `mobile/components/MediaCaptureModal.tsx`:**
- `videoMaxDuration` changed 30 → 20 (best-effort hint to native camera; Android may exceed this)
- **Minimum 7 seconds enforced:** if `asset.duration < 7000`, alert shown and capture rejected
- **No hard maximum rejection** — preserving evidence takes priority over enforcing exact duration; 20s is best-effort only
- UI labels updated to "7 – 20 seconds" in both the choose-stage button and the review-stage preview

---

### Bug Fix — TL Mobile Dashboard Empty After Navigating Back (FIXED ✅)

**Problem:** After a TL acknowledged an incident and pressed Back, the incident queue appeared completely empty.

**Root cause:** `fetchIncidents()` was called only in `useEffect([orgId])` which fires on mount. React Navigation keeps the TL screen mounted while navigating to incident detail, so returning to it does not re-trigger `useEffect`.

**Fix (`mobile/screens/tl/TLDashboardScreen.tsx`):**
- Added `useFocusEffect` from `@react-navigation/native` and `useCallback` to React import
- `useFocusEffect(useCallback(() => { fetchIncidents() }, [orgId]))` placed before the existing `useEffect`
- Now `fetchIncidents()` re-runs every time the screen gains focus, regardless of mount state

---

### Bug Fix — Admin Dashboard Metric Cards Stuck at Zero (FIXED ✅)

**Problem:** On page load, all metric cards (Active Incidents, Units En Route, etc.) showed 0. A manual reload was required to see live data. This regression had been fixed previously but returned.

**Root cause:** The `firstSubscribe` guard in `DashboardClient.tsx` was preventing `refetchAll()` from firing when the Supabase Realtime channel first connected. SSR data initialized the state but any changes between SSR render time and client hydration were invisible until the 10-second poll fired.

**Fix (`app/app/dashboard/DashboardClient.tsx`):**
- Removed `let firstSubscribe = true` variable
- Added `refetchAll()` call immediately after function definition (before channel setup) — syncs any changes that occurred between SSR and hydration
- Subscribe callback changed from `if (firstSubscribe) { firstSubscribe = false; return }; refetchAll()` → `if (status === 'SUBSCRIBED') refetchAll()` — handles reconnects too

---

### MediaGallery Video Lightbox — Fullscreen (COMPLETE ✅)

**Problem:** Videos played in a small box because `lightboxVideoWrap` used `aspectRatio: 16/9`. Phone cameras record in portrait (9:16), so portrait videos only used a fraction of the available space.

**Fix (`mobile/components/MediaGallery.tsx`):**
- `lightboxVideoWrap`: removed `aspectRatio: 16/9`; replaced with `flex: 1` — video wrapper now fills the full screen height
- `lightboxImage`: changed `height: '75%'` → `flex: 1` — photos also fill the full available space
- `lightbox` container: changed `justifyContent: 'center'` → `justifyContent: 'flex-start'` — video fills from top
- `ResizeMode.CONTAIN` ensures video stays letterboxed within bounds (no cropping)

---

## Session 23 — APK Maps Fix + FCM Confirmed + Security + 30s Reminder (2026-04-27)

### TL Incident Detail Screen — Maps Crash Fixed (COMPLETE ✅)

**Problem:** `react-native-maps` `MapView` crashed on production APK when TL opened incident detail. Worked in Expo Go (uses Expo's own fallback key) but crashed in EAS builds.

**Root cause:** `android.config.googleMaps.apiKey` was missing from `mobile/app.json`. Maps SDK for Android requires an explicit API key in the APK manifest.

**Fix:**
- Added `android.config.googleMaps.apiKey` to `mobile/app.json` with key `AIzaSyDpuJbk-bFwo-Zee4nWoa561YBhrhcPyYI`
- Rebuilt APK via EAS — user confirmed maps working on physical device ✅
- Also required: Maps SDK for Android enabled in Google Cloud Console → APIs & Services → Library

---

### FCM Push Notifications — Confirmed Working on Physical Device (COMPLETE ✅)

**Test flow:** Citizen sends SOS → app closed (swiped from recents) → push notification arrived in Android notification tray: "New CRIME SOS — Incident INC-20260427-0051 requires immediate response" ✅

**Confirmed:** FCM token registration, `dispatch-sos` Edge Function FCM send path, and system-level push delivery all working end-to-end on real hardware.

---

### Security — Google Maps API Key Moved to EAS Env Var (COMPLETE ✅)

**Problem:** API key `AIzaSyDpuJbk-bFwo-Zee4nWoa561YBhrhcPyYI` was committed to `mobile/app.json` and pushed to GitHub.

**Fixes:**
- Created `mobile/app.config.js` — reads `process.env.GOOGLE_MAPS_API_KEY` at EAS build time; overrides `android.config.googleMaps.apiKey`
- Removed hardcoded key from `mobile/app.json`
- Set `GOOGLE_MAPS_API_KEY` as EAS sensitive env var for both `production` and `preview` environments
- Restricted key in Google Cloud Console: Android apps only, package `com.automateph.guardiandispatch`, SHA-1 fingerprint locked, API restricted to Maps SDK for Android

**Note:** Key remains in git history (prior commit). Restriction in Google Cloud makes it harmless — key only works from signed APK with matching package + SHA-1.

**New APK build required** to pick up `app.config.js` change.

---

### Escalation Engine — 30s FCM Reminder for Unacknowledged SOS (COMPLETE ✅)

**Problem:** If TL cleared the initial FCM notification and the app was closed, no second alert fired until the 60-second escalation to backup TL. A TL could miss the entire primary window with no reminder.

**Fix — added to `supabase/functions/escalate-incidents/index.ts`:**
- New `TL_REMINDER = 30` constant
- New reminder stage runs before Stage 1: finds `status = 'pending'` incidents where `tl_notified_at` is between 30s and 60s ago and no reminder has been sent
- Sends FCM: "⏰ Reminder — SOS Unacknowledged — Incident INC-xxx still needs your response"
- Deduped via `escalation_events` row with `reason = 'tl_reminder_30s'` (fires once per incident maximum)
- Edge Function redeployed ✅

**Full FCM timeline after fix:**
| Time | Action |
|------|--------|
| 0s | Initial FCM → primary TL |
| 30s | Reminder FCM → primary TL (if still pending) |
| 60s | Stage 1: escalate → backup TL FCM |
| 120s | Stage 2: auto-assign nearest responder |
| +45s | Stage 3/4: next responder if no accept |

---

## Session 24 — Inline TL Assignment + Status Guards + Dead Code Removal (2026-04-28)

### TL Incident Detail Page — Inline Responder Assignment (COMPLETE ✅)

**Problem:** "Assign Responder →" button navigated away from the incident detail page to a separate assignment page, disrupting the TL workflow.

**Fix (`app/app/dashboard/tl/incidents/[id]/page.tsx`):**
- Removed redirect-based assignment button
- Added inline `<select>` dropdown showing all org-scoped responders with ON DUTY / OFF DUTY status
- Assign button calls `assignResponderAction` (returns result, no redirect)
- Optimistic local state update: incident row updates to `status: 'assigned'` immediately on success
- Inline success/error feedback message shown below the dropdown
- `useTransition` used for `assignPending` state — UI stays responsive during server action
- `isAssignable` logic expanded: now `!ASSIGN_BLOCKED.includes(status)` — allows re-assignment when `assigned` or `accepted` (responder hasn't moved yet)
- Responders loaded from DB scoped to TL's `organization_id`

---

### Assignment Status Guards — Pre-flight Check (COMPLETE ✅)

**Problem:** No server-side guard prevented a TL from re-assigning an incident already in progress (e.g., responder en route or already at scene).

**Fix (`app/app/lib/supabase/incident-actions.ts`):**
- Added `ASSIGN_BLOCKED_STATUSES = ['en_route', 'arrived', 'pending_citizen_confirmation', 'resolved', 'closed']`
- Both `assignResponder` (redirect-based) and `assignResponderAction` (return-based) now pre-fetch incident status and block with an error if status is in the blocked list
- Server and UI guards now consistent — both enforce the same blocked statuses

---

### Dead Code Removal (COMPLETE ✅)

**Problem:** `updateIncidentStatus` function mapped `arrived → resolved` directly, bypassing the 2-way citizen confirmation flow. It was never imported or called anywhere — a live trap for future developers.

**Fix:**
- Deleted `updateIncidentStatus` function (45 lines) from `incident-actions.ts`
- Deleted `STATUS_TRANSITIONS` map (was only used by the deleted function)
- `STATUS_TIMESTAMP_FIELD` and `WEB_STATUS_TRANSITIONS` retained (still used by `updateIncidentStatusAction`)

---

### LiveIncidentMap — Extracted to Separate Component (COMPLETE ✅)

**File created:** `app/app/dashboard/LiveIncidentMap.tsx`
- Split out from `DashboardClient.tsx` into its own file
- Renders Google Maps with `@vis.gl/react-google-maps` `APIProvider` + `Map` + `AdvancedMarker`
- Priority-colored pulsing dot pins for active incidents; blue dot pins for responder positions
- Dark mode map style, legend, active count badge
- Used by admin dashboard for live incident map view

---

### APK Build + Vercel Deploy (COMPLETE ✅)

- EAS preview APK build completed and installed on device ✅
- Web changes pushed to GitHub → Vercel deployment triggered ✅
- Commit: `4db8cb4` — 6 files changed (DashboardClient, LiveIncidentMap, TL incidents/[id], incident-actions, package.json, package-lock.json)

---

## Next Steps

1. Test APK on device — verify inline assignment flow works end-to-end from mobile
2. Production build prep
3. Admin dashboard live incident map (deferred — foundation now in `LiveIncidentMap.tsx`)

### Completed (previously listed as pending)
- ✅ Migration 022 applied — `incident-media` bucket restored to public (session 21)
- ✅ `backup_tl_id` set on test org for Level 1 escalation FCM push
- ✅ `barangay` set on existing orgs via admin panel edit form

### Completed (previously listed as pending)
- ✅ Admin org detail — edit support (name, coverage, TL assignment) — COMPLETE (session 19)
- ✅ Responders/citizens blocked from web dashboard — COMPLETE (session 19)
- ✅ Admin overview — 4th metric card + 24h chart + type breakdown + 10-row table — COMPLETE (session 19)
- ✅ Sprint 3B: Google Maps navigation for responder — `handleNavigate()` gets GPS origin + platform-native deep link — COMPLETE (session 18)
- ✅ Incident History page (`/dashboard/incident-history`) — COMPLETE
- ✅ TL incident detail page rebuild (`/dashboard/tl/incidents/[id]`) — dark theme — COMPLETE
- ✅ Profile screen (mobile — citizen/responder/TL) — COMPLETE (session 18)
- ✅ Migrations 017 + 018 applied — avatars bucket + RLS — COMPLETE (session 18)
- ✅ Admin dashboard refactor — single `liveIncidents` array, all metrics derived — COMPLETE (session 16)
- ✅ Responder distance sorting on TL assignment modal — `haversineKm` + nearest-first sort — COMPLETE (session 4)

---

## Test Accounts

| Role | Email | Notes |
|---|---|---|
| Super Admin | `admin@guardian.dev` | Created in Supabase Auth |
| Team Leader | `tl@guardian.dev` | Assigned to Metro Police Unit 1 |
| Responder | `responder@guardian.dev` | Assigned to Metro Police Unit 1, is_on_duty=true |
| Citizen | `citizen@guardian.dev` | Used for SOS testing |
