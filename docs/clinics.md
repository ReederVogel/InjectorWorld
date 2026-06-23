# Clinics Collection — Schema Reference

Last updated: 2026-06-23 (Phase 1 schema additions)

---

## Phase 1 additions (2026-06-23)

The following fields were added to the `Clinics` collection as part of the import-driven workflow build-out. All columns were applied directly to the local DB via `scripts/migrate-phase1-schema.sql` and are guarded in `scripts/migrate-pre-push.sql` for Railway/DO deploys.

### Type & Status (sidebar)

| Field | Type | Default | Notes |
|---|---|---|---|
| `clinicType` | select | — | medspa / dermatology / plastic-surgery / dental-aesthetics / other. Appears in main form after description. |
| `status` | select | `draft` | Master publish gate. `published` = live on frontend. `review` = imported but needs admin approval. `draft` = not ready. Sidebar. |
| `dataConfidence` | number (0–100) | — | Scraper confidence score. 100 = fully verified. Sidebar. |
| `needsManualReview` | checkbox | `false` | Flag set by importer when data looks uncertain. Sidebar. |

On migration, all pre-existing clinic rows were set to `status = 'published'` so live data stays visible. New imports default to `draft`.

### Treatments & Services (collapsible, after serviceType)

| Field | Type | Default | Notes |
|---|---|---|---|
| `treatmentsOffered` | relationship → treatments (hasMany) | — | Join table managed by Payload/Drizzle automatically. |
| `offersVirtualConsult` | checkbox | `false` | |
| `acceptsNewPatients` | checkbox | `true` | |
| `startingPrice` | number | — | Lowest service price shown on listing cards ($). |
| `languages` | select (hasMany) | — | ISO codes: en, es, fr, zh, yue, ko, pt, ar, hi, ru. |

### Social (collapsible, after Contact)

| Field | Type | Notes |
|---|---|---|
| `instagramUrl` | text | |
| `tiktokUrl` | text | |
| `facebookUrl` | text | |

---

## Providers — status field (same phase)

A `status` field (select: published / review / draft, default `published`) was added to the `Providers` collection in the same phase. Providers default to `published` because existing data is already live. Only new clinic-first imports use `draft` by default.

---

## Migration files

