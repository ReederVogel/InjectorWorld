# injector.world — Project Lock File

This is the single source of truth for the project. Every decision, every color. If something is in this file, it is locked.

> **Live execution plan lives in `docs/`:**
> - `docs/ROADMAP.md` — phase-by-phase plan + status. Read this to know what to build next.
> - `docs/DECISIONS.md` — append-only decision log. Read before building; never silently contradict.
> - `docs/DONE.md` — ship gate every phase must pass.
> CLAUDE.md = design system + locked decisions. docs/ = roadmap + history.

---

## Git rules (STRICT, non-negotiable)

**Never do any of the following without explicit written instruction from the founder in that exact conversation:**

- `git push` — do not push to any remote under any circumstance.
- `git pull` / `git fetch` — do not pull or fetch from any remote.
- `git branch` / `git checkout -b` — do not create new branches.
- `git commit` — do not commit anything.
- Any interaction with GitHub (no PRs, no issues, no comments, nothing).

**All work is done locally on the `main` branch, in the working tree only.**

Edit files. Run the dev server. That is all. If a task seems to require a commit or push, stop and ask.

---

## Project at a glance

| Thing | Value |
|---|---|
| Product | Content-led directory of Botox and aesthetic injectors |
| Domain | injector.world |
| Market | US primary (phase 1: top 20 metros) |
| MVP scope | Directory + content + claim profile + booking/lead capture |
| Positioning | The trusted guide to expert injectors. Find a verified provider near you, and learn what's actually right for your face. |
| Brand voice | Editorial, calm, honest, expert-led. The Strategist meets Healthline. Not influencer-y. Not clinical-cold. |

---

## Tech stack (locked)

| Layer | Choice |
|---|---|
| Frontend | Next.js 15.4.x (App Router) + React 19 |
| CMS | Payload CMS 3.0 |
| Database | PostgreSQL 18.4 with PostGIS 3.6 (under `postgis` schema, search_path = `public, postgis`) |
| Hosting | Railway (current) → DigitalOcean App Platform (target) |
| Database hosting | Railway Postgres (current) → DigitalOcean Managed PostgreSQL (target) |
| Media storage | Cloudflare R2 via `@payloadcms/storage-s3`. DO Spaces swap = env-only. |
| Email | Resend (behind RESEND_API_KEY — dormant until key is set) |
| Auth | Payload built-in (bcrypt, JWT httpOnly cookie) |

**Note:** `"type": "module"` in package.json (required for Node ESM compat with Payload).

---

## Dev environment

- **Local DB:** `postgres://postgres:admin@localhost:5432/injectors_world_dev`
- **Admin:** `http://localhost:3000/admin` · `admin@injector.world` / `changeme`
- **Routing:** single catch-all `app/(frontend)/[...path]/page.tsx` + `lib/route-resolver.ts`
- **Slug format:** state=`new-york`, city=`new-york-ny`, neighborhood=`upper-east-side`

```
npm run dev              Next dev server at localhost:3000
npm run seed             Idempotent mock data seed (upsert-by-slug)
npm run build            Migrations → search indexes → next build
npm run db:push          Push schema to local DB (needs PAYLOAD_FORCE_PUSH=true NODE_ENV=development --env-file=.env.local)
npm run generate:types   Regenerate payload-types.ts (after schema changes)
npm run generate:importmap  Regenerate admin importmap (after new admin components)
npm run import           CSV bulk import (reads data/samples/)
npm run scan:alerts      Scan for DataAlerts
npm run set:live         Set CA/TX/NY/FL markets live
npm run notify:golive    Send go-live emails (npm run notify:golive TX [--dry-run])
```

**CRITICAL — db:push on Railway hangs** if schema drift triggers drizzle interactive prompts. Fix: run `scripts/migrate-*.sql` against Railway DB first, then redeploy. Build chain runs `scripts/run-migrations.ts` before `db-push` to prevent this.

