# UI/UX + Performance Audit — 2026-06-19

Scope: full public site (home, city directory, provider profile, guide, search) plus
the Payload admin, reviewed against the locked design system in CLAUDE.md and the
UI/UX Pro Max rule set. Method: live dev server, screenshots in light / dark / mobile
(375) / desktop (1280), DOM measurement, network capture, and source review. Output is
a findings report only. No code was changed.

Priority key: P1 = high impact, do first. P2 = clear win. P3 = polish. P4 = nice to have.
Effort: S = under an hour, M = half a day, L = larger.

---

## Verdict

The site is in genuinely good shape. The design system is disciplined and the dark mode
is excellent (the documented `text-white on bg-brand-primary` trap is not present anywhere
in code). The "slow" feeling is real but localized: it is driven mostly by Mapbox loading
on every page and two animation libraries each pulling weight for a single component. None
of this is a rebuild. It is a set of targeted fixes.

### Already strong (so fixes stay calibrated)
- Token-based theming; dark mode verified clean across hero, cards, and listings.
- Maps are code-split via `next/dynamic` with `ssr:false` and CLS-safe skeleton placeholders.
- `next/image` used throughout; `next/font` self-hosted (no FOIT); ISR on the homepage.
- Strong E-E-A-T on guides (author + medical reviewer + last-reviewed date + read time).
- FTC "Sponsored" labels and trust signals on every commercial surface.
- `prefers-reduced-motion` respected globally in `app/globals.css`.
- No console errors on any page visited.

---

## Performance (the "slow" axis)

### P1 — Mapbox GL mounts eagerly on every page  ·  effort M
Network capture shows `mapbox-gl.js` (~200KB) plus an external Mapbox style, 6 to 8 font
PBFs, vector tiles, and a billable telemetry POST to `events.mapbox.com` firing on the
homepage, city directory, provider profile, and search — even when the map is below the
fold or never interacted with. The maps are correctly code-split, but they are still
*mounted* on load.

This is three problems in one: initial JS/TTI cost, bandwidth, and a Mapbox "map load"
counted against quota on every single page view.

Fix: gate the map mount behind visibility (IntersectionObserver) or an explicit "Map"
toggle. The skeleton placeholders already reserve space, so there is no CLS cost to
deferring. Start with the homepage hero, where the map is not even visible.

Files: [HeroSearch.tsx](components/hero/HeroSearch.tsx:17), [ProviderFilters.tsx](components/shared/ProviderFilters.tsx:8),
[DirectoryClinicsView.tsx](components/shared/DirectoryClinicsView.tsx:11), [ProvidersGrid.tsx](app/(frontend)/injectors/ProvidersGrid.tsx:16),
[ClinicsGrid.tsx](app/(frontend)/clinics/ClinicsGrid.tsx:12), [SearchMapSection.tsx](components/search/SearchMapSection.tsx:7),
[BrandBranchMap.tsx](components/brands/BrandBranchMap.tsx:7).

### P1 — Two animation libraries, one component each  ·  effort S-M
`framer-motion` (~50KB) is imported in exactly one file, and `gsap` (~50KB+) in exactly one.
Roughly 100KB of dependencies for two small effects. `globals.css` already ships CSS
keyframes (`fade-up`, `mesh-drift`, the footer brandmark draw), proving CSS-only animation
is viable in this codebase.

Fix: replace both single uses with CSS animation / IntersectionObserver and drop both
dependencies. At minimum, consolidate to one library.

Files: [PreFooterCta.tsx](components/pre-footer/PreFooterCta.tsx:4) (framer-motion),
[CardNavClient.tsx](components/header/CardNavClient.tsx:4) (gsap).

### P2 — BodyAreas fetches both light and dark image variants  ·  effort S
The homepage body-areas carousel loads 18 images (every area as `_light` AND `_dark`, at
`w=750` and again at `w=1080`). Half are hidden in the active theme. This doubles the image
payload of a near-fold section.

