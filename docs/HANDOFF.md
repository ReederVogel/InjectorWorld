# injector.world — Project Handoff

**As of:** 2026-07-26. Last committed version on `main`: `6f8caa5` ("Fix pre-push migration: guard
enum_faqs_scope ALTER for fresh databases"), on top of `98864d0` ("New Version 1 - Staging", which
folded in the claim-flow security hardening previously listed here as uncommitted — it's committed
now). There are **uncommitted local changes** on top of that — see "Uncommitted work" at the bottom.

**A staging environment now exists** — full details in `docs/STAGING.md`. Read it before touching
staging deploy, DB, or env config, same as you would for `docs/DEPLOYMENT-DIGITALOCEAN.md` and prod.

This doc is written for someone picking up the project cold. Read it top to bottom once, then
use it as a reference. It does not replace the other docs — it tells you which ones to read
and in what order.

---

## 1. Read these first, in order

1. **`CLAUDE.md`** (repo root) — the law. Design system, locked decisions, tech stack, brand
   voice, URL structure, git rules. Nothing in this handoff overrides it; if they conflict,
   CLAUDE.md wins and this doc is stale.
2. **`docs/ROADMAP.md`** — phase-by-phase execution plan + a "latest status" banner at the top
   that's kept current.
3. **`docs/DECISIONS.md`** — append-only decision log. Every non-obvious call the founder made,
   with context. Read before changing anything that might contradict a past decision.
4. **`docs/DONE.md`** — the ship gate every phase must pass before it's considered finished.
5. **`docs/STAGING.md`** — the staging environment: two-repo split, DO setup, env vars, every
   gotcha hit setting it up (including a near-miss data-loss incident and the correct fix).
6. This file — day-to-day operational context that doesn't fit the above four.

---

## 2. What this product is

A content-led directory of Botox/aesthetic injectors and clinics (US market, top 20 metros
phase 1). Three ways to find a clinic — by location, by service, or by product brand — all
converging on the same listing UI. Clinics and providers can be "claimed" by their real owners,
who then self-serve edit their profile from a dashboard. That claim flow is the monetization
engine (see §7).

Full positioning, brand voice, and design system are locked in `CLAUDE.md` — don't re-derive
or re-litigate any of it.

---

## 3. Tech stack (locked, do not swap)

| Layer | Choice |
|---|---|
| Frontend | Next.js 15.4.x (App Router) + React 19 |
| CMS | Payload CMS 3.0 |
| Database | PostgreSQL 18 (DigitalOcean Managed, NYC1). PostGIS **not available on this DB tier** — geo/radius search runs degraded (`fatal:false`). |
| Hosting | DigitalOcean App Platform (`starfish-app` / `injectorworld`) |
| Media storage | Cloudflare R2 via `@payloadcms/storage-s3`, bucket `iw-media` (SFO3-style, actually R2). DO Spaces swap is env-only if ever needed. |
| Email | Resend, behind `RESEND_API_KEY` |
| Auth | Payload built-in (bcrypt, JWT httpOnly cookie) |

`"type": "module"` in `package.json` — required for Payload's Node ESM.

---

## 4. Local dev environment

```
npm run dev              Next dev server at localhost:3000
npm run seed              Idempotent mock data seed
npm run build             Migrations -> search indexes -> next build (same chain DO runs)
npm run db:push           Push schema to local DB (needs PAYLOAD_FORCE_PUSH=true NODE_ENV=development --env-file=.env.local)
npm run generate:types    Regenerate payload-types.ts after any collection/field change
npm run generate:importmap  Regenerate admin importmap after adding a new admin component path
```

- Local DB: `postgres://postgres:admin@localhost:5432/injectors_world_dev`
- Admin panel: `http://localhost:3000/admin` — `admin@injectors.world` / `changeme`

**⚠️ Known landmine — local DB is frequently stale/incompatible.** Multiple past sessions found
the local dev DB missing tables the current schema expects (e.g. no `services` table), so
`npm run dev` / `npm run build` fail locally even when the code is fine. `DATABASE_URI` is
**env-dependent** — it can silently point at production depending on which `.env.local` is
active on a given machine/session. **Always check `DATABASE_URI` before running any DB-writing
command.** Because of this, `npx tsc --noEmit` is the practical local correctness gate, not
`npm run dev`. Verify UI/runtime behavior on the live DO deployment instead of trusting local.

---

## 5. Deployment

Live at **injector.world** on DigitalOcean App Platform. Full original deployment write-up
(the hard-won debugging notes) is in `docs/DEPLOYMENT-DIGITALOCEAN.md` — **read it before
touching deploy config, env vars, or the DB directly.**

