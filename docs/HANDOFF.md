# injector.world — Project Handoff

**As of:** 2026-07-28. Last committed version on `main` (staging remote `injector`): `523f74f`
("Injector World Staging Ver: 0.01-28072026-0133"). Working tree is clean — everything described
in §9a below is committed and pushed to staging, deploy was in progress as of this writing.

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

**Production data as of the last confirmed check (2026-07-28):** 17,020 clinics, 76 news
articles, 31 guides, 20 FAQs, 41,488 ZIP code rows, 35 services, 10 brands, 2,830 locations
(2,817 live), 0 providers, 0 promotions. Treat this as stale and re-check the actual DB before
making claims about current volume.

**Staging has diverged from production on content counts** (schema is identical) because of
staging-only test imports run in earlier sessions: 100 guides, 125 news articles, 621 FAQs (322
approved, 299 still `imported`/pending — see §9a), same 17,020 clinics / 35 services / 10 brands /
2,830 locations as production. **Do not assume staging and production have the same content
volume** — check the actual DB (`docs/STAGING.md` for the connection swap procedure) before
stating a number in any external-facing document.

**URL structure** (3-path architecture, locked 2026-06-28) — FIND (`/[state]/[city]`),
SERVICES (`/services/[svc]/[state]/[city]`), BRAND (`/brands/[brand]/[state]/[city]`), all
served by the single catch-all `app/(frontend)/[...path]/page.tsx` + `lib/route-resolver.ts`.
Full table in `CLAUDE.md`. Old `/botox/*` URLs are dead 404s on purpose, no redirects.

**Slug format (locked):** state = `new-york` (no suffix), city = `houston-tx` (city name +
state code suffix). A migration to strip the suffix was attempted and cancelled — production
already uses the suffixed format, don't try to change it again.

---

## 9a. Session 2026-07-27/28 — internal-linking agent overhaul, table rendering fix, FAQ package (committed, deployed to staging)

Three separate pieces of work, all committed on top of §9's staging tooling, all verified against
staging before commit. `npx tsc --noEmit` clean throughout.

**1. Internal-linking discovery agent — full bug-fix pass.** The admin-facing "Scan for new
internal link opportunities" button (built in an earlier session) had 10 known issues; all fixed
and verified end-to-end against staging (including a real concurrent-approve deadlock caught and
fixed — see below):
- Stop button now takes effect within ~1 batch (`SCAN_BATCH = 2`, was 8) instead of minutes.
- A failed OpenRouter call/parse no longer silently marks the page as scanned — `linkDiscoveryScannedAt`
  is only set on success, so failed pages get retried.
- **Real deadlock found and fixed:** `collections/InternalLinkSuggestions.ts`'s approve/reject
  hook did nested `payload.update()` calls without passing `req` — each one opened its own DB
  transaction, and a write to the suggestion's own row would then block forever on the row lock
  held by the outer, still-uncommitted transaction that triggered the hook (self-deadlock,
  confirmed reproducible before the fix, gone after). Fixed by passing `req` through every nested
  call so they join the same transaction, plus a read-verify-retry pattern since the doc-lock
  releases slightly before the outer transaction commits.
- Per-document (not global 2000-row-limit) query for "already suggested" links; discovery batches
  now reuse a cached candidate list across calls instead of reloading ~1400 rows every request.
- Token cost cut ~10x: model default switched to `moonshotai/kimi-k2-thinking` (was `kimi-k3`,
  5x more expensive) and only paragraphs relevant to shortlisted candidates are sent to the model
  instead of the whole document.
- Live progress bar + running token/cost readout added to the admin scan control
  (`components/admin/ContentReportSeoTables.tsx`), sourced from `DiscoveryBatchResult`'s new
  `promptTokens`/`completionTokens`/`costUsd`/`total` fields.
- Orphan-page prioritization: `countIncomingLinks()` (`lib/internal-links/link-stats.ts`) counts
  real incoming internal links per guide/news page; the discovery batch sorts unscanned pages by
  incoming-link count ascending so orphan pages (0 incoming links — can't rank regardless of
  content quality) get scanned first. Content Report now shows an "Incoming" column with an
  orphan badge, an orphans-only filter, and a summary count.
- Content Report's per-page "Opportunities" column is now interactive: hover shows each pending
  suggestion (anchor text → target, reasoning) with inline Approve/Reject buttons — approving
  inserts the link into the live body immediately via a new
  `POST /api/admin/internal-links/approve` endpoint, no need to leave the report.
- Undo: un-approving a suggestion (or rejecting) now actually removes the previously-inserted
  inline link from the body via `removeInlineLink()` (`lib/internal-links/insert-link.ts`).