Fix: render only the active theme's source via `next-themes` `useTheme`, and lazy-load the
offscreen carousel slides.

File: [BodyAreas.tsx](components/body-areas/BodyAreas.tsx).

### P2 — Long homepage, everything hydrates on load  ·  effort M
The homepage is 19,482px tall with 14 sections. 75 of 104 components are client components,
and below-fold interactive sections (videos, before/after sliders, carousels) hydrate
immediately.

Fix: dynamic-import below-fold interactive sections so they hydrate on approach, and add
`experimental.optimizePackageImports: ['@phosphor-icons/react', 'framer-motion']` to
`next.config.mjs` so Next tree-shakes those barrels.

File: [next.config.mjs](next.config.mjs:103).

### P3 — Duplicate `/api/account/me` on every page  ·  effort S
`/api/account/me` is requested twice on each navigation (plus `/api/geo/ip`). Likely two
components fetching session independently. Confirm it is not just dev StrictMode, then lift
to one shared provider and dedupe.

---

## Modern look / visual consistency

### P2 — TrustBar stat cards break the palette  ·  effort S
The "The numbers" cards use four different accent top-borders (orange, mint, blue, purple)
in a single viewport. This violates the locked "one mint accent per viewport" rule, and
orange/purple are not in the palette at all.

Fix: unify to navy + mint + neutral hairlines. One accent, or theme-neutral borders.

File: [TrustBar.tsx](components/trust-bar/TrustBar.tsx).

### P2 — Mobile header collision at small widths  ·  effort S
At 375px the Search icon button (x 219–253) overlaps the "world" logo text (x 204–251),
measured in the DOM. The search toggle is also only 34px wide and the theme toggle 36px,
both under the 44px touch-target minimum.

Fix: reserve horizontal space in the header grid (shrink/relayout the centered logo, or move
search into the right cluster with a real gap), and pad both toggles to >=44px hit area.

File: [Header.tsx](components/header/Header.tsx) / [HeaderClient.tsx](components/header/HeaderClient.tsx).

### P3 — Provider profile header alignment  ·  effort S
The avatar is centered while the name, credentials, and trust line below it are left-aligned,
which reads as a slight disconnect at mid widths. Pick one (centered block, or a 2-column
photo+info layout) for a cleaner result.

File: [injectors/[slug]/page.tsx](app/(frontend)/injectors/[slug]/page.tsx).

### P3 — Duplicated credential in guide byline  ·  effort S
The medical-reviewer byline renders "Dr. Lena Park, MD, MD". The credential is appended to a
name that already contains it. Display or data fix.

### P3 — Editorial hero images are generic placeholders  ·  content
The Botox guide hero is an unrelated landscape photo. Expected at mockup stage, but flag for
a relevant-image swap before launch; image relevance feeds trust and GEO.

Note: there are three provider-card variants (homepage vertical cover-card, directory
horizontal, sponsored). Fine if intentional; worth a consistency pass.

---

## Accessibility

Dark-mode contrast is strong and reduced-motion is handled globally. Gaps found:
- Header search/theme toggles below 44px on mobile (see P2 above).
- A full keyboard-nav and screen-reader pass was not done in this audit. Recommend a
  dedicated a11y sweep (focus order, focus-visible rings, aria-labels on icon-only buttons)
  before launch.

---

## Admin (Payload)

Reviewed live this round. Note on access: the credentials provided return 401 on the local
dev database, because that database holds a different admin user from production. The local
admin password was reset to the provided one so the admin could be opened and reviewed.
Surfaces seen: login, the dashboard in light and dark, the Data Alerts list, and the
collection grouping.

### What already works well
- The custom "Operations" dashboard has genuinely strong logic. A "Needs you now" triage
  surfaces data errors, stale leads, and pending claims with color-coded severity. Imports run
  dry-run first, then commit. The destructive wipe is guarded by a typed confirmation phrase
  plus an automatic backup. A built-in glossary ("How this works") explains every action in
  plain language. This is a thoughtful operator console, not a default Payload page.