**Two deploy targets exist now, don't confuse them:** production (`origin` remote,
`ReederVogel/InjectorWorld`, DO app `starfish-app`/`injectorworld`) and staging (`injector`
remote, `rkumar0101/injector.world`, DO app `injector-world-staging`). Full staging setup +
gotchas: `docs/STAGING.md`. The git rules below (§12) apply to both remotes.

Build command on DO:
```
tsx scripts/run-pre-push-migrations.ts && tsx scripts/db-push.ts && tsx scripts/run-migrations.ts && tsx scripts/setup-search-indexes.ts && next build
```

**CRITICAL gotcha — `db:push` on Railway/DO can hang** if schema drift triggers an interactive
drizzle prompt during a non-interactive build. Mitigation already in place: `scripts/run-pre-push-migrations.ts`
runs raw SQL guards first so drift is resolved before `db-push` runs. If you remove a
collection, you likely need to add a new `IF EXISTS ... DROP CONSTRAINT` guard to
`scripts/migrate-pre-push.sql` — see "Pre-push landmine" pattern below.

**Same landmine, PostGIS variant (fixed 2026-07-25):** a DB that has the `postgis` extension
installed (its `spatial_ref_sys` / `geometry_columns` / `geography_columns` system tables) but
where no collection here declares a geometry field hit the exact same hang — drizzle-kit's
schema diff sees those tables as "extra" (Payload's config doesn't know about them) and throws
an interactive "DATA LOSS WARNING — about to delete spatial_ref_sys" confirm prompt, which
nothing ever answers in a non-interactive DO build, so it hangs until the build times out. Hit
on staging after the full-schema `pg_dump`/`pg_restore` in §14 carried the extension over.
Fixed by adding `extensions: ['postgis']` to the `postgresAdapter({...})` call in
`payload.config.ts` — this tells drizzle-kit to exclude those specific tables from its diff
entirely (confirmed against `node_modules/drizzle-kit`'s `getTablesFilterByExtensions`, which
maps `'postgis'` to `['!geography_columns', '!geometry_columns', '!spatial_ref_sys']`). This
does **not** run `CREATE EXTENSION` during `db-push` (that only happens in `payload migrate`,
and is wrapped in try/catch there, so it's a harmless no-op on tiers without PostGIS support)
— it only changes what the push diff considers its own to manage. Verified against staging by
running `scripts/db-push.ts` directly: before the fix it hung indefinitely on the prompt; after,
it completed cleanly (`Schema push complete.`, exit 0, no warning) in ~3 minutes (slow because
schema introspection runs over the public internet from a local machine to the DO DB, not
because of a hang).

### Known temporary hacks still in place (from original DO setup — see full doc for detail)
1. DB Trusted Sources currently allow `0.0.0.0/1` + `128.0.0.0/1` (effectively open — DO
   doesn't accept `0.0.0.0/0` directly). Should move to VPC private networking, or at minimum
   rotate the `doadmin` password (it was pasted into a chat once).
2. `db-push` still runs on every deploy — fragile by nature (can drop columns on drift).
   Migrating to proper generated migrations is still pending.
3. No PostGIS on this DB tier.

### Env vars to confirm are set on DO before relying on related features
- `RESEND_API_KEY` — email delivery (claim approvals, newsletters, verification codes). If
  unset, emails are only logged to console, never sent — several flows now surface this to
  the admin instead of failing silently (see §7).
- `TURNSTILE_SECRET_KEY` — CAPTCHA. **Fails closed in production if unset** (blocks all writes
  gated by it) — confirm it's set before assuming claim/signup forms work.
- `ADMIN_EMAIL` — booking/lead/claim notifications.
- `NEWSLETTER_ADDRESS` — real physical mailing address, required by CAN-SPAM before any real
  newsletter/outreach send. **Still unset as of this writing** — outreach emails will ship with
  an incomplete footer until this is set.
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` / `R2_ACCOUNT_ID` — media.
- `TRUSTED_PROXY_COUNT` (default 1) — number of trusted proxy hops for IP extraction
  (`lib/rate-limit.ts`). Must match DO's actual topology or rate limiting / IP-based checks
  can be bypassed.

---

## 6. Site visibility (SEO/indexing model — locked 2026-07-09)

This tripped people up before, so it's worth being explicit:

- **Market "live" status** (`Locations.isLive`) is *automatic*: any state/city with ≥1
  published clinic is live. No manual per-state launch step exists anymore.
- **Page indexability** is *automatic and separate* from market-live: a listing page becomes
  index-eligible once it has ≥5 published clinics (`MIN_CLINICS_TO_INDEX` in `lib/markets.ts`).
  Below that, the page is still crawlable, just `noindex`.
- Both are computed by `npm run scan:pages` (or the admin "Run page scan" button). **This has
  reportedly never been run against production** — `page-index` may currently have 0 rows. Run
  it, and consider wiring it to run automatically at the end of `npm run import`.
- The sitewide kill switch is `SiteConfig.siteNoindex` (admin toggle, big power button on the
  dashboard). OFF today = **site is hidden from Google entirely** regardless of the per-page
  logic above. Flip it when ready to go live for real.
- `app/robots.ts` is `force-dynamic` (reads `SiteConfig` every request) — never add
  `export const revalidate` to it.

---

## 7. Claim flow (the monetization engine — read before touching)

This is the founder's #1 priority feature: clinic/provider owners claim their profile, then
self-serve edit it. No claims = no revenue, so treat this code carefully.

**Flow:** `/claim/{provider|clinic}/{slug}` form → `/api/claims` (rate-limited, CAPTCHA,
honeypot) → creates a `Claims` record with `status: new` → admin reviews in `/admin` (Claims
Control Center) → approve → `approveClaimHook` (afterChange on `Claims`) creates/links a
`Users` account with `role: clinic|provider` and a `linkedClinic`/`linkedProvider` → owner gets
an email with a one-time setup link → sets password → auto-signed-in → lands on
`/dashboard/clinic` or `/dashboard/provider`.

**Key files:**
- `app/api/claims/route.ts` — public submission endpoint
- `collections/Claims.ts` — the `approveClaimHook`, all the real logic lives here
- `app/api/auth/setup-account/route.ts` — one-time password-setup + auto-login
- `app/api/dashboard/clinic-save/route.ts`, `app/api/dashboard/upload/route.ts` — owner
  self-serve edit endpoints. Both derive the target record ID from the **caller's JWT**
  (`linkedClinic`/`linkedProvider`), never from the request body — this is the pattern to keep
  if you add more owner-editable fields.
- `components/admin/ClaimsControlCenter.tsx` — admin outreach/coverage dashboard
- `lib/outreach.ts` — signed invite tokens (`?inv=<id>.<sig>`), unsubscribe HMAC, CSV escaping

**Security posture (audited + hardened 2026-07-25, committed in `98864d0`):**
The historical gap was that a claimant's typed email was never bound to the profile being
claimed — approval was 100% a manual admin judgment call. The system now computes an
email-match signal against the profile's on-file contact and offers (optional, non-blocking)
email confirmation via a 6-digit code, both surfaced to the admin at review time. **It is still
an admin-judgment system, not a hard-verified one** — if abuse ever appears, consider making
verified-or-matched a hard requirement before approval is allowed.

**Known product gap (not a bug):** `Users.linkedClinic`/`linkedProvider` is a single
relationship. An owner of multiple locations can only have one linked at a time — a second
approved claim for the same email gets marked claimed but not auto-linked, flagged for manual
admin follow-up in the claim's `reviewNotes`. Fine for now, worth knowing before someone
"fixes" it as a bug.

---

## 8. Data model / collections

Active Payload collections (`payload.config.ts`): `Users`, `Media`, `Services`, `Brands`,
`Locations`, `Clinics`, `Reviews`, `Providers`, `Photos`, `QA`, `Authors`, `MedicalReviewers`,
`Guides`, `News`, `FAQs`, `BeforeAfterCases`, `Bookings`, `Promotions`, `AuditLogs`,
`DataAlerts`, `AssistantLogs`, `PageIndex`, `Claims`, `ClaimInvites`, `Subscribers`,
`ZipCodes`, `VideoTestimonials`, `SocialPosts`.

Globals: `HeaderConfig` (admin-controlled nav), `SiteConfig` (sitewide noindex switch + other
site-level settings).

**Production data as of the last confirmed check (2026-07-26):** 17,020 clinics, 76 news
articles, 31 guides, 41,488 ZIP code rows, 35 services, 10 brands, 2,830 locations, 0 providers,
0 promotions. Treat this as stale and re-check the actual DB before making claims about current
volume. (**Staging now mirrors this same real data**, PII-stripped — see `docs/STAGING.md` §14.)

**URL structure** (3-path architecture, locked 2026-06-28) — FIND (`/[state]/[city]`),
SERVICES (`/services/[svc]/[state]/[city]`), BRAND (`/brands/[brand]/[state]/[city]`), all
served by the single catch-all `app/(frontend)/[...path]/page.tsx` + `lib/route-resolver.ts`.
Full table in `CLAUDE.md`. Old `/botox/*` URLs are dead 404s on purpose, no redirects.

**Slug format (locked):** state = `new-york` (no suffix), city = `houston-tx` (city name +
state code suffix). A migration to strip the suffix was attempted and cancelled — production
already uses the suffixed format, don't try to change it again.

---

## 9. Uncommitted work in the working tree right now

As of 2026-07-26, all uncommitted work is **staging-environment tooling**, not product code
(repo git rules still forbid commit/push without explicit in-conversation founder instruction —
see `CLAUDE.md` "Git rules"). `npx tsc --noEmit` is clean.

- **`scripts/seed.ts`** — three fixes found while bootstrapping staging on a fresh database:
  1. Locations step was upsert-by-slug instead of a blanket "skip if any row exists" check — a
     migration (`migrate-zip-location-fk.sql`) can pre-create a single DC row on a fresh DB,
     which used to make the old check wrongly skip seeding the other 49 states + metros.
  2. Promotions create was missing the now-required `title` field (added to the schema after
     this seed script was last touched) — every promotion insert failed validation.
  3. Providers step (step 7) is commented out — this seed is now clinics-first; mock providers
     added relationship complexity not needed for directory/listing testing. Restore from git
     history if provider-page testing is ever needed.
- **`scripts/seed-data.ts`** — 6 mock FAQ rows still used `scope: 'city'`, a value renamed to
  `'location'` in `collections/FAQs.ts` at some point. Fixed to match the current schema.
- **`scripts/migrate-pre-push.sql`** (already committed in `6f8caa5`, listed here for context) —
  an unguarded `ALTER TYPE enum_faqs_scope ADD VALUE IF NOT EXISTS 'brand'` crashed on any fresh
  database. Guarded with a `pg_type` existence check.
- **`scripts/seed-dummy-clinics.ts` (NEW)** — generates fake, image-free clinics across the 20
  phase-1 metros for load-testing pagination/listing pages on a non-prod DB. Not needed anymore
  now that staging runs on real (PII-stripped) production data instead, but kept since it's a
  reusable, harmless tool for whenever a scratch DB needs bulk data.
- **`docs/STAGING.md` (NEW)** — the full staging setup writeup.

All four fixes above are real, pre-existing bugs (they'd hit anyone bootstrapping a fresh
database, not just staging) — worth getting into `origin`/production's repo too even though
prod's existing DB never triggers them (the enum already exists there, promotions/locations
already seeded long ago).

---

## 10. Other pending items worth knowing about

- **SEO/GEO audit (2026-07-08):** two critical items already fixed (llms.txt rewritten for the
  3-path architecture, OG images added sitewide). Lower-priority gaps remain: `/clinics` and
  `/states` index pages have no canonical tag or ItemList/CollectionPage schema.
- **Admin revamp (5-phase plan, approved 2026-07-12):** Phases 1–4 done (admin shell rebuild,
  first-party analytics at `/admin/analytics`, per-collection dashboard headers). Phase 5
  (auth/security wiring audit across `/api/admin/*`, Cmd+K palette, type-to-confirm danger
  zone) not started.
- **Schema cleanup (partial):** `Media` group consolidation and `MedicalReviewers` cleanup
  (Phases 3–4 of a 7-phase plan) not started. See `project-schema-cleanup-plan` memory for the
  full dependency map before removing any collection — there's a specific checklist because
  getting it wrong breaks the DO build (see "pre-push landmine" below).
- **AI chat assistant:** built 2026-07-07, RAG + tool-use on Sonnet 5. Env-gated
  (`ASSISTANT_ENABLED` + `ANTHROPIC_API_KEY`) — off until those are set.
- **`npm run scan:pages` has apparently never been run against production** — see §6. Worth
  confirming and running before relying on the automatic indexing model actually reflecting
  reality.
- Mapbox token needs restricting to `injector.world/*` once the domain is fully live (currently
  unrestricted for dev convenience).

---

## 11. Patterns to know before you break something

- **Pre-push landmine:** removing a Payload collection leaves stale FK statements in
  `scripts/migrate-pre-push.sql` that fail the DO build unless you add an `IF EXISTS ... DROP
  CONSTRAINT` guard for it first.
- **`db:push` drops search indexes** — always run `npm run setup:search` afterward.
- **After any schema/field change:** `npm run generate:types` then, if you added an admin
  component referenced by path string, `npm run generate:importmap`.
- **CSV imports:** relationship IDs must be raw numbers, not `String()`-wrapped — a past silent
  failure mode with the Postgres adapter.
- **ISR crash pattern:** any `payload.find()` inside `getClinicBySlug()` that can throw on the
  live server crashes ISR revalidation for that page. Keep queries there minimal or wrapped.
- **Owner-editable API routes** (dashboard save/upload) must derive the target record ID from
  the authenticated user's JWT-linked relationship, never from the request body — see §7.

---

## 12. Git rules (repeat from CLAUDE.md — this is not optional)

No `git push`, `git pull`/`fetch`, new branches, or `git commit` without **explicit written
instruction from the founder in that exact conversation**. All work happens on `main`, in the
working tree, uncommitted, until told otherwise. If a task seems to need a commit or push,
stop and ask.