---

## Design system (locked)

### Visual direction

Clinical premium. Pure white canvas. Deep navy primary. One soft mint accent. Generous whitespace. Editorial restraint.

### Colors

| Token | Hex | Where it's used |
|---|---|---|
| `color/bg/canvas` | `#FFFFFF` | Page background |
| `color/bg/surface` | `#F7F8FA` | Alternating sections, card backgrounds |
| `color/bg/surface-warm` | `#FAF7F2` | Editorial sections (guides, featured) |
| `color/ink/primary` | `#0B1B34` | Headlines, body text, dark UI |
| `color/ink/secondary` | `#475569` | Subheads, metadata |
| `color/ink/tertiary` | `#94A3B8` | Captions, helper text |
| `color/brand/primary` | `#0B1B34` | Navy primary. Buttons, footer, logos |
| `color/brand/accent` | `#3FA68A` | Mint accent. Verified check, links, success |
| `color/brand/accent-soft` | `#E6F2EE` | Mint background fills, chips |
| `color/border/default` | `#E2E8F0` | Card borders, dividers |
| `color/border/subtle` | `#EEF1F5` | Hairline rules |
| `color/state/star` | `#C2A14E` | Star ratings (muted gold, not yellow) |
| `color/state/error` | `#B91C1C` | Errors, risks callouts |
| `color/state/info` | `#1E40AF` | Info callouts |

**Rule:** Mint accent appears at most twice per viewport. Star gold appears only on rating units.

### Dark mode rules (CRITICAL, learned the hard way)

Theming is token-based. Every color is a CSS variable that flips under `.dark` (defined in `app/globals.css`). `darkMode: 'class'` in Tailwind, toggled via `next-themes`. Use token classes (`bg-surface-canvas`, `text-ink-primary`, `border-border`) and the page works in both modes automatically.

The trap: **`--brand-primary` inverts** (navy `#0B1B34` in light becomes near-white in dark, because it doubles as the logo/ink mark). Therefore:

- **Primary buttons: use `bg-brand-primary text-surface-canvas`, NEVER `bg-brand-primary text-white`.** `text-surface-canvas` flips with the surface (white in light, near-black in dark) so text always contrasts. `text-white` on `bg-brand-primary` = white-on-near-white = invisible in dark mode. This bug hit ~20 files once; do not reintroduce it.
- **Decorative navy bands** (page heros on `/injectors`, `/clinics`, the Footer, Pre-footer, Browse-by-State) use literal `bg-[#0B1B34] text-white` on purpose so they stay navy in both modes. That is the correct pattern for an "always-dark section."
- `text-white` is fine on: colored badges (`bg-brand-accent`, category chips), image overlays (`bg-black/55`), and always-dark sections. It is NOT fine on any surface that flips.
- Avoid flat `bg-white` (does not flip). `bg-white/90` chips over photos are acceptable.

### Typography

| Face | Use | Production license | Free substitute (used in mockups) |
|---|---|---|---|
| Tiempos Headline | Display + H1 + H2 + H3 | Klim Type Foundry | Fraunces (Google Fonts) |
| Tiempos Text | Long-form guide body | Klim Type Foundry | Fraunces (Google Fonts) |
| GT America | All UI + body + microcopy | Grilli Type | Inter (Google Fonts) |

### Type scale (desktop / mobile)

| Token | Face | Desktop | Mobile | Weight |
|---|---|---|---|---|
| display | Tiempos Headline | 64 / 72 | 40 / 48 | 500 |
| h1 | Tiempos Headline | 48 / 56 | 32 / 40 | 500 |
| h2 | Tiempos Headline | 36 / 44 | 28 / 36 | 500 |
| h3 | Tiempos Headline | 24 / 32 | 22 / 30 | 500 |
| h4 | GT America | 18 / 26 | 18 / 26 | 600 |
| lede | Tiempos Text | 22 / 34 | 18 / 28 | 400 |
| body-lg | GT America | 18 / 28 | 17 / 26 | 400 |
| body | GT America | 16 / 24 | 16 / 24 | 400 |
| body-sm | GT America | 14 / 20 | 14 / 20 | 400 |
| caption | GT America | 12 / 16 | 12 / 16 | 500 |
| overline | GT America | 11 / 14, +0.08em, UPPERCASE | same | 600 |
| guide-body | Tiempos Text | 19 / 32 | 17 / 28 | 400 |

