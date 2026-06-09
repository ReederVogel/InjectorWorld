# injector.world — Audit Findings (2026-06-09)

Full audit across code, data, schema (all 20 collections field-by-field), security, SEO/AEO/GEO,
UX, legal, ops, scalability, forms, and page SSR. Three deep passes. This is the base for the
forward plan. Severity: 🔴 launch-blocker · 🟡 important · 🟢 cleanup. ✅ = verified working.

> Note: some live re-verification was unreliable due to the local dev server (cold-compile +
> .next thrashing when multiple servers run). Findings below are from code+data+targeted live tests.

---

## 🔴 Launch-blockers

### Legal / trust (claims we can't back up)
- **[STILL OPEN — founder kept as-is 2026-06-09] Reviews marked "verified" but aren't.**
  `Reviews.verified` defaults `true`, and the importer sets `verified:true` on every row — including
  reviews scraped from Google/Yelp/Healthgrades (`sourcePlatform`). Scraping third-party reviews +
  republishing + labelling "verified" is a ToS + false-advertising risk. Founder chose to leave it
  for now; MUST be revisited before public launch (Phase 12) with real provenance or honest labels.
- **[FIXED 2026-06-09] "License verified" badge without verification.** Now `lib/license.ts#licenseClaim`
  shows "License verified" only when a `licenseVerificationUrl` (state-board record) exists, else the
  neutral "License on file". Board URL linked from the provider profile. Applied to all per-provider
  badges (cards + profile) and the profile meta description.
- **[FIXED 2026-06-09] "No paid rankings" / "Real patient reviews" copy.** Removed the "no paid
  rankings" claim from every user-facing surface (Hero, PreFooter, StateHub, Neighborhood,
  CityDirectory desc + trust chip, catch-all metadata, careers, llms.txt). We sell sponsored cards +
  ad banners, so the blanket claim was FTC exposure. Sponsored labelling disclosure kept.
- **[FIXED 2026-06-09] Before/after + photos without confirmed consent.** Homepage "Real Patient
  Stories" now filters `consentGranted === true` (provider profile was already gated). `Photos`
  collection is not rendered on the frontend yet, so no current display risk (gate when a gallery
  ships).

### Security
- **Rate limiting is in-memory `Map`** — resets every deploy and is per-instance. On multi-instance
  (Railway/DO scale) it does not share → abuse/DoS window. Move to Redis before scaling.
- (Fixed this session: cookie-auth, Bookings PII access, admin-panel access, claim-spam create:false,
  import 20 MB cap. See DECISIONS 2026-06-09.)

### Broken / missing core UX
- **[FIXED 2026-06-09 — bucket B] State hub (`/new-york`) lists NO providers.** Now has an "Injectors
  in [state]" section: all state-licensed providers (merit-ordered + organic pins + sponsored) AND all
  state clinics, in a Providers | Clinics tabbed list with client "Load more" (12/batch). Added a
  provider `ItemList` to the state-hub JSON-LD. See DECISIONS 2026-06-09 bucket B.
- **[FIXED 2026-06-09 — bucket B] No header search on desktop.** Added an always-visible inline
  treatment+location search bar (second header row, `hidden md:block`, inner pages only via
  `usePathname`) that submits to a new `/search` results page. Mobile overlay now routes there too.
- **[FIXED 2026-06-10 — Phase 4] 9 clinics were invisible.** Clinics in Orlando, Tampa, Buffalo,
  Brooklyn, Fort Worth, San Antonio, Sacramento, Beverly Hills had no matching metro `Location` → their
  providers never appeared on any city page. The importer now auto-creates a metro `Location` for any
  unmatched city (`autoCreateMetro` in `lib/import/import-data.ts`): live + indexable for launch states
  (CA/TX/NY/FL), coming-soon + noindex otherwise, and still raises the `unmatched_city` alert for review.
  Verified all 8 metros created + live. See DECISIONS 2026-06-10.
- **[FIXED 2026-06-09 — bucket B] `/injectors` index loads all providers + map with no pagination.**
  Now client "Load more" at 24/batch (card grid only; map still covers the full filtered set). Real
  server-side search + clustering stays Phase 5.