| File | Purpose | When it runs |
|---|---|---|
| `scripts/migrate-pre-push.sql` | Pre-creates columns BEFORE db:push so Drizzle never sees ambiguous drift and prompts interactively. Idempotent DO blocks with table-existence guards. | First step of `npm run build` (via `run-pre-push-migrations.ts`) |
| `scripts/migrate-phase1-schema.sql` | Idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` for all Phase 1 columns + the `UPDATE clinics SET status = 'published'` backfill. | After db:push (via `run-migrations.ts`) |

To apply locally when Postgres is running:

```bash
PGPASSWORD=admin psql -U postgres -d injectors_world_dev -f scripts/migrate-phase1-schema.sql
```

---

## DB column name mapping (Payload field → Postgres column)

Payload snake_cases camelCase field names.

| Payload field | Postgres column |
|---|---|
| `clinicType` | `clinic_type` |
| `status` | `status` |
| `dataConfidence` | `data_confidence` |
| `needsManualReview` | `needs_manual_review` |
| `treatmentsOffered` | join table (clinics_rels or similar, managed by Payload) |
| `offersVirtualConsult` | `offers_virtual_consult` |
| `acceptsNewPatients` | `accepts_new_patients` |
| `startingPrice` | `starting_price` |
| `languages` | `languages` (jsonb) |
| `instagramUrl` | `instagram_url` |
| `tiktokUrl` | `tiktok_url` |
| `facebookUrl` | `facebook_url` |

---

## Clinics — Import Guide

### Master CSV schema (full column list)

| CSV column | Payload field | Notes |
|---|---|---|
| `clinic_id` | `clinicId` | Required. Upsert key — re-running a CSV updates existing records. |
| `clinic_name` | `clinicName` | Required. |
| `clinic_type` | `clinicType` | select: medspa / dermatology / plastic-surgery / dental-aesthetics / other |
| `description` | `description` | |
| `address_line_1` | `addressLine1` | Required. |
| `address_line_2` | `addressLine2` | |
| `city` | `city` | Required. |
| `state` | `state` | Required. 2-letter code (TX, NY, …). |
| `zip` | `zip` | |
| `neighborhood` | `neighborhood` | |
| `county` | `county` | |
| `country` | `country` | Default: US |
| `latitude` | `latitude` | Required (float). Clinic is skipped without coords. |
| `longitude` | `longitude` | Required (float). |
| `google_place_id` | `googlePlaceId` | |
| `google_maps_url` | `googleMapsUrl` | |
| `directions_url` | `directionsUrl` | |
| `phone` | `phone` | Normalized to E.164 (+1XXXXXXXXXX) when possible. |
| `email` | `email` | |
| `website_url` | `websiteUrl` | |
| `booking_url` | `bookingUrl` | |
| `facebook_url` | `facebookUrl` | Phase 1 |
| `instagram_url` | `instagramUrl` | Phase 1 |
| `tiktok_url` | `tiktokUrl` | Phase 1 |
| `hours_json` | `hoursJson` | JSON string or object |
| `service_type` | `serviceType` | In-Person / Telehealth / Both. Default: In-Person |
| `payment_methods` | `paymentMethods` | Semicolon list |
| `amenities` | `amenities` | Semicolon list |
| `logo_url` | `logoUrl` | |
| `clinic_photo_urls` | `clinicPhotoUrls` | Comma or semicolon separated URLs |
| `aggregate_rating` | `aggregateRating` | float |
| `aggregate_rating_count` | `aggregateRatingCount` | integer |
| `source_urls` | `sourceUrls` | Comma or semicolon separated URLs |
| `data_confidence` | `dataConfidence` | float 0–100. Phase 1 |
| `needs_manual_review` | `needsManualReview` | true/1/yes → true. Phase 1 |
| `publish_status` | drives `status` | published / review / draft. Phase 1 |
| `last_scraped_date` | `lastScrapedDate` | ISO date string |
| `treatment_ids` | `treatmentsOffered` | Comma or semicolon separated treatment slugs or names. Auto-creates unknown treatments. Phase 1 |
| `languages` | `languages` | Semicolon separated ISO codes: en;es |
| `offers_virtual_consult` | `offersVirtualConsult` | boolean string |
| `accepts_new_patients` | `acceptsNewPatients` | boolean string. Default: true |
| `starting_price` | `startingPrice` | float ($) |

Boolean string parsing: `true`, `1`, `yes`, `y` → true. Anything else (including blank) → false.

### Status routing rules

Every clinic row is assigned a `status` field on import (create and update). The logic runs in priority order:

1. `needs_manual_review: true` — always routes to **review**, regardless of other fields.
2. `publish_status` in CSV — if set to `published`, `review`, or `draft`, that value is used directly.
3. Critical field check — if all of these are present: `clinic_name`, `city`, `state`, `(phone or website_url)`, `latitude`, `longitude` → **published**. Otherwise → **review**.

Critical fields (auto-publish gate): `clinic_name` + `city` + `state` + (`phone` OR `website_url`) + `latitude` + `longitude`.

### Auto-treatment creation

When a clinic row contains `treatment_ids`, each value is looked up in the Treatments collection:

1. The value is trimmed and slugified (spaces → hyphens, lowercase).
2. The alias map in `lib/import/helpers.ts` is checked first (e.g. "Masseter" → `masseter-botox`).
3. If a matching Treatment slug exists in the DB, its ID is used.
4. If no match is found, a minimal Treatment record is created: `{ name: "Title Cased Value", slug: "kebab-slug", category: "other" }`.
5. The newly created treatment name is added to `treatmentsAutoCreated` in the import result.
6. The slug-to-ID map is updated so the same treatment is not created twice within the same import run.

To find auto-created treatments after an import: go to Admin → Catalog → Treatments, sort by date created.

### Import result summary

```
clinics: 47 new, 12 updated, 2 skipped
Clinics: 31 published · 12 sent to review · 4 draft
Auto-created treatments: Skin Booster, Nano Botox
```

| Field | Meaning |
|---|---|
| `created` | New clinic records written |
| `updated` | Existing records (matched by `clinic_id`) updated |
| `skipped` | Rows that errored or were missing required fields |
| `publishedCount` | Records that received `status: published` |
| `reviewCount` | Records that landed in review queue |
| `draftCount` | Records saved as draft |
| `treatmentsAutoCreated` | Names of Treatment records created fresh during this import |

### How to run a clinic import

**CLI (sample data):**
```bash
npm run import
```

**CLI (real data directory):**
```bash
npm run import -- --dir ./data/real --batch real-2026-06
```

**Dry run (preview counts, write nothing):**
```bash
npm run import -- --dry-run
```

**Admin UI:** Admin → Operations dashboard → Data Import → upload clinics CSV → Dry run first, then Commit.

---

## Phase 3: Clinics-First Frontend (2026-06-23)

### Status filter

All public frontend queries filter by `status: 'published'`. This applies to:
- City directory (`getCityDirectory` — providers and clinics)
- State hub (`getStateHub` — providers and clinics)
- Treatment pillar and treatment-state pages (providers)
- `/injectors` listing (`getProvidersListing`)
- `/clinics` listing (`getClinicsListing`)
- Hero search (`getHeroData` — providers and clinics)
- Homepage featured providers (`getHomePageData`)
- Search SQL queries (`searchDirectory` — `p.status = 'published'` and `c.status = 'published'`)
- Suggest autocomplete SQL (provider and clinic name-prefix queries)
- Sitemap slug helpers (`getAllProviderSlugs`, `getAllClinicSlugs`)
- Static path generation (`getAllRoutePaths`)

Admin routes (all `/api/admin/*`) see all records regardless of status.

### Default tab order

City directory pages and state hub pages: Clinics tab is default (left), Providers tab secondary (right). This is enforced in `CityListingTabs` and `ProviderClinicResults`.

The city directory tab (`CityListingTabs`) now shows even when `clinics.length === 0` (as long as providers or clinics exist). The `DirectoryClinicsView` renders a "No clinics listed in this area yet" empty state when the array is empty.

### Clinics without providers

`getCityDirectory` no longer filters out clinics that have zero providers for the given treatment. All published clinics in the city appear in the Clinics tab. Provider count on cards shows only when `> 0`.

### Clinic card fields (DirectoryClinicCard)

Three new display fields added:
1. `clinicType` badge: pill above clinic name. Values: medspa / dermatology / plastic-surgery / dental-aesthetics / other. Shown only when set.
2. `treatmentsOffered` chips: up to 3 treatment names below address. "+N more" overflow. Requires clinic query at `depth: 1` to hydrate relationship names. Available in city directory queries only (state hub fetches at depth 0).
3. `startingPrice`: "from $X" shown in the pricing area. Shown only when set.

### Page-level clinic placement

- `/injectors`: "Featured Clinics" section (grid of 6, sorted by rating) shown above the providers grid. Uses `getClinicsListing(6)`. Skipped entirely when no published clinics exist.
- `/clinics`: Primary listing page. Sorted by `aggregateRating` desc (previously `aggregateRatingCount`). Status filter added.
- State hubs (`/[state-slug]`): "Top Clinics in [State]" grid (up to 6) shown above the "Injectors" section. "View all" links to `/clinics`.
- City directory (`/[treatment]/[city-slug]`): Clinics tab is now default.

### Search ranking

`rankClinics` in `lib/ranking.ts` adds a uniform `+0.1` tiebreaker to all clinic blended scores. This ensures clinics rank above providers of equal merit when results are merged in a combined view.

Suggest autocomplete returns clinics before providers in the `suggestions` array.