Tracking: Tiempos at -0.01em on H1/Display. GT America at 0 default. Overline +0.08em.

### Spacing

4px base. Tokens: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128.

Section padding desktop: 96 top/bottom. Mobile: 64 top/bottom.

### Radii

xs: 4 · sm: 8 · md: 12 · lg: 16 · xl: 24 · pill: 999.

Defaults: Buttons pill · Cards lg · Inputs sm · Chips pill · Images md.

### Shadows

- sm: `0 1px 2px rgba(11,27,52,0.06)`
- md: `0 4px 12px rgba(11,27,52,0.08)`
- lg: `0 12px 32px rgba(11,27,52,0.10)`
- hover: `0 8px 24px rgba(11,27,52,0.12)`

### Grid

| Breakpoint | Canvas | Cols | Gutter | Outer |
|---|---|---|---|---|
| Desktop 1440 | 1280 max | 12 | 24 | 80 |
| Tablet 1024 | 960 max | 8 | 20 | 32 |
| Mobile 390 | full | 4 | 16 | 20 |

### Iconography

Phosphor Icons (regular weight) at 20 or 24px. Verified check, license badge, and board cert in mint accent. Others in navy.

---

## Decisions already made (do not re-ask)

| Decision | Locked answer |
|---|---|
| Target market | US primary (top 20 metros) |
| MVP scope | Directory + content + claim profile + booking/lead capture |
| Stack | Next.js + Payload CMS + PostgreSQL + Railway/DigitalOcean |
| Visual direction | Clinical premium |
| Typography (production) | Tiempos Headline + GT America |
| Typography (mockups) | Fraunces + Inter |
| Photography | Real provider photos. Unsplash placeholders in mockups. |
| Hosting | DigitalOcean App Platform + Managed Postgres + Spaces. Vercel = demo only. |
| Media storage | Cloudflare R2 now (DO Spaces swap = env-only). Never Vercel Blob. |
| Leads (v1) | Admin dashboard only. No email/Resend in v1. |
| Auth | Single `Users` collection, roles admin/editor/provider/patient. |
| First real-data markets | Houston TX, NYC NY, LA CA. Rest = "Coming soon" + noindex. |
| AI Face/Skin Analyzer | Skipped (Texas CUBI + Illinois BIPA + medical-advice liability). |
| Newsletter | Double opt-in only. CAN-SPAM: unsubscribe link + physical address in every email. No PHI. |

Full decision history: `docs/DECISIONS.md`.

---

## Non-functional requirements (locked)

Everything below applies to every page on the site.

### SEO
- Server-rendered with Next.js App Router (SSR/ISR).
- Schema.org structured data per template (see schema markup table below).
- XML sitemap, robots.txt, canonical URLs, OG/Twitter cards on every page.
- Breadcrumb schema on every detail page. Internal linking via CMS relationships.
- Core Web Vitals: target green. Lighthouse: target 90+ on all four categories.

### GEO / AEO
- Clear, factual, attributable content. Author + medical reviewer on every editorial piece.
- `llms.txt` at site root. Last-reviewed date on all medical content. Source citations in guides.
- FAQ schema on every page with FAQs. HowTo schema for how-to content.
- Question-style H2/H3s. Featured snippet targeting on cost tables and definitions.