### Ops / production
- **Media uploads are ephemeral.** `Media` stores to local disk (`../media`, gitignored); DO Spaces
  not wired (Phase 7). On Railway the filesystem is ephemeral → any admin-uploaded image disappears
  on the next deploy/restart.

---

## 🟡 Important

### Admin / operator usability + warnings
- **[FIXED 2026-06-09 — bucket C] Promotions validation gaps.** `beforeChange` now (when active)
  requires a provider for sponsored-card/organic-pin, requires image + link for banners, and validates
  scope target against `scopeType`, each with a plain-English error. **Expired promos** (endDate passed,
  active=true) are now flagged AND auto-deactivated by `scan:alerts` (founder call: both). New DataAlerts
  types added (`promo_missing_provider`, `promo_missing_image`, `promo_expired`, `promo_scope_mismatch`)
  + scan detectors, self-healing. See DECISIONS 2026-06-09 bucket C.
- **[FIXED 2026-06-09 — bucket C] Banner image spec mismatch.** Locked at 6:1 (matches `AdBanner`); field
  description updated to 1200 x 200 px with format/size guidance (founder call: align to component, no
  component change).
- **[FIXED 2026-06-10 — bucket C cockpit pass] Admin UX is bare.** Full cockpit pass shipped (Payload
  native surfaces, no bespoke views): branded panel (Logo/Icon wordmark) + `afterNavLinks` live-site
  link; `beforeDashboard` rebuilt as an operator cockpit ("Needs you now" priority strip, quick-action
  buttons, collapsible plain-English "How this works", plus the existing alert/lead/import cards);
  one-line description on every collection; `listSearchableFields` on browse-heavy collections; Claims
  moved to the Operations group; five color-coded status cells (DataAlerts severity+status, Bookings
  status+age, Promotions active/expired, Claims status); and read-only guardrails on system-managed
  trust fields (aggregateRating/count, claimed/claimedBy, alertKey). All `admin.*`, no schema change.
  See DECISIONS 2026-06-10.
- **[FIXED 2026-06-09 — bucket C] Q&A has no revalidate hook.** `collections/QA.ts` now wires
  `revalidateAfterChange`/`revalidateAfterDelete`, so answering/publishing refreshes `/questions`
  immediately.
- **[FIXED 2026-06-09 — bucket C] Operator lead alerts.** Admin DashboardWidget gained a "New leads"
  card: unread (`status=new`) booking count + how long the oldest has waited, linking to the filtered
  Bookings list (no email, founder call).

### Dead / unwired schema (exists in DB + admin, does nothing)
- **[FIXED 2026-06-09 — bucket C] Labelled "NOT LIVE YET (Phase N)" in admin (founder call: label, not
  remove).** Brands collection + `Providers.additionalClinics` -> Phase 6; subscription fields on
  providers/clinics/brands -> Phase 9; `Users.savedProviders`/`savedClinics` -> Phase 8. Description text
  only, no DB change. Operators now see these are intentional scaffolding, not broken fields.
  - **Brands** collection (whole) — no frontend, no brand pages; the importer doesn't even populate it.
  - **Providers.additionalClinics** (multi-clinic) — never rendered.
  - **subscriptionTier / subscriptionStatus** on providers/clinics/brands — no gating logic (Phase 9).
  - **Users.savedProviders / savedClinics** — no save feature (Phase 8).

### Data integrity (fake-data residue + model)
- 6 providers missing profile photo; 6 reviews with no provider (ghost-row fault data) live in DB.
- **[PARTIALLY FIXED 2026-06-09 — bucket B] Provider has no own city.** Location still derives from
  the (primary) `clinic`, but it's now shown prominently with a pin (neighborhood, city, state) on
  all provider cards (Directory / Hero / Featured) and the profile hero. A true provider-owned city
  field for the multi-clinic case is still open.
- Seed's hand-curated providers were replaced by the import (all 218 are import-sourced).
- `aggregateRating` is a free number (no 0–5 clamp).

