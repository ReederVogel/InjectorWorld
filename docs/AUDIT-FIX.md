# injector.world — Audit Fix Plan (2026-06-18)

Full remediation plan for the 39 security + UX/UI findings from the June 2026 audit.
Each phase is self-contained. Run phases in order. Do not skip Phase 1 or 2 before launch.

> **Launch gate:** Phase 1 + Phase 2 must be complete before any real user traffic.
> Phase 3–6 can ship in the first two weeks post-launch.

---

## Summary

| Phase | Name | Findings | Launch-blocking | Est. effort |
|-------|------|----------|-----------------|-------------|
| 1 | Critical Security — IDOR & CSRF | S1 S2 S3 S4 | YES | 2–3 hrs |
| 2 | Auth, Secrets & Rate-limit hardening | S5 S6 S7 S13 S14 | YES | 2–3 hrs |
| 3 | Remaining security cleanup | S8 S9 S10 S11 S12 S15 S16 S17 S18 S19 | No | 3–4 hrs |
| 4 | Critical UX — Dark mode, alt text, dead links | U1 U2 U3 | No (but embarrassing) | 1–2 hrs |
| 5 | High UX — Loading, forms, empty states | U4 U5 U6 U7 U8 U9 | No | 3–4 hrs |
| 6 | Medium + Low UX — Polish pass | U10–U20 | No | 3–4 hrs |

---

## Status tracker

- [ ] Phase 1 — IDOR & CSRF
- [ ] Phase 2 — Auth & Secrets
- [ ] Phase 3 — Security cleanup
- [ ] Phase 4 — Critical UX
- [ ] Phase 5 — High UX
- [ ] Phase 6 — Polish

---

## Phase 1 — Critical Security: IDOR & CSRF

**Findings covered:** S1, S2, S3, S4
**Launch-blocking:** YES — these allow provider A to vandalize provider B's data.

### What gets fixed

**S1 — Dashboard save IDOR** (`app/api/dashboard/save/route.ts`)
Provider-linked user can edit ANY provider's profile by supplying a different `providerId`.
Fix: after extracting `linkedProvider` from JWT, assert that its ID equals the requested `providerId`.
If mismatch → 403. Same pattern for clinic-linked saves.

**S2 — Photo deletion IDOR** (`app/api/dashboard/upload/route.ts`)
Photo-belongs-to-clinic check passes, but the request's `clinicId` body param is never verified
against the authenticated user's `linkedClinic`. Any logged-in provider can delete a competitor's photos.
Fix: compare `body.clinicId` against the user's `linkedClinic` before the isOwned check.

**S3 — Locations IDOR** (`app/api/dashboard/locations/route.ts`)
POST lets a provider set `additionalClinics` to any valid clinic IDs (only existence is checked,
not ownership). A provider can falsely claim affiliation with competitor clinics.
Fix: Validate each proposed clinicId against the user's own `linkedClinic` OR the existing
`additionalClinics` on their provider record that an admin already approved. Reject any ID not
previously approved. Add a TODO comment noting that a proper clinic-staff approval flow is Phase N.

**S4 — CSRF on upload/delete** (`app/api/dashboard/upload/route.ts`)
`checkOrigin()` returns `true` when Origin header is absent (server-to-server calls),
meaning a cross-site form POST with no Origin header bypasses the check.
Fix: treat null/missing Origin as REJECTED (not trusted). Add an explicit check:
`if (!origin) return 403`. Also ensure the auth cookie is `SameSite=Strict` in Payload config.

### Files to change
- `app/api/dashboard/save/route.ts`
- `app/api/dashboard/upload/route.ts`
- `app/api/dashboard/locations/route.ts`
- `lib/csrf.ts` (or wherever `checkOrigin` lives — tighten the null-origin path)
- `payload.config.ts` (cookie SameSite setting if not already Strict)

---

### Phase 1 — Implementation prompt

