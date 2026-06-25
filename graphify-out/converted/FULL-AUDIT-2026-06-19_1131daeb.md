<!-- converted from FULL-AUDIT-2026-06-19.docx -->

injector.world
Full Codebase Audit
Security, data, content publishing, journeys, UI/UX, accessibility
Overall grade
A−
Launch-ready after a short fix list
Prepared for the founders  ·  19 June 2026
Read-only audit · no application code changed · database restored after testing

# Contents

# 1. Executive summary
The site is in genuinely good shape. It is built carefully, with security considered far more thoroughly than is typical at this stage. There is no critical, site-breaking bug. After a short list of fixes (led by one trust issue), it is ready for a full public launch.
This audit covered eight areas end to end: security, the database and backend, content publishing (JSON and CSV), routing, the patient / provider / clinic / admin journeys, UI and UX, dead code and contradictions, and accessibility. Everything was checked both by reading the code and by running the live site, including real test uploads that were later removed.

Verdict at a glance

Area grades

Findings by severity

# 2. What was tested, and how
Three lenses were used: reading the code, running the live site, and checking the build. Concrete evidence collected:
- Build health: full TypeScript typecheck passed clean.
- JSON publishing: logged in as admin, uploaded a news article (created = 1), it sat as pending, was approved, and the public page returned HTTP 200 with title and body rendered.
- CSV import: uploaded sample providers/clinics/reviews; a duplicate provider was correctly skipped and an unknown treatment was flagged; dry-run matched the real run exactly.
- Pages: about 50 URLs across all page templates plus feeds, auth redirects, and 404s — all behaved correctly.
- Accessibility: live homepage scan — one H1, clean heading order, 104 of 104 images had alt text, all links and buttons named.
- UI: light, dark, and mobile (375px) screenshots; zero application console errors.
- Safety: a full database backup was taken before any write and restored afterward; all temporary test data was removed.
# 3. Content publishing — JSON and CSV both verified
Both publishing paths were tested with real uploads and both work. The flow is a deliberate editorial gate: nothing goes public until a human approves it.

How a page gets published

Bad rows are flagged as DataAlerts and skipped; the rest of the batch still imports. Approved pages are live immediately, but stay hidden from Google until a separate "drip index" step releases them — this lets you control SEO timing.

One rule to remember (by design): a JSON article is skipped if its author is not already in the Authors list. Before a bulk content upload, create the authors first (or an "Editorial Team" author). The importer reports this clearly.
# 4. Page coverage
About 50 URLs were loaded across every page template. Summary:

Note (development only): while loading many never-seen pages in a burst, the development server hit a memory limit and auto-restarted (one /login compile took 143 seconds). This is normal for Next.js dev mode, which compiles each page on first visit. Production is pre-built and serves pages in milliseconds, so this will not happen live. Keep ~4 GB free on the dev machine.

# 5. Findings, by priority
Each finding lists what it is, where, why it matters, the effort to fix, and the fix.
HIGH  H1 — "License verified" badge shows on EXPIRED licenses
MEDIUM  M1 — Signup form is weaker than the others
MEDIUM  M2 — Eight write endpoints have no anti-CSRF check
MEDIUM  M3 — Hidden reviews are readable through the public API
MEDIUM  M4 — Six structured-data blocks are not escaped
MEDIUM  M5 — Provider onboarding link is broken
MEDIUM  M6 — Rate-limit IP detection needs the right proxy setting
LOW   five items
- L1 admin email mismatch — config says admin@injector.world, the real admin is admin@injectors.world. Pick one.
- L2 city-page "License verified" — a static blanket claim; make sure it is defensible.
- L3 imported links not scheme-checked — a javascript: link in imported content would be clickable. Allow only http(s)/mailto/tel/internal.
- L4 localhost allowed in production — harmless but should be dev-only.
- L5 redirect param inconsistent — /dashboard uses ?next=, /profile uses ?redirect=. Pick one.
POLISH   eleven nice-to-haves
Move rate limiting to Redis before running multiple servers; restrict the Mapbox token to injector.world; rotate R2 keys if ever shared; add a double-submit guard on bookings; consider a stricter Content-Security-Policy; remove placeholder image hosts before launch; add a "Skip to content" link; add a favicon; fix the mobile header glitch (§9); label one input (§8); review mobile touch-target sizes (§8).