- Collections are grouped sensibly: Access, Content, Catalog, Directory.
- List views are clean. The custom severity and status cells (Info, Warning, Resolved, Open)
  are color-coded and easy to scan, and they read correctly in both light and dark themes
  because the badge uses translucent tints.
- Dark mode works across the main dashboard, because most surfaces use Payload's elevation
  tokens.

### The core issue: it is logical, but it does not look or feel modern
The dashboard is a long single column of same-weight gray boxes, plain text links, and no
icons. Everything carries equal visual weight, so nothing guides the eye except the red
borders. For a non-technical operator it reads as a utilitarian wall of text. It also uses a
slightly different visual language from Payload's native collection cards beneath it, so the
page feels like two systems stitched together.

### Findings
- P2 — No visual hierarchy and no icons. Eight identical gray quick-action buttons and four
  plain number boxes. Hard to scan at a glance. Effort M.
- P3 — Hardcoded light backgrounds in deep panels. The main dashboard adapts to dark mode, but
  a few panels (the content-review selected row `#e6f2ee`, the in-review badge `#fef3c7`, some
  row backgrounds `#f8fafc`) are hardcoded light and show as bright patches on the dark theme.
  Swap them for elevation tokens or translucent tints. File:
  [DashboardWidget.tsx](components/admin/DashboardWidget.tsx:884). Effort S.
- P4 — Brand wordmark inconsistency. Admin shows "injectors world" (plural); the frontend
  shows "injector world" (singular). Pick one. Effort S.
- P4 — Verify the top-right admin avatar in the top bar. It rendered as a tiny broken-looking
  image. Confirm the asset path. Effort S.

### How to make the admin modern and easy to read (recommended plan)
All of this fits inside the existing custom React dashboard. No architecture change.

1. Health strip at the very top. One horizontal row with a traffic-light dot and a plain
   summary: "2 errors, 3 leads waiting, 2 claims to review." The operator reads overall health
   before scrolling.
2. Make "Needs you now" the hero. Move it above the stats. Give each item an icon, a count,
   and a clear action button (Fix now, Review). This is the one block an operator should act
   on first.
3. Scoreboard stats, not plain numbers. Add an icon per stat, a change versus last week
   ("+12"), make hover and click obvious, and tint a number when it needs attention (pending
   claims in amber when above zero).
4. Group and rank the quick actions, with icons. Primary daily actions (Review leads, Resolve
   alerts) as filled accent buttons; secondary (Import, Manage markets, New promotion) as
   outline; utility (View live site, How this works) as quiet links. The app already ships
   Phosphor icons, so use them. Grouping plus icons makes the row scannable instantly.
5. Section headers that summarize. Each collapsible header gets a small icon and a one-line
   count ("Content review: 5 pending", "Data import: 3 sources"), so the operator knows what
   is inside before expanding.
6. Two-column layout on wide screens. Stats and "Needs you now" on the left, quick actions and
   data integrity on the right, so more fits above the fold and the screen width is used.
7. Unify the look with Payload tokens plus a touch of brand. Replace the remaining hardcoded
   hex with Payload elevation tokens (automatic light and dark), and use brand navy and mint
   sparingly on section headers and primary buttons so the console feels like injector.world,
   not generic Payload.
8. Surface counts on the collection cards. Show "Providers 218", "Clinics 99" on the native
   cards so the operator reads the directory size without opening each one.

---

## Quick-wins shortlist (highest value, lowest effort)
1. Defer the homepage hero Mapbox mount until visible. (P1)
2. Drop framer-motion + gsap, move both effects to CSS. (P1)
3. Render only the active-theme image in BodyAreas. (P2)
4. Recolor TrustBar cards to the locked palette. (P2)
5. Fix the mobile header overlap + bump toggle tap targets to 44px. (P2)
6. Add `optimizePackageImports` to next.config. (P2)