```
Fix 4 critical security vulnerabilities in the injectors.world Next.js + Payload CMS project
at C:\Users\risha\injectors.world. Do NOT commit, push, or create branches. Edit files only.

Read these files before touching anything:
- app/api/dashboard/save/route.ts
- app/api/dashboard/upload/route.ts
- app/api/dashboard/locations/route.ts
- lib/csrf.ts (or wherever checkOrigin is defined — search if needed)
- payload.config.ts

Then apply all four fixes below. Run `npx tsc --noEmit` after all edits to verify no type errors.

--- FIX S1: Dashboard save IDOR ---
In app/api/dashboard/save/route.ts, after the user is authenticated and `linkedProvider` is
extracted from the user object, add an ownership check BEFORE the payload.update() call:

  const linkedProviderId = typeof user.linkedProvider === 'object'
    ? Number(user.linkedProvider?.id)
    : Number(user.linkedProvider)
  if (!linkedProviderId || linkedProviderId !== providerId) {
    return NextResponse.json({ error: 'Not authorized to edit this profile.' }, { status: 403 })
  }

Do the same for clinic saves: compare `linkedClinic` against the incoming clinicId.
Reject with 403 if they don't match.

--- FIX S2: Photo deletion IDOR ---
In app/api/dashboard/upload/route.ts, in the DELETE handler, BEFORE the isOwned check,
add a clinic ownership check:

  const linkedClinicId = typeof user.linkedClinic === 'object'
    ? Number(user.linkedClinic?.id)
    : Number(user.linkedClinic)
  const requestedClinicId = Number(body.clinicId ?? body.clinic)
  if (!linkedClinicId || linkedClinicId !== requestedClinicId) {
    return NextResponse.json({ error: 'Not authorized to manage this clinic.' }, { status: 403 })
  }

Place this check BEFORE checking photo ownership, not after.

--- FIX S3: Locations IDOR ---
In app/api/dashboard/locations/route.ts, in the POST/PUT handler where additionalClinics are
validated, restrict which clinic IDs a provider can claim:

  const linkedClinicId = typeof user.linkedClinic === 'object'
    ? Number(user.linkedClinic?.id)
    : Number(user.linkedClinic)

  for (const id of proposedClinicIds) {
    if (Number(id) !== linkedClinicId) {
      return NextResponse.json(
        { error: `Clinic ${id} is not approved for your account. Contact support to add locations.` },
        { status: 403 }
      )
    }
  }

Add a comment: "// Full multi-clinic staff approval flow is planned for a later phase."

--- FIX S4: CSRF null-Origin bypass ---
Find the checkOrigin function (likely in lib/csrf.ts or inline in the upload route).
Change it so that a null or missing Origin header is REJECTED, not trusted:

  function checkOrigin(req: Request): boolean {
    const origin = req.headers.get('origin')
    if (!origin) return false  // <-- was: return true. Change to false.
    const allowed = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    return origin === allowed || origin.startsWith('http://localhost')
  }

Also check payload.config.ts for the cookie config. If there is a `cookie` or `csrf` config block,
ensure the auth cookie uses SameSite: 'Strict'. If Payload handles this via its built-in config,
look for `cookiePrefix` or similar and add if missing. Do not break the existing auth flow.

After all edits, run: npx tsc --noEmit
Fix any type errors before reporting done.
Report: which files were changed, what exact lines were modified, and tsc output.
```

---

## Phase 2 — Auth, Secrets & Rate-limit Hardening

**Findings covered:** S5, S6, S7, S13, S14
**Launch-blocking:** YES — S14 (ADMIN_EMAIL fallback) leaks PII immediately; S7 exposes provider accounts.

### What gets fixed

**S14 — ADMIN_EMAIL fallback** (`app/api/bookings/route.ts`)
If `ADMIN_EMAIL` env var is unset, booking emails go to `admin@injector.world`. Anyone who owns
that mailbox receives patient PII. Fix: throw a startup error if the env var is missing in production.

**S7 — Temp password in logs** (`collections/Claims.ts`)
On claim approval, a temp password is generated and set on the new user. Payload logs the create
payload, exposing the plaintext password. Fix: generate a cryptographically random one-time setup
token, store its hash on the user record (or a separate collection), and email the claim link.
For now (no email in v1), generate the token and store it + expiry in a `setupToken` / `setupTokenExpiry`
field on Users. Admin can then copy-paste the link. This avoids the password ever appearing in the Payload create log.

**S5 — Newsletter confirm token in URL** (`app/api/newsletter/subscribe/route.ts`, `confirm/route.ts`)
Tokens in query strings appear in server logs and browser history. Fix: keep tokens in the URL
(unavoidable for email links) but ensure the confirm endpoint is POST-only after the GET redirect
(i.e., show a "Confirm subscription" page that POSTs the token, not a direct GET confirm).
This is the standard double-opt-in pattern. Immediate fix: at minimum, add `Referrer-Policy: no-referrer`
header on the confirm response so the token doesn't leak via referrer to any third-party assets.