### Engineering / scale
- **No DB migrations** — schema changes rely on `push` (Drizzle introspection). Risky for prod schema
  changes (data-loss prompts). Need a migration strategy before real data.
- **`getCityDirectory` runs several sequential queries**; no pagination anywhere; route-resolver loads
  all locations into memory (fine now, heavy at scale).
- Hero "search" is client-side filtering of a preloaded list, not real search (Phase 5).
- PostGIS installed but unused; distance is browser haversine (Phase 5).

### SEO / AEO / GEO / AIO
- State/city hub pages are thin (weak ItemList/FAQ/structured content) → weak ranking + AEO.
- `llms.txt` is static (doesn't reflect live markets/data).
- (Fixed this session: live-only sitemap, noindex logic, removed dead SearchAction.)

---

## 🟢 Cleanup / cruft
- `scratch/` — `hello.js`, `hello.ts`, `test-render.ts`, `view-alerts.ts` (junk; gitignore or delete).
- `design/figma-build-spec.md`, `design/homepage-plan-plain-english.md`, `mockups/` — historical.
- Dormant Resend email code (behind `RESEND_API_KEY`) — wire it or drop it.
- Stubs: `/forgot-password` (fake), `WaitlistSignup` (saves nothing), `Header` logged-in state
  (`user={null}` — kept stubbed to preserve static rendering; needs client-side `/api/users/me`).
- `CLAUDE.md` stale "Build Status" / "Execution sequence" sections (superseded by docs/ROADMAP).

---

## ✅ Verified working (baseline)
- Most pages return 200 with real content (home, guides, quiz, questions, all money pages,
  coming-soon, static/legal pages, sitemap/robots/llms).
- All treatments × live cities show providers (Botox/Dysport/Lip Filler/Tear-Trough/Kybella/Sculptra).
- Coming-soon + noindex,follow correct; live-only sitemap.
- Forms validate: booking (422 on missing consent), claim (200 / 400 bad id), question (Zod),
  dashboard-save + admin-import (401 unauth, work with cookie after the auth fix).
- Security writes locked: anonymous + patient cannot write providers/reviews (403).
- No dark-mode regression (`text-white` only on accent/always-dark/overlay surfaces).
- Guides render via `RenderLexical` (React nodes) — XSS-safe; `dangerouslySetInnerHTML` only on
  escaped JSON-LD.
- No TODO/FIXME/@ts-ignore; tsc clean; proper DB indexes on searched fields.
- Revalidation hooks make admin edits reflect immediately (after this session's fixes).

---

## Suggested forward buckets (for the new chat)
1. **Truth & Legal** (launch-blocker): reviews "verified", license "verified", "no paid rankings"
   copy, consent-gated before/after, sponsored labelling + disclaimers.
2. **Core UX** — DONE 2026-06-09 (bucket B): desktop inline search + `/search` page, state-hub
   providers + clinics, provider location prominence, `/injectors` Load-more pagination.
3. **Admin/Ops overhaul** — DONE (bucket C, 2026-06-09 + cockpit pass 2026-06-10): promotions
   validation + warnings + expired flag/auto-deactivate, banner spec locked 6:1, operator lead alerts
   (unread count + oldest), Q&A revalidate hook, dead schema labelled "NOT LIVE YET (Phase N)", AND the
   full admin cockpit pass (branding, dashboard cockpit + quick actions + help, collection descriptions,
   status cells, read-only trust guardrails). Bucket fully closed.
4. **Data/import (Phase 4)** — DONE 2026-06-10: missing-metro auto-create, photos/qa importers, single
   combined CSV + dry-run, importBatch, new detectors (invalid zip/coords/phone, duplicate NPI,
   possible_branch), scoped wipe tools (typed-confirm + auto-backup), backup/re-scan admin buttons,
   db-push ESM no-op fix. See DECISIONS 2026-06-10.
5. **Scale/hardening (Phase 5/12)**: server search + PostGIS, Redis rate-limit, migrations, Media on
   DO Spaces, Sentry, CSP review.