### Security
- HTTPS everywhere. Security headers: HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- Auth via Payload built-in (bcrypt, JWT, session rotation). Rate limiting on all write endpoints.
- Input sanitization (Zod). SQL injection protection (parameterized queries only). XSS: React escapes + DOMPurify for rich text.
- Secrets in ENV vars only, never in code or client bundle. PII encryption at rest for bookings/accounts.
- Audit log on all admin + provider-dashboard actions.

### Scalability
- Static generation for high-traffic pages. ISR for the rest.
- CDN via R2/Spaces CDN for media. PostGIS GIST index on lat/lng. GIN index for full-text search.
- Next.js Image (WebP/AVIF). Lazy-load below fold. Code-split per route. Dynamic imports for map + video.

---

## Brand voice rules

- Editorial, calm, honest, expert-led.
- Mention named medical reviewers wherever possible.
- Trust signals before delight. White space is a feature.
- One mint accent per viewport. Never two.
- No influencer-speak. No fear-based marketing. We educate, not scare.
- Disclaimers in the right places, not spammed.

---

## Top 20 metros (phase 1 scope)

NYC, Los Angeles, Miami, Chicago, Houston, Dallas, Atlanta, Phoenix, Seattle, Boston, Washington DC, San Francisco, Denver, Austin, San Diego, Philadelphia, Nashville, Charlotte, Las Vegas, Portland.

---

## URL structure (locked)

| Pattern | Example | Purpose |
|---|---|---|
| `/` | Homepage | Hero + browse |
| `/[treatment]` | `/botox` | Pillar treatment guide |
| `/[treatment]/[state]` | `/botox/new-york` | State hub |
| `/[treatment]/[city-state]` | `/botox/new-york-ny` | City directory (money page) |
| `/[treatment]/[city-state]/[neighborhood]` | `/botox/new-york-ny/upper-east-side` | Long-tail neighborhood |
| `/injectors/[slug]` | `/injectors/lena-park-md-nyc` | Provider profile |
| `/clinics/[slug]` | `/clinics/park-avenue-dermatology` | Clinic page |
| `/brands/[slug]` | `/brands/radiance-aesthetics` | Brand hub (multi-location group). Indexable only when a branch is in a live market. |
| `/guides/[slug]` | `/guides/botox` | Treatment guide |

Around 40,000 indexable pages at full scale.

---

## Schema markup (locked, per template)

| Template | Schema stack |
|---|---|
| Homepage | Organization + WebSite + SearchAction |
| Provider profile | Physician + AggregateRating + Review |
| Clinic page | MedicalBusiness + LocalBusiness + OpeningHours |
| City directory | BreadcrumbList + FAQPage + ItemList |
| Treatment guide | MedicalWebPage + Article + FAQPage |

---

## Trust signals (must appear on the relevant page)

**Provider page:** License verified badge with state and number · Board certifications · Years of experience · Real photo · Verified reviews · Pricing range · Languages · Accepts new patients.

**Guide page:** Medical reviewer byline with credentials and photo · "Last medically reviewed on [date]" · Author byline · Editorial standards link · Sources count.

**Sitewide:** Medical advisory board page · Editorial standards page · Public corrections log · No incentivized reviews disclosure · Real contact info · Risks and side effects content on every treatment.

---

## User style rules (hard rules, never break)

1. **No em dashes** (—). Use periods, commas, parentheses, or colons.
2. **Plain yet powerful.** No fluff. No filler adverbs.
3. **Hinglish is OK in chat replies**, not in product copy.
4. **No emojis** unless explicitly requested.
5. **Real copy in mockups**, never lorem ipsum.

---

## Open items (not yet decided)

- Logo design (currently a wordmark only)
- Specific medical advisory board members
- Merit-ranking metric weights (formula locked in decisions; exact weights TBD by founder)
- Pricing model / rate card for ad banner + sponsored slots
- Launch date
- `NEWSLETTER_ADDRESS` — real physical address required before any live email send (CAN-SPAM)
- `NEWSLETTER_FROM` domain — must be verified on Resend before sending