**S13 — Newsletter tokens never expire** (`collections/Subscribers.ts`)
Add a `confirmTokenExpiresAt` DateTime field to the Subscribers collection (default: now + 7 days).
In the confirm route, check `confirmTokenExpiresAt > new Date()` and return 400/expired if stale.
In the subscribe route, set `confirmTokenExpiresAt` to 7 days from now on each subscribe.

**S6 — In-memory rate limiter** (`lib/rate-limit.ts`)
The in-memory Map is already noted as a known limitation. Fix for now: add a prominent comment
block at the top of `lib/rate-limit.ts` warning that this MUST be migrated to Redis before
horizontal scaling (more than one process/instance). Also add a `RATE_LIMIT_STORE=memory` env
variable hook so a future Redis implementation can be swapped in via env. No functional change
needed yet — just document clearly.

### Files to change
- `app/api/bookings/route.ts`
- `collections/Claims.ts`
- `collections/Users.ts` (add setupToken + setupTokenExpiry fields)
- `collections/Subscribers.ts` (add confirmTokenExpiresAt field)
- `app/api/newsletter/subscribe/route.ts`
- `app/api/newsletter/confirm/route.ts`
- `lib/rate-limit.ts`

---

### Phase 2 — Implementation prompt

```
Fix 5 auth/secrets/rate-limiting vulnerabilities in injectors.world at C:\Users\risha\injectors.world.
Do NOT commit, push, or create branches. Edit files only.

Read these files first:
- app/api/bookings/route.ts
- collections/Claims.ts
- collections/Users.ts
- collections/Subscribers.ts
- app/api/newsletter/subscribe/route.ts
- app/api/newsletter/confirm/route.ts
- lib/rate-limit.ts

Then apply all fixes. Run `npx tsc --noEmit` after all edits. If schema changes are needed
(new fields on collections), also run `npm run generate:types` and verify it passes.

--- FIX S14: ADMIN_EMAIL fail-fast ---
In app/api/bookings/route.ts, near the top where ADMIN_EMAIL is read, change the fallback:

  BEFORE: process.env.ADMIN_EMAIL || 'admin@injector.world'
  AFTER:
    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail && process.env.NODE_ENV === 'production') {
      console.error('[FATAL] ADMIN_EMAIL env var is not set. Booking emails will not be sent.')
    }
    const toAdmin = adminEmail ?? 'admin@injector.world'

Do NOT throw — the booking should still save. Just log the error loudly.
Also add ADMIN_EMAIL to the list of required env vars in any .env.example or README if it exists.

--- FIX S7: Temp password exposure ---
In collections/Claims.ts, in the afterChange hook where a user is created on claim approval:

1. Instead of generating a temp password and assigning it, generate a setup token:
     const setupToken = crypto.randomBytes(32).toString('hex')
     const setupTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

2. Add `setupToken` and `setupTokenExpiry` fields to collections/Users.ts (admin-only, hidden
   from provider-facing forms):
     { name: 'setupToken', type: 'text', admin: { readOnly: true, description: 'One-time account setup token.' } },
     { name: 'setupTokenExpiry', type: 'date', admin: { readOnly: true } },

3. Create the user with a random secure password (not logged by wrapping in a try):
     const tempPassword = crypto.randomBytes(16).toString('base64url') + 'Aa1!'
   But also set setupToken + setupTokenExpiry on the user record.

4. Add an admin-visible `setupLink` virtual or description in Claims.ts afterChange that logs
   (console.log only — no Payload field):
     console.log(`[CLAIM APPROVED] Setup link: ${process.env.NEXT_PUBLIC_SITE_URL}/setup-account?token=${setupToken}`)
   This appears in server logs (not Payload UI) so the admin can copy it. The temp password
   never appears in any log.

5. Run npm run generate:types after schema changes.

--- FIX S5: Newsletter token referrer leak ---
In app/api/newsletter/confirm/route.ts, add a Referrer-Policy header to all responses:

  return NextResponse.redirect(url, {
    headers: { 'Referrer-Policy': 'no-referrer' }
  })

Do this for ALL response paths in the confirm route (success, error, already-confirmed, expired).
This prevents the token from leaking via the Referer header to any third-party assets on the
redirect target page.

--- FIX S13: Newsletter token expiry ---
In collections/Subscribers.ts, add a new field after confirmToken:
  {
    name: 'confirmTokenExpiresAt',
    type: 'date',
    admin: { readOnly: true, description: 'Token expires 7 days after subscribe.' },
  }

In app/api/newsletter/subscribe/route.ts, when writing the subscriber, add:
  confirmTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

In app/api/newsletter/confirm/route.ts, after finding the subscriber by token, add:
  if (!subscriber.confirmTokenExpiresAt || new Date(subscriber.confirmTokenExpiresAt) < new Date()) {
    return NextResponse.redirect(`${siteUrl}/newsletter/expired`)
  }
If that redirect page doesn't exist yet, redirect to `${siteUrl}/?newsletter=expired` instead.

Run npm run generate:types after collection changes.

--- FIX S6: Rate limiter documentation ---
In lib/rate-limit.ts, add at the very top of the file (after imports, before the class/function):

  /*
   * SCALING WARNING: This rate limiter uses an in-memory Map.
   * It resets on every process restart and is NOT shared across instances.
   * Before running more than one server process (horizontal scaling on DO / Railway),
   * replace this implementation with a Redis-backed store.
   * Env hook: set RATE_LIMIT_STORE=redis and implement the Redis adapter.
   * Current store: RATE_LIMIT_STORE=memory (default)
   */

After all edits, run: npx tsc --noEmit and npm run generate:types (if schema changed).
Report: files changed, exact lines modified, tsc output.
```