# 6. Persona journeys — all four work
# 7. Security scorecard
# 8. Accessibility (deep check)
Verdict: B+. Strong foundations; the gaps are small and quick.
# 9. Mobile sweep
- Homepage at 375px renders cleanly: search box stacks, navy "Search" button with readable white text, chips wrap, trust badges show. Dark mode also confirmed.
- One minor glitch: at narrow widths the header search icon overlaps the "world" wordmark. Cosmetic — fix header spacing on small screens.
- No broken layouts or horizontal-scroll issues on the pages checked.
# 10. Contradictions found
- "License verified" vs "Expired" on the same profile — the important one (H1).
- Docs say "no email in v1," but email is built everywhere (signup, claims, bookings, newsletter, reset). It is dormant (no key, nothing sends) — but code and the decision log disagree. Update the doc.
- CLAUDE.md says "DOMPurify for rich text," but the app does not use it. The renderer is safe anyway, so the result is fine — but the claim is inaccurate.
- Admin email spelling differs between config and the real account (L1).
# 11. Dead code and cruft — very clean
- Only 3 to-do notes in the entire codebase — unusually tidy.
- No duplicate modules (the two "merit" files do different jobs; the seed files are not duplicates).
- Minor dev annoyance: one file mixes a component with a non-component export, causing extra dev reloads. Dev-only.
# 12. Suggested fix order
- H1 — license badge must respect license status (trust + legal). Do first.
- M1 + M2 — add anti-CSRF and CAPTCHA to signup and the 8 unprotected routes.
- M3 — hide pending/rejected reviews from the public API.
- M5 — fix or replace the broken /setup-account onboarding link.
- M4 — escape the 6 SEO data blocks.
- M6 / L1 / L5 — proxy IP setting; fix the email-spelling and redirect-param inconsistencies.
- Polish list — when convenient (skip-link, favicon, mobile header, Mapbox lock-down, Redis).
# 13. Jargon explained simply (for founders)
# 14. Honesty notes and cleanup
- Tested live: JSON import, CSV import, ~50 pages, accessibility, mobile, light/dark.
- Not separately load-tested: performance under heavy traffic; live email delivery (Resend has no key, as agreed).
- Cleanup done: all temporary test scripts deleted; database restored from the pre-audit backup and verified (users 3, providers 218, clinics 99, reviews 2,800 — all original; zero test leftovers). No application code was changed.
| 0 | 50+ | 25 | 0 |
| --- | --- | --- | --- |
| critical bugs | pages, all pass | data collections | console errors |
| Security
A−
No injection, no IDOR | Backend & data
A
25 collections locked | Content publishing
A
Upload to live works |
| --- | --- | --- |
| Routing
A
All page types load | UI & UX
A−
Clean light + dark | Accessibility
B+
Good base, small gaps |
| Critical | — none   0 |
| --- | --- |
| High | █   1 |
| Medium | ██████   6 |
| Low | █████   5 |
| Polish | ███████████   11 |
| Upload
JSON / CSV | → | Validate
+ dry-run | → | Pending
not public | → | Approve
admin | → | Live
public |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Group | Examples | Result |
| --- | --- | --- |
| Core content (25) | home, /injectors, /clinics, /guides, /news, /questions, /pricing, legal pages | All 200 |
| Auth & utility (6) | /login, /signup, /forgot-password, /reset-password, newsletter pages | All 200 |
| Protected (2) | /dashboard, /profile (logged out) | Redirect to login |
| Dynamic (6 types) | /botox, /los-angeles-ca, city directory, neighborhood, provider, clinic, brand, treatment area | All 200 |
| SEO / machine | /sitemap.xml, /robots.txt, /llms.txt, /news/rss.xml | All 200 |
| Bogus URLs | /this-page-does-not-exist, /botox/nowhere-zz | Correct 404 |
| Where | lib/license.ts:12; shown on injectors/[slug]/page.tsx:167, QuickViewPanel.tsx:101, FeaturedInjectors.tsx:75, dashboard/page.tsx:259 |
| --- | --- |
| What | A provider with an Expired license still gets the green "License verified" badge. Her profile shows "License verified" at the top and "License: ... — Expired" three lines down. |
| Why it matters | The whole brand is trust. A green verified mark on an expired license misleads patients and is exactly what a consumer-protection regulator (FTC) examines. The badge checks "is there a verification link?" but never "is the license active?" |
| Effort | Low (a few hours). |
| Fix | Show the green badge only when license status is Active. For Expired / Inactive / Suspended, show a neutral or amber label such as "License on file" or "License expired". |
| Where | app/api/auth/signup/route.ts |
| --- | --- |
| What | No anti-CSRF check, no CAPTCHA, and an IP-detection method a bot can fake — so the "5 signups/hour" limit can be bypassed to mass-create fake accounts. |
| Fix | Use the same shared protections the booking and claim forms already use (checkOrigin + shared rate limiter + CAPTCHA). |
| Where | account/profile, auth/signup, providers/view, admin/scan, admin/branches, admin/backup, admin/newsletter/send-news, dashboard/zip-feature-request |
| --- | --- |
| What | The other 14 write routes have it. For the admin ones, a tricked logged-in admin could be forced to trigger a backup or scan. |
| Fix | Add the one-line checkOrigin guard to each route. |
| Where | collections/Reviews.ts:14 |
| --- | --- |
| What | Public read does not hide "pending" or "rejected" reviews. The Q&A collection does this correctly. |
| Fix | Copy the Q&A pattern so only approved reviews are public. |
| Where | NeighborhoodPage, CityHubPage, StateHubPage, CityDirectoryPage, TreatmentStatePage, TreatmentPillarPage |
| --- | --- |
| What | These write SEO JSON without the </script>-escape the other 8 pages use. Since that data includes imported clinic/FAQ text, it is a latent code-injection path. |
| Fix | Apply the same escape everywhere, or use one shared component. |
| Where | collections/Claims.ts:64 |
| --- | --- |
| What | When admin approves a claim for a brand-new user, they are pointed to /setup-account — but that page does not exist, so they cannot set their password. |
| Fix | Build the page, or send a normal password-reset email instead. |
| Where | lib/rate-limit.ts:84 |
| --- | --- |
| What | A self-contradicting comment about reading the visitor IP. If TRUSTED_PROXY_COUNT is wrong for DigitalOcean, rate limits can be dodged. |
| Fix | Confirm the host setup, set the value, and clean up the comment. |
| Journey | What was checked | Status |
| --- | --- | --- |
| Patient | Home / search to city directory to provider profile to booking. The booking form is well-protected: anti-CSRF, rate limit, CAPTCHA, consent required, and it verifies the clinic belongs to the provider. | Works |
| Provider | Login and dashboard load. A provider can edit only their own profile and only safe fields (never license, rating, or verified flag). Onboarding link gap = M5. | Works |
| Clinic owner | Clinic pages load; brand and branch linking works ("3 locations"); owner has a locations dashboard. | Works |
| Admin | Import to approve to publish all verified live. Wipe needs a typed phrase plus an automatic backup. The activity log is append-only and cannot be tampered with. | Works |
| Control | Status |
| --- | --- |
| SQL injection | Safe — values parameterized, numbers validated |
| XSS (script injection) | Mostly safe (2 hardening gaps: M4, L3) |
| Patient becoming admin | Blocked — role is access-controlled |
| Editing someone else’s data | Blocked — target taken from login token |
| Sensitive data (bookings, emails) | Staff-only; public create blocked |
| Server secret strength | Refuses to start in prod if weak |
| Activity audit log | Append-only, tamper-resistant |
| Anti-CSRF coverage | Strong on 14 routes, missing on 8 + signup |
| Rate limiting | Present on most; signup method weak |
| Secrets in git | Hidden from git (.env.local ignored) |
| Check | Result |
| --- | --- |
| Page language set | en |
| Exactly one main heading (H1) | Yes |
| Heading order (H1 to H3) | Clean, no skips |
| Images with alt text | 104 of 104 |
| Links and buttons named | All named |
| Form labels | 130 ARIA attrs, 52 labels |
| Unlabeled inputs | 1 (placeholder only) |
| Skip-to-content link | Missing |
| Mobile touch targets | Check icon buttons vs 44px |
| Favicon | Missing (has a TODO) |
| Term | Plain meaning |
| --- | --- |
| CSRF | A trick where a bad website makes your logged-in browser do something without you meaning to. The "anti-CSRF check" stops it. |
| XSS | Sneaking malicious code into a page so it runs in a visitor’s browser. The site is safe here. |
| IDOR | Editing someone else’s record by changing an ID. Blocked here. |
| SQL injection | Tricking the database by typing code into a form. Blocked here. |
| Rate limiting | Capping how many times an action can run per hour (stops spam and bots). |
| CAPTCHA | The "prove you’re human" check. |
| SSR / ISR | The site builds pages on the server so they load fast and rank well on Google. |
| Upsert | "Update if it exists, otherwise create" — how imports avoid duplicates. |
| DataAlert | An automatic flag the system raises when imported data looks wrong. |
| noindex / drip index | A page can be live but hidden from Google until you deliberately release it. Controls SEO timing. |
| PostGIS | The location engine in the database, used for "near me" search. |