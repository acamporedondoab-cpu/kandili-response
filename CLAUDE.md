# Project Overview

Build a scalable emergency response dispatch platform that digitizes emergency intake, routing, responder assignment, escalation, and incident tracking.

This application must prioritize:
- Speed
- Reliability
- Scalability
- Simplicity
- Clear maintainable code

Each feature should do one job only.
Code must remain modular, readable, and production scalable.

---

# Development Rules

## Rule 1: Always Read First
Before taking any action, always read:

- `CLAUDE.md`
- `project_specs.md`

If either file does not exist, create it before doing anything else.

---

## Rule 2: Define Before Build

Before writing code:

1. Create/update `project_specs.md` including:
   - What feature/module is being built
   - User flow impacted
   - Database/data changes needed
   - API/backend logic needed
   - What "done" means

2. Show file for approval
3. Wait for approval

No code before specs approval.

---

## Rule 3: Look Before Create

Always inspect existing files before creating new ones.
Never duplicate logic/files unnecessarily.

---

## Rule 4: Test Before Responding

After code changes:

- Run build/tests/dev server
- Check browser/app for runtime errors
- Verify feature works end-to-end

Never mark done if untested.

---

## Core Rule

Do exactly what is requested.
Nothing more, nothing less.

If unclear:
Ask follow-up questions until 95% confidence is reached.

Never assume architecture/business logic.

---

# Response Format Rules

Always explain simply like speaking to a beginner.

Every response must include:

- **What I just did**
- **What you need to do**
- **Why**
- **Next Step**
- **Errors/Fixes** (if applicable)

Keep responses concise and practical.

---

# Tech Stack

## Frontend Mobile
- React Native / Expo

## Dashboard / Admin
- Next.js 14

## Language
- TypeScript

## Backend / Database / Auth
- Supabase

## Styling
- Tailwind CSS / NativeWind if applicable

## Notifications
- Firebase Cloud Messaging

## Maps / Routing
- Google Maps API

## Deployment
- Vercel / Expo Deploy / Supabase Hosting

---

# Running Project

1. Ensure `.env.local` has all keys
2. Install dependencies:
npm install

3. Start dev:
npm run dev

4. Mobile preview:
Expo Go / Emulator

---

# File Structure

/app → Next.js web/admin dashboard pages  
/mobile → React Native mobile app  
/components → Shared reusable UI  
/lib → Shared helper functions/services  
/lib/supabase → Supabase client logic  
/lib/maps → Maps/location logic  
/lib/notifications → Push notification logic  
/supabase → SQL schema/migrations  
/public → Static assets  
/project_specs.md → Product blueprint  
/database_schema.md → DB reference  
/api_logic.md → Backend/API docs  

---

# Code Organization Rules

- One component per file
- Keep API routes/controllers thin
- Put business logic in service/helper files
- Keep reusable logic in `/lib`
- No large monolithic files
- Do not create new root folders without approval

---

# Architecture Rules

Always preserve emergency dispatch logic from `project_specs.md`.

Never modify these without approval:

- Jurisdiction matching logic
- Escalation logic
- Incident lifecycle
- Team hierarchy routing
- Assignment flow

---

# Emergency Platform Principles

Always optimize for:

1. Minimal user clicks
2. Fast dispatch flow
3. Mobile-first UX
4. Real-time updates
5. Reliability/failover logic
6. Clear audit trail/logging

Avoid overcomplicated UX.

---

# Backend Principles

Treat all incidents as mission critical.

Always:

- Validate all inputs
- Log all critical actions
- Timestamp all incident changes
- Preserve audit trails
- Design APIs to be idempotent where possible

---

# Security Rules

- Always use RLS
- Never disable RLS
- Never expose service role keys
- Never expose API secrets frontend-side
- Validate auth/roles before actions
- Protect responder/admin endpoints strictly

---

# How App Logic Works

System Flow:

1. Citizen triggers SOS
2. GPS captured
3. Jurisdiction matched
4. Alert routed to TL
5. TL assigns responder
6. Escalation fallback if timeout
7. Responder updates status
8. Incident logged/closed

Never break this flow unless approved.

---

# How to Write Code

- Keep code readable/simple
- Build one feature/module at a time
- Do not over-engineer
- Do not touch unrelated code
- Add console logs for critical backend/API flows

If structural changes needed:
Explain first before implementing.

---

# Testing Rules

Before marking done:

- Run build successfully
- Run dev successfully
- Test happy path
- Test failure/error path
- Test auth/permissions
- Test mobile responsiveness
- Test real-time flows where applicable

Never say done if:

- Build failing
- Errors exist
- Untested

---

# Scope

Only build what is defined in:

`project_specs.md`

If unclear:
Ask before proceeding.