---

## Phase 3 — Remaining Security Cleanup

**Findings covered:** S8, S9, S10, S11, S12, S15, S16, S17, S18, S19
**Launch-blocking:** No, but fix within the first week after launch.

### What gets fixed

- **S8** — Standardize admin vs. editor role checks. Create a `requireRole(user, ['admin'])` and
  `requireRole(user, ['admin','editor'])` helper in `lib/auth-guards.ts` and replace all inline role
  checks across API routes.
- **S9** — `backupDatabase()` return value: strip the pre-signed URL before returning it to the caller.
  The backup route should log the URL server-side only and never include it in the JSON response.
- **S10** — Newsletter broadcast: add a hard cap (e.g., 500 recipients per broadcast call) and
  document that large sends need a job queue. Not implementing a queue now — just guard the limit.
- **S11** — `NEXT_PUBLIC_SITE_URL` redirect: add a startup assertion that the value starts with
  `https://injector.world` in production. Log a warning otherwise.
- **S12** — Audit all `overrideAccess: true` calls in dashboard routes. Document each one with a
  comment explaining WHY it's needed. Remove any `overrideAccess: true` that isn't actually necessary.
- **S15** — Email header injection: in `app/api/bookings/route.ts`, strip `\r\n` from ALL string
  fields that go into email headers (message, treatmentTag, preferredDate, etc.), not just firstName.