- `dateModified` / OG `modifiedTime` on guide and news pages now source from the real `updatedAt`
  timestamp (bumps whenever a link is approved) instead of falling back straight to `publishedAt`
  — `publishedAt` itself is never touched.
- Content Report's "External links" count was showing 0 for every page even when 6+ sources were
  visibly cited — it only counted links inside the Lexical body, and the importer never puts
  sources there (they're a separate `sources` field rendered as its own citations block). Fixed
  to add the cited-sources count; hover shows the body-vs-sources breakdown.

**2. Table rendering fix (`lib/render-lexical.tsx`).** Guide/news content used 4 different cell
delimiters inside `(table)`-prefixed paragraphs across import batches (`|`, ` - `, ` -- `, ` :: `)
— the renderer only understood `|`, so the other ~11 guides showed the whole row as one flat,
unsplit cell. Fixed with delimiter auto-detection per table block; a secondary data-quality issue
(a stray `;` inside a cell's own text, misread as a row separator) is handled by gluing orphan
1-cell fragments back onto the previous row, or spanning a short row's last cell across the
missing columns, so the table grid never looks broken even on messy source data. Verified against
all real affected guides pulled from the actual import source JSON, not synthetic test cases.

**3. FAQ package import + new `scope: 'guide'` (schema change).** A 649-FAQ package from the
founder's SEO/content contractor (Santosh), targeting 34 `/services/*` pages, needed routing
decisions before import — see `docs/DECISIONS.md` → "2026-07-27 — FAQ package routing +
scope: 'guide'" for the full reasoning. Summary of what shipped:
- `collections/FAQs.ts`: added `scope: 'guide'` + a new `guide` relationship field (mirrors the
  existing `service`/`brand`/`location` pattern). Schema pushed to staging, types regenerated.
- `lib/guide-queries.ts`: new `getGuideOwnFaqs(guideId)`, wired into the guide page's FAQ
  resolution chain (own inline FAQs → own `scope:'guide'` FAQs → borrowed from `relatedService` →
  none) — sibling to the pre-existing `getGuideFaqs(serviceId)` service-borrow path.
- `lib/import/faqs-bulk-upload.ts`: the bulk importer's own scope validation still only knew the
  5 pre-existing scopes and its own `guideSlug` resolution was missing — first import attempt
  failed 150/607 records on this before it was caught and fixed (not a data problem, a real gap
  in the importer left over from the schema change).
- **607 of 649 FAQs imported to staging**, routed: 13 pages → existing `service` (already-live
  `/services/*` pages), 10 pages → `brand` (they're brand names — Botox, Juvederm, Sculptra, etc.
  — which per the locked URL architecture belong at `/brands/<slug>`, not `/services/<slug>`, a
  mismatch the source package didn't know about), 8 pages → `guide` (matched to an existing guide
  covering the same topic, e.g. "Filler Dissolving" FAQs → `/guides/hyaluronidase`), 1 cluster
  (Botox for TMJ) folded into the existing `masseter-botox` service page. **42 FAQs held back**
  (Botox for Hyperhidrosis, Choosing an Injector — 2 topics with no matching guide or service yet)
  — needs 2 new guides created before those can import; do not force them onto an unrelated page.
  All imported at `reviewStatus: 'imported'` (pending) — nothing goes live until approved in
  admin; the collection's existing review gate handles that, untouched.
- **Open finding, not yet resolved:** while answering the founder's question about what
  "Verified" means for a clinic, found there is no single implemented "verified clinic" concept —
  `claimed` (owner confirmed via the claim flow) and license-verification (`lib/license.ts`'s
  `licenseClaim()`) are two separate mechanisms, and neither renders as a badge on a clinic
  listing card today. "Verified" language elsewhere on the site is aspirational marketing copy,
  not tied to a specific field. Flagged to the founder; no code changed on this, it's a product
  decision (does a card-level badge get added, and if so driven by which mechanism).
- A design/business overview document (`.docx`, not checked into the repo) was produced for an
  external UX contractor (Liza) covering the design system, site architecture, current build
  status, and this verified-clinics open question — all figures in it are explicitly labeled
  STAGING, not production, since staging currently has more content (100 guides/125 news/621
  FAQs vs production's 31/76/20) from earlier staging-only test imports.

---

## 9b. Session 2026-07-28/29 — clinics data import pipeline, site crash fix, SEO fixes (committed, deployed to staging)

**1. Clinics data import — Restylane, Kybella, Latisse batches.** New pipeline built for
importing real clinic CSVs from an external scraping tool ("IW") into staging. Not a
one-off script — a repeatable process, refined batch over batch:
- Two-tier dedup against the existing DB: `google_place_id` exact match first, `clinic_name`
  + `zip` normalized fallback second. Ambiguous (2+ candidates) or no-match rows are never
  guessed at.
- **Intra-file dedup, done in-memory before any DB write** — the same source scraping tool
  re-surfaces the same physical clinic under multiple metro-search queries with different
  generated IDs (seen up to 17x for one clinic in the Restylane batch: 871 duplicate groups,
  1,107 redundant rows). First attempt merged-then-deleted post-insert via per-group DB
  queries (13+ minutes for that one step); rebuilt to merge in memory first — cut the same
  class of work to under a minute on the next batch.
- Matched (existing) clinics: missing-fields-only update, never overwrites a field that
  already has a value, and images are explicitly excluded from every field-fill pass (image
  upload is a separate, not-yet-started, later pass to DO Spaces).
- Unmatched rows: inserted `status: draft, noindex: true, needsManualReview: true` — nothing
  goes live sight-unseen.
- Brand/service mapping: every distinct token in the source `treatments_offered` column is
  checked against **both** the `services` and `brands` collections; a token matching neither
  becomes a new `Brand` (the catalog is intentionally open-ended now — see `docs/DECISIONS.md`
  "2026-07-28 — Brand catalog is open-ended"). 5 new Restylane product-line brands and a new
  `latisse` brand were created this way, inheriting `category` from whichever existing brand
  their name is a prefix-extension of.
- Cleanup pass before publish: ALL CAPS clinic names title-cased (credential abbreviations
  like MD/DO/LLC kept upper via an allowlist), `(XX00000)`-style scrape-artifact suffixes
  stripped from names, and street-address-style names (`^\d+\s+[A-Z0-9]`) flagged to
  `status: review` rather than published. **The street-address heuristic has real false
  positives** — area-code-branded business names ("512 AESTHETICS", "360 Plastic Surgery")
  match the same regex as genuine bare addresses. Every batch's flagged list was hand-checked
  before trusting it; roughly half the flags each time were false positives that got manually
  restored to published.
- Net result across 3 batches: staging clinics grew 17,020 → 29,342, brands 10 → 16. All new
  rows published with `noindex: true` still set (per founder's explicit instruction — visible
  on the live site, not yet search-indexed).
- **A 4th batch (GLP-1 weight-loss clinics, Ozempic/Wegovy/Mounjaro/Zepbound etc., 11,847
  rows) is analyzed but explicitly NOT started.** Two problems flagged to the founder/Santosh,
  answer not yet known as of this writing: (a) whether GLP-1 content is in scope for the site
  at all, (b) several of the "brands" in that source data are the same drug under different
  marketing names (Ozempic/Wegovy/Rybelsus = Semaglutide; Mounjaro/Zepbound = Tirzepatide) —
  creating one Brand per token as usual would count the same medicine 3–4 times, so this batch
  needs a different mapping rule before it can run. Do not resume without checking this got
  answered.
- Full lesson log (including a real dedup-miss bug found: `normName()`'s name+zip fallback key
  doesn't strip the same `(XX00000)` suffix pattern the cleanup pass strips from names, which
  let one genuine duplicate slip through as a slug-collision insert failure) lives in the
  `project-clinics-import-plan-2026-07` memory file, not duplicated here.

**2. Site crash investigation + fix — no-hallucination, evidence-based (founder explicitly
asked for this).** Staging started intermittently 503ing partway through the imports above.
Root-caused via DO's own Runtime Logs + Insights memory graph + a live Postgres log stream
(all founder-provided screenshots/pastes, not guessed): the app was OOM-crash-looping every
1–2 minutes (`exited with code: 128`, no stack trace ever preceding it — the signature of an
external SIGKILL, not a thrown JS error). Traced to a specific query shape — `WHERE
status='published' ORDER BY aggregate_rating_count DESC LIMIT N` with no supporting index —
that was spilling to a Postgres temp file on disk (confirmed in the log stream) on the
homepage hero query, and structurally present in ~4 other listing queries too. Fixed with:
- A new composite index, `clinics_status_rating_idx ON clinics (status,
  aggregate_rating_count DESC)`, added to `scripts/setup-search-indexes.ts` (the existing
  pattern for indexes Payload/Drizzle doesn't manage — survives `db:push` because the build
  chain re-runs this script after every push). Applied directly to staging immediately, not
  just committed, since the site was actively down. Verified with `EXPLAIN ANALYZE`
  before/after: the affected query went from a full sequential scan + disk-spill (1.7s+) to
  an index scan (~25ms, ~26KB peak memory).
- `lib/hero-queries.ts`'s clinic query and a new shared helper (`lib/lean-clinic-listing.ts`,
  used by `getBrandPillar` and `getServicePillar`) rewritten as raw SQL selecting only the
  columns actually used downstream, instead of `payload.find()` — which always joins in
  every relationship/array field regardless of `depth` (depth only gates whether *related
  documents* populate, not whether the underlying relation-ID join happens at all).
- `lib/provider-queries.ts`'s `getProvidersListing()` had `limit: 1000, depth: 2` with zero
  filter; capped to a default of 100. Confirmed via grep this function is currently unused
  anywhere in the codebase (dead code, zero real runtime risk right now) — left fixed as a
  landmine defused for whenever it gets wired up, not rewritten further.
- Full writeup, including the honest performance ceiling for brand/service pages given how
  common every current brand is (~130–250ms, not sub-100ms, verified not asserted), is in the
  `project-site-crash-performance-fix-2026-07-29` memory file.

**3. SEO fixes, found/requested alongside the above.**
- `components/pre-footer/PreFooterCta.tsx`: a dead CTA link (`/services/botox/...` — "botox"
  isn't a real service slug, 404s) and a fabricated "12,400+ verified injectors" stat — both
  were findings from the 2026-07-08 SEO audit that the founder had asked excluded from that
  round's *report*, but the underlying bugs were never actually fixed until now. Link now
  points to `/states`; the fake number is gone, replaced with "Verified injectors nationwide".
- Brand pillar page title/H1 changed from "{Brand} Clinics" to "{Brand} Injectors Near You"
  across all 16 brands (`app/(frontend)/[...path]/page.tsx` generateMetadata +
  `components/pages/BrandPillarPage.tsx`) — founder's call, targeting the real search
  behavior where people search a brand name as a stand-in for the generic treatment (e.g.
  "botox injector").
- A second table-rendering bug found in `lib/render-lexical.tsx` / `AtAGlanceList.tsx`: the
  `(table)`-prefix parser only recognized `;` as the row separator; some guides' at-a-glance
  data uses `||` instead (found live on `/guides/botox-for-migraines`, rendering as one raw
  unparsed text blob). Row-separator detection is now dynamic; `AtAGlanceList` also gained the
  ability to parse a raw `(table)` string fact directly (it previously only handled
  pre-structured `{type:'table'}` objects), reusing the same parser instead of duplicating it.

**4. API reference docs for a teammate (Liza), not code.** `docs/API-CLINICS-LISTING.md` (the
5 clinic-listing endpoints) and a combined Word doc covering every other public/logged-in-user
API route (admin + auth routes deliberately excluded; rate-limit thresholds and anti-abuse
mechanism details deliberately left out since it's an external-facing document) — the Word
doc was delivered directly, not committed to the repo. Built with the `docx` npm skill; this
dev machine has no LibreOffice/pandoc installed so the normal render-and-visually-verify step
wasn't possible — fell back to validating the generated `word/document.xml` as XML directly,
which caught one real bug (`children.push(bullets([...]))` needed to be
`children.push(...bullets([...]))`, a spread-operator miss that corrupted the document).

---

## 9. Uncommitted work in the working tree right now

**As of 2026-07-28, the working tree is clean — nothing uncommitted.** The staging-environment
tooling below (found 2026-07-26) is already committed; this section is kept for the specific
bug context in case it's useful, not because anything here is currently pending.

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

- **GLP-1 clinics batch (11,847 rows) — paused, waiting on a founder/Santosh decision.** See
  §9b point 1. Do not import until the scope question and the same-drug-different-brand-name
  question are actually answered.
- **SEO/GEO audit (2026-07-08):** llms.txt + OG images fixed 2026-07-09; the dead CTA
  link/fake stat and brand-page search-intent titles fixed 2026-07-29 (§9b point 3).
  Lower-priority gap still open: `/clinics` and `/states` index pages have no canonical tag or
  ItemList/CollectionPage schema.
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
- **Map rendering moved from Mapbox to Google Maps JS API (2026-08-12)**, `@vis.gl/react-google-maps`
  + `@googlemaps/markerclusterer`. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is already HTTP-referrer
  restricted to `injector.world/*`, `www.injector.world/*`, `localhost:3000/*`, and the staging
  `ondigitalocean.app` origin, and API-restricted to just "Maps JavaScript API" — no further
  restriction work pending, unlike the old Mapbox token. Geocoding (`lib/geocode.ts`) stayed on
  free Nominatim; the `mapbox` provider branch there is now dead code (never selected, `GEOCODER`
  is `nominatim`) but was left in place rather than deleted.

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