- **S16** — Claims enumeration: return a generic 200 response even when the target doesn't exist
  (log the 404 internally but don't surface it to the requester).
- **S17** — lat/lng SQL: add an assertion in `lib/search-sql.ts` that both values are finite numbers
  before interpolating. Throw if not.
- **S18** — CSV import: add a 50,000-row limit check after parsing. Return 400 if exceeded.
- **S19** — Signup timing: low priority, no code change needed. Mark as acknowledged.

---

### Phase 3 — Implementation prompt

```
Fix 10 medium/low security issues in injectors.world at C:\Users\risha\injectors.world.
Do NOT commit, push, or create branches. Edit files only.

Read these files first (glob if needed):
- app/api/admin/ (all route.ts files)
- app/api/bookings/route.ts
- app/api/claims/route.ts
- app/api/newsletter/broadcast/route.ts
- lib/search-sql.ts
- lib/backup.ts (or wherever backupDatabase() is defined — search if needed)
- app/api/admin/import/route.ts

Then apply all fixes below. Run `npx tsc --noEmit` at the end.

--- S8: Standardize role guards ---
Create lib/auth-guards.ts with two exported helpers:

  import { NextResponse } from 'next/server'
  export function requireAdmin(user: any) {
    if (!user || user.role !== 'admin')
      return NextResponse.json({ error: 'Admin only.' }, { status: 403 })
    return null
  }
  export function requireAdminOrEditor(user: any) {
    if (!user || !['admin','editor'].includes(user.role))
      return NextResponse.json({ error: 'Admin or editor only.' }, { status: 403 })
    return null
  }

Replace all inline role checks in app/api/admin/* routes with these helpers.
For destructive routes (wipe, backup), use requireAdmin(). For read/import routes, requireAdminOrEditor().

--- S9: Strip backup URL from response ---
Find the backup route (app/api/admin/backup/route.ts). In the success response JSON,
ensure the pre-signed R2 URL is NOT returned to the client. Only return:
  { success: true, filename: '...', size: ..., timestamp: '...' }
Log the URL server-side with console.log('[BACKUP]', r2Url) before discarding it.

--- S10: Broadcast recipient cap ---
In app/api/admin/newsletter/broadcast/route.ts, after fetching the subscriber list,
add a guard:
  if (subscribers.length > 500) {
    return NextResponse.json(
      { error: 'Batch too large. Max 500 recipients per broadcast call. Use multiple calls for larger sends.' },
      { status: 400 }
    )
  }

--- S11: Site URL validation ---
In app/api/newsletter/confirm/route.ts and app/api/newsletter/subscribe/route.ts,
at the top where siteUrl is read, add:
  if (process.env.NODE_ENV === 'production') {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
    if (!siteUrl.startsWith('https://injector.world')) {
      console.error('[SECURITY] NEXT_PUBLIC_SITE_URL is not set to injector.world. Redirects may be unsafe.')
    }
  }

--- S12: Document overrideAccess usage ---
Search for all `overrideAccess: true` in app/api/dashboard/. For each instance, add a
one-line comment above explaining WHY it is necessary, e.g.:
  // overrideAccess: true — provider role has no update permission on Media collection;
  // ownership is enforced by the linkedClinic check above.
Remove any overrideAccess: true that is NOT necessary (test that the operation still works without it).

--- S15: Email header injection ---
In app/api/bookings/route.ts, create a sanitize helper and apply it to all fields that
appear in email subject lines or headers:
  const sanitize = (s: string) => (s ?? '').replace(/[\r\n\t]/g, ' ').trim()
Apply sanitize() to: firstName, lastName, email, message, treatmentTag, preferredDate,
providerName — any string that appears in the email content or subject.

--- S16: Claims enumeration ---
In app/api/claims/route.ts, when the target provider/clinic is not found (currently returns 404),
change to return 200 with a generic message:
  return NextResponse.json({ success: true, message: 'If a matching profile was found, your claim has been submitted.' })
Log the actual status internally with console.log.

--- S17: lat/lng SQL assertion ---
In lib/search-sql.ts, before any lat/lng interpolation into SQL strings, add:
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`Invalid coordinates: lat=${lat} lng=${lng}`)
  }
Add a comment: // Interpolated directly into SQL — must be validated numbers, never raw user strings.

--- S18: CSV row limit ---
In app/api/admin/import/route.ts, after parsing the CSV rows array, add:
  if (rows.length > 50000) {
    return NextResponse.json({ error: 'CSV too large. Max 50,000 rows per import.' }, { status: 400 })
  }

After all edits: npx tsc --noEmit. Report files changed and tsc output.
```

---

## Phase 4 — Critical UX: Dark Mode, Alt Text, Dead Links

**Findings covered:** U1, U2, U3
**Launch-blocking:** No, but these are immediately visible to users and hurt trust.

### What gets fixed

- **U1** — Footer dark mode: Footer uses `bg-[#0B1B34] text-white` which is correct per CLAUDE.md
  (always-dark section). But verify that in actual dark mode, the surrounding page context doesn't
  make the footer disappear. If the footer already follows the "always-dark section" pattern from
  CLAUDE.md, this may already be correct — verify first before changing.
- **U2** — Alt text: Audit all `<Image>` components across the codebase. Any with `alt=""` or
  `alt={undefined}` must get a descriptive alt. Profile photos: `alt={provider.fullName}`.
  Decorative images: `alt=""` is correct only for truly decorative images (not content images).
- **U3** — Footer social links: Replace `href="#"` with real URLs or hide the icons entirely if
  social accounts don't exist yet. Do not show broken links.

---

### Phase 4 — Implementation prompt

```
Fix 3 critical UX issues in injectors.world at C:\Users\risha\injectors.world.
Do NOT commit, push, or create branches. Edit files only.

Read these files first:
- components/footer/Footer.tsx
- app/globals.css (for dark mode token definitions)
- Search for all <Image with alt="" or alt={undefined} across components/

Then apply all fixes.

--- U1: Footer dark mode verification ---
Read components/footer/Footer.tsx fully.
Check: does the footer use bg-[#0B1B34] text-white? Per CLAUDE.md, this is the CORRECT pattern
for always-dark sections. In dark mode, bg-[#0B1B34] stays dark navy (it's a literal hex, not a
CSS variable), so it is fine.
Only make a change if you find any text inside the footer that uses a CSS variable that would
make it invisible in dark mode (e.g., text-ink-primary which becomes near-white in dark mode on
an already-dark background). Fix those specific elements only.
Report what you found and whether a change was needed.

--- U2: Alt text audit ---
Search the entire components/ and app/ directory for:
  1. <Image ... alt="" ... (empty alt on non-decorative images)
  2. <Image without any alt prop at all
  3. <img tags (non-Next.js) without alt

For each non-decorative image (provider photos, clinic photos, guide images, carousel images):
  - Provider photo: alt={`${provider.name || provider.fullName}, ${provider.credentials || 'Provider'}`}
  - Clinic photo: alt={`${clinic.name} — ${clinic.city || ''}`}
  - Guide hero/thumbnail: alt={guide.title || 'Guide image'}
  - Carousel item: alt={item.alt || item.title || 'Image'}

For purely decorative images (background textures, spacers): alt="" is correct, leave them.
If an image is decorative AND has role="presentation", that's also fine.

Do NOT change alt text that is already correct and descriptive.

--- U3: Footer social links ---
Read components/footer/Footer.tsx.
Find all href="#" on social media icon links.

Option A (preferred): Replace with real URLs from CLAUDE.md or any social handles defined
in the project. Check if social handles are in any config file or env var.

Option B (if no real URLs exist): Remove the social icon links entirely and add a TODO comment:
  {/* Social links — add real URLs when accounts are created */}
  Do NOT show broken href="#" links to users.

Choose Option A if URLs exist anywhere in the codebase, Option B if they don't.

After edits: npx tsc --noEmit. Report what changed.
```

---

## Phase 5 — High UX: Loading States, Forms, Empty States

**Findings covered:** U4, U5, U6, U7, U8, U9
**Launch-blocking:** No, but noticeably bad UX for real users.

### What gets fixed

- **U4** — Loading skeletons on dashboard and search results (Suspense + skeleton components)
- **U5** — Login/form errors: add `role="alert"` and focus management
- **U6** — Empty states on saved providers/clinics in user profile and dashboard
- **U7** — Hero text responsive sizing: add `lg:` variants for large screens
- **U8** — Focus rings on all buttons (keyboard navigation)
- **U9** — Booking form submit: disable button + show "Submitting..." during POST

---

### Phase 5 — Implementation prompt

```
Fix 6 high-priority UX issues in injectors.world at C:\Users\risha\injectors.world.
Do NOT commit, push, or create branches. Edit files only.

Read these files first:
- components/auth/LoginForm.tsx
- components/dashboard/DashboardForm.tsx
- app/(frontend)/search/page.tsx
- app/(frontend)/profile/page.tsx (or wherever saved providers/clinics are rendered)
- components/booking/BookingForm.tsx
- Search for the Hero component (likely in components/hero/ or components/home/)

Then apply all fixes below.

--- U4: Loading skeletons ---
In components/dashboard/DashboardForm.tsx: if there is an async data fetch, ensure a loading
state is shown. Add a `isLoading` state initialized to true, set to false after data loads.
While isLoading, render a skeleton div:
  <div className="animate-pulse space-y-4">
    <div className="h-10 bg-surface rounded-md w-full" />
    <div className="h-10 bg-surface rounded-md w-2/3" />
    <div className="h-10 bg-surface rounded-md w-full" />
  </div>

In app/(frontend)/search/page.tsx: if results are fetched client-side, show a skeleton grid
of 6 cards while loading. Each skeleton card should be the same height as a real provider card.

--- U5: Accessible form errors ---
In components/auth/LoginForm.tsx (and any other auth/form components):
Find the error display element. Change it to:
  {error && (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-sm border border-state-error/30 bg-state-error/10 p-3 text-sm text-state-error"
    >
      {error}
    </div>
  )}

Also, when an error is set, focus the error element:
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])
  <div ref={errorRef} tabIndex={-1} role="alert" ...>

--- U6: Empty states ---
In the profile page (where savedProviders / savedClinics are rendered):
If the list is empty, show:
  <div className="py-16 text-center">
    <p className="text-ink-secondary body">No saved providers yet.</p>
    <a href="/injectors" className="mt-4 inline-block text-brand-accent hover:underline body-sm">
      Browse providers
    </a>
  </div>

Do the same for savedClinics pointing to /clinics.
In the dashboard, if there are no leads/bookings, show a similar empty state.

--- U7: Hero text responsive sizing ---
Find the Hero component. Find the main heading element.
If it uses className like "text-h2-m md:text-h2" or similar, add a large-screen variant:
  BEFORE: className="text-h2-m md:text-h2"
  AFTER:  className="text-h3 sm:text-h2-m md:text-h2 lg:text-h1"

Check CLAUDE.md type scale to use the correct token names. Do not invent token names.
Only apply this to the primary hero heading, not to sub-headings.

--- U8: Button focus rings ---
Search for all <button and <Button components across components/.
Any button that is missing a focus-visible style, add:
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2
Add this to the base button className in: the primary button variant, the secondary button
variant, and the ghost/link variant. If there is a shared Button component, add it there once
instead of on every usage.

--- U9: Booking submit loading state ---
In components/booking/BookingForm.tsx:
Add a `isSubmitting` state (boolean, default false).
On form submit:
  - Set isSubmitting = true before the fetch call
  - Set isSubmitting = false in the finally block
Change the submit button to:
  <button type="submit" disabled={isSubmitting} className="... disabled:opacity-60 disabled:cursor-not-allowed">
    {isSubmitting ? 'Submitting...' : 'Request Booking'}
  </button>
This prevents double-submit.

After all edits: npx tsc --noEmit. Report what changed.
```

---

## Phase 6 — Medium + Low UX: Polish Pass

**Findings covered:** U10, U11, U12, U13, U14, U15, U16, U17, U18, U19, U20
**Launch-blocking:** No. Ship within the first 2 weeks post-launch.

### What gets fixed

- **U10** — Search results count + "Load more" or pagination UI
- **U11** — Badge contrast audit (brand-accent-soft + brand-primary text)
- **U12** — Breadcrumbs on guide and clinic detail pages
- **U13** — Audit every static page for `export const metadata` with title + description
- **U14** — Provider card photo: replace `fill` with fixed width/height to prevent CLS
- **U15** — Sticky mobile CTA: add `pb-20 sm:pb-0` to the page wrapper to prevent content overlap
- **U16** — Date formatting: remove hardcoded `'en-US'` locale, use `undefined` for auto-detect
- **U17** — Favicon: add `favicon.ico` and `apple-touch-icon.png` to the `app/` directory
- **U18** — Unify loading skeleton design into one reusable `<Skeleton>` component
- **U19** — Footer link hover states: ensure `hover:opacity-80` or `hover:underline` on all links
- **U20** — Booking idempotency: log a warning (no client change needed for v1)

---

### Phase 6 — Implementation prompt

```
Apply a UX polish pass fixing 11 medium/low issues in injectors.world at C:\Users\risha\injectors.world.
Do NOT commit, push, or create branches. Edit files only.

Read these files first:
- app/(frontend)/search/page.tsx
- components/shared/DirectoryProviderCard.tsx
- app/(frontend)/guides/[slug]/page.tsx (or the catch-all page)
- app/(frontend)/clinics/[slug]/page.tsx (or the catch-all page)
- app/(frontend)/contact/page.tsx
- app/(frontend)/pricing/page.tsx (if it exists)
- components/footer/Footer.tsx
- components/ui/StickyMobileCta.tsx (or wherever the sticky CTA is)
- Search for any component that shows dates with toLocaleDateString

Then apply all fixes. Run `npx tsc --noEmit` at the end.

--- U10: Search result count ---
In app/(frontend)/search/page.tsx, above or below the results grid, add a result count line:
  <p className="text-ink-secondary body-sm mb-4">
    {results.length === 0
      ? 'No providers found.'
      : `Showing ${results.length} provider${results.length === 1 ? '' : 's'}`}
  </p>
If results are capped at 100, show: "Showing top 100 results. Refine your search for more."

--- U11: Badge contrast ---
In components/shared/DirectoryProviderCard.tsx, find badges that use bg-brand-accent-soft
with text-brand-primary (or text-ink-primary).
Test: #E6F2EE background with #0B1B34 text gives approximately 10.5:1 contrast — this PASSES WCAG AA.
If the actual values match these, leave them as-is (they're correct).
Only change if the text color used is a lighter gray like text-ink-secondary (#475569 on #E6F2EE
= ~3.8:1 which fails AA for small text). In that case, change to text-ink-primary.

--- U12: Breadcrumbs on detail pages ---
For guide detail pages: add a breadcrumb above the guide title:
  <nav aria-label="Breadcrumb" className="mb-6">
    <ol className="flex items-center gap-2 text-ink-secondary caption">
      <li><a href="/" className="hover:text-ink-primary">Home</a></li>
      <li aria-hidden="true">/</li>
      <li><a href="/guides" className="hover:text-ink-primary">Guides</a></li>
      <li aria-hidden="true">/</li>
      <li className="text-ink-primary" aria-current="page">{guide.title}</li>
    </ol>
  </nav>

For clinic detail pages, same pattern: Home / Clinics / {clinic.name}
For provider profiles: Home / Injectors / {provider.fullName}

Do not change the JSON-LD BreadcrumbList (it should already exist per CLAUDE.md). Only add the visible HTML breadcrumb.

--- U13: Meta tags audit ---
Check every file in app/(frontend)/ that renders a page (contact, pricing, careers, press,
how-we-verify, editorial-standards, medical-advisory, hipaa, etc.) for:
  export const metadata: Metadata = { title: '...', description: '...' }

For any page missing metadata, add it. Keep titles concise (under 60 chars) and descriptions
under 160 chars. Examples:
  - /contact: title: 'Contact Us | injector.world', description: 'Get in touch with the injector.world team.'
  - /pricing: title: 'Provider Plans & Pricing | injector.world', description: 'Simple, transparent pricing for aesthetic providers.'

--- U14: Provider card image CLS fix ---
In components/shared/DirectoryProviderCard.tsx, if the provider photo uses <Image fill>,
change to a fixed-size image within a sized container:
  <div className="relative w-14 h-14 shrink-0 overflow-hidden rounded-full">
    <Image src={photoUrl} alt={provider.fullName} fill className="object-cover" sizes="56px" />
  </div>
The `fill` + explicit sized parent prevents layout shift (the parent div reserves space).
If already done this way, leave it. Only change if fill is used WITHOUT a sized parent.

--- U15: Sticky CTA content overlap ---
Find the page wrapper in the provider profile page (or the layout that wraps content on mobile).
Add bottom padding on mobile to account for the sticky CTA bar height (~72px):
  BEFORE: <main className="...">
  AFTER:  <main className="... pb-20 sm:pb-0">

If StickyMobileCta already has a class or prop that adds bottom padding to the body, verify it works.

--- U16: Date locale ---
Search for toLocaleDateString('en-US' across all components.
Change each to toLocaleDateString(undefined, { ...same options... })
This uses the browser's detected locale instead of hardcoding US format.

--- U17: Favicon ---
Check if app/favicon.ico exists. If not, copy or create a placeholder favicon.
If there is a logo or wordmark SVG/PNG in public/, use it.
In app/layout.tsx, ensure the <head> (or Next.js metadata) includes:
  export const metadata = {
    ...existing metadata...
    icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  }
If no favicon asset exists, create a simple 32x32 navy square as a placeholder ICO — note it
in a TODO comment for the designer.

--- U18: Skeleton component unification ---
Create components/ui/Skeleton.tsx:
  export function Skeleton({ className = '' }: { className?: string }) {
    return <div className={`animate-pulse bg-border-subtle rounded-sm ${className}`} />
  }

Replace any existing inline animate-pulse divs in other components with <Skeleton className="h-10 w-full" /> etc.
This is a cleanup, not a functional change.

--- U19: Footer link hover states ---
In components/footer/Footer.tsx, ensure all <a> and <Link> elements have:
  className="... hover:opacity-80 transition-opacity"
or:
  className="... hover:underline"
Apply consistently to all footer links (nav links, legal links, social links).

--- U20: Booking idempotency note ---
In app/api/bookings/route.ts, add a comment near the create call:
  // TODO: Add idempotency key (e.g., hash of provider+email+date) to prevent duplicate bookings.
  // For now, duplicate submissions create duplicate records — acceptable for v1.
No functional change needed. Just document the known gap.

After all edits: npx tsc --noEmit. Report what changed.
```

---

## Is this enough to launch?

**Yes — with Phase 1 + Phase 2 complete, the site is safe to launch.**

Phase 1 closes the IDOR vulnerabilities that would allow providers to sabotage each other.
Phase 2 ensures no PII leaks via email misconfiguration and no trivially stolen provider accounts.

The remaining phases (3–6) are quality improvements, not safety gates. Ship them in the
first 2 weeks. Phase 3 should be the priority immediately post-launch.

### Pre-launch checklist (add to DONE.md)
- [ ] Phase 1 complete and tsc clean
- [ ] Phase 2 complete and tsc clean
- [ ] ADMIN_EMAIL set in production env
- [ ] NEXT_PUBLIC_SITE_URL set to https://injector.world in production env
- [ ] R2 bucket keys set in production env
- [ ] RESEND_API_KEY set (or email disabled for v1)

---

*Document created: 2026-06-18. Update status tracker above as phases complete.*
