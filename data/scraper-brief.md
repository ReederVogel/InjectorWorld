# injector.world — Data Scraper Brief

**What we need:** A US-wide dataset of aesthetic injectors, the clinics they work at, their reviews, their before/after photos, and the questions they have publicly answered.

**Scope (phase 1):** Top 20 US metros. NYC, LA, Miami, Chicago, Houston, Dallas, Atlanta, Phoenix, Seattle, Boston, Washington DC, San Francisco, Denver, Austin, San Diego, Philadelphia, Nashville, Charlotte, Las Vegas, Portland.

**Target volume:**

- 15,000 providers
- 5,000 clinics
- 50,000 reviews
- 10,000 photos (5,000 before/after pairs + clinic interiors + headshots)
- 8,000 Q&A pairs

---

## File 1: `providers.csv`

The individual injector. The most important file.

| Field                        | Type                    | Required            | Example                                               | Notes                                      |
| ---------------------------- | ----------------------- | ------------------- | ----------------------------------------------------- | ------------------------------------------ |
| `provider_id`                | string                  | yes                 | `prov-nyc-00001`                                      | Auto-generated. Use this as primary key.   |
| `full_name`                  | string                  | yes                 | `Lena Park`                                           | First + last only, no titles               |
| `credentials`                | string                  | yes                 | `MD`                                                  | One of: MD, DO, NP, PA, RN, DDS            |
| `title`                      | string                  | yes                 | `Board-Certified Dermatologist`                       | Their professional title                   |
| `board_certifications`       | string (semicolon list) | no                  | `Dermatology; AAD Fellow`                             |                                            |
| `license_number`             | string                  | yes                 | `271832`                                              | From state medical board                   |
| `license_state`              | string (2-letter)       | yes                 | `NY`                                                  |                                            |
| `license_status`             | string                  | yes                 | `Active`                                              | Active / Inactive / Expired                |
| `license_verification_url`   | URL                     | yes                 | `https://...gov/lookup?id=...`                        | Direct link to state board record          |
| `npi_number`                 | string                  | yes for MD/DO/NP/PA | `1234567890`                                          | From NPI Registry                          |
| `years_experience`           | integer                 | no                  | `14`                                                  |                                            |
| `year_started_practicing`    | integer                 | no                  | `2010`                                                |                                            |
| `clinic_id`                  | string (FK)             | yes                 | `clinic-nyc-00042`                                    | Links to clinics.csv                       |
| `tagline`                    | string (max 100 char)   | no                  | `Conservative, expert Botox on the Upper East Side`   | Short pitch line                           |
| `bio`                        | text                    | no                  | 2 to 3 paragraphs                                     | From clinic website                        |
| `profile_photo_url`          | URL                     | no                  | `https://...jpg`                                      | Direct image link                          |
| `languages`                  | string (semicolon list) | no                  | `English; Spanish; Korean`                            |                                            |
| `gender`                     | string                  | no                  | `Female`                                              | Female / Male / Non-binary / Unknown       |
| `treatments_offered`         | string (semicolon list) | yes                 | `Botox; Dysport; Lip Filler; Tear Trough; Masseter`   | Use our master treatment list              |
| `specialties`                | string (semicolon list) | no                  | `Forehead; Crow's Feet; Tear Trough; Masseter`        | More specific than treatments              |
| `services_offered`           | string (semicolon list) | no                  | `Consultation; Botox; Lip Filler; Microneedling; PRP` | Broader menu including non-injectables     |
| `pricing_botox_per_unit`     | number                  | no                  | `16`                                                  | USD                                        |
| `pricing_filler_per_syringe` | number                  | no                  | `850`                                                 | USD                                        |
| `pricing_consultation`       | number                  | no                  | `100`                                                 | USD. `0` if free                           |
| `accepts_new_patients`       | boolean                 | no                  | `true`                                                |                                            |
| `offers_virtual_consult`     | boolean                 | no                  | `false`                                               |                                            |
| `offers_in_person`           | boolean                 | yes                 | `true`                                                | Almost always true                         |
| `website_url`                | URL                     | no                  | `https://...com/providers/lena-park`                  |                                            |
| `email`                      | string                  | no                  | `lena@...com`                                         |                                            |
| `phone_direct`               | string                  | no                  | `+1 212 555 0100`                                     | E.164 format if possible                   |
| `instagram_url`              | URL                     | no                  |                                                       |                                            |
| `tiktok_url`                 | URL                     | no                  |                                                       |                                            |
| `linkedin_url`               | URL                     | no                  |                                                       |                                            |
| `aggregate_rating`           | float                   | no                  | `4.9`                                                 | Average across all sources. Out of 5.      |
| `aggregate_rating_count`     | integer                 | no                  | `412`                                                 | Total review count across sources          |
| `source_urls`                | string (semicolon list) | yes                 | `https://...; https://...`                            | Every URL the data came from. Audit trail. |
| `last_scraped_date`          | date                    | yes                 | `2026-05-30`                                          |                                            |

---

## File 2: `clinics.csv`

The physical practice or medspa. Includes all map and location data.

| Field                    | Type                    | Required | Example                                                                                                                    | Notes                                                 |
| ------------------------ | ----------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `clinic_id`              | string                  | yes      | `clinic-nyc-00042`                                                                                                         | Primary key                                           |
| `clinic_name`            | string                  | yes      | `Park Avenue Dermatology`                                                                                                  |                                                       |
| `tagline`                | string (max 100 char)   | no       | `Upper East Side's most reviewed dermatology practice`                                                                     |                                                       |
| `description`            | text                    | no       | 2 paragraphs                                                                                                               |                                                       |
| **Address**              |                         |          |                                                                                                                            |                                                       |
| `address_line_1`         | string                  | yes      | `1000 Park Avenue`                                                                                                         |                                                       |
| `address_line_2`         | string                  | no       | `Suite 3B`                                                                                                                 |                                                       |
| `city`                   | string                  | yes      | `New York`                                                                                                                 |                                                       |
| `state`                  | string (2-letter)       | yes      | `NY`                                                                                                                       |                                                       |
| `zip`                    | string                  | yes      | `10028`                                                                                                                    |                                                       |
| `neighborhood`           | string                  | yes      | `Upper East Side`                                                                                                          | Critical for SEO. Use Google Maps neighborhood label. |
| `county`                 | string                  | no       | `New York County`                                                                                                          |                                                       |
| `country`                | string                  | yes      | `US`                                                                                                                       |                                                       |
| **Map data**             |                         |          |                                                                                                                            |                                                       |
| `latitude`               | float (6 decimals)      | yes      | `40.778964`                                                                                                                |                                                       |
| `longitude`              | float (6 decimals)      | yes      | `-73.961234`                                                                                                               |                                                       |
| `google_place_id`        | string                  | yes      | `ChIJN1t_tDeuEmsRUsoyG83frY4`                                                                                              | From Google Places API. Most important map field.     |
| `google_maps_url`        | URL                     | yes      | `https://maps.google.com/?cid=12345678`                                                                                    | Direct link to the listing on Google Maps             |
| `directions_url`         | URL                     | yes      | `https://www.google.com/maps/dir/?api=1&destination=40.778964,-73.961234&destination_place_id=ChIJN1t_tDeuEmsRUsoyG83frY4` | Pre-built Google Maps directions URL                  |
| `apple_maps_url`         | URL                     | no       | `https://maps.apple.com/?q=Park+Avenue+Dermatology&ll=40.778964,-73.961234`                                                | For iOS users                                         |
| **Contact**              |                         |          |                                                                                                                            |                                                       |
| `phone`                  | string                  | yes      | `+1 212 555 0100`                                                                                                          | E.164 format                                          |
| `email`                  | string                  | no       | `info@...com`                                                                                                              |                                                       |
| `website_url`            | URL                     | yes      | `https://...com`                                                                                                           |                                                       |
| `booking_url`            | URL                     | no       | `https://...com/book`                                                                                                      | Direct booking link if available                      |
| **Hours**                |                         |          |                                                                                                                            |                                                       |
| `hours_json`             | JSON string             | no       | `{"mon":"9-18","tue":"9-18","wed":"closed",...}`                                                                           | 24h format. Use `closed` for closed days.             |
| **Service**              |                         |          |                                                                                                                            |                                                       |
| `service_type`           | string                  | yes      | `In-Person`                                                                                                                | One of: In-Person, Telehealth, Both                   |
| `accepts_insurance`      | boolean                 | no       | `false`                                                                                                                    |                                                       |
| `payment_methods`        | string (semicolon list) | no       | `Visa; Mastercard; Care Credit; Cherry`                                                                                    |                                                       |
| `amenities`              | string (semicolon list) | no       | `Parking; Wheelchair accessible; Wi-Fi`                                                                                    |                                                       |
| **Photos**               |                         |          |                                                                                                                            |                                                       |
| `logo_url`               | URL                     | no       | `https://...png`                                                                                                           |                                                       |
| `clinic_photo_urls`      | string (semicolon list) | no       | `url1; url2; url3`                                                                                                         | Interior, exterior, treatment room                    |
| **Ratings**              |                         |          |                                                                                                                            |                                                       |
| `aggregate_rating`       | float                   | no       | `4.7`                                                                                                                      | Out of 5                                              |
| `aggregate_rating_count` | integer                 | no       | `412`                                                                                                                      |                                                       |
| **Relationships**        |                         |          |                                                                                                                            |                                                       |
| `provider_ids`           | string (semicolon list) | yes      | `prov-nyc-00001; prov-nyc-00002`                                                                                           | All injectors at this clinic                          |
| **Meta**                 |                         |          |                                                                                                                            |                                                       |
| `year_established`       | integer                 | no       | `2008`                                                                                                                     |                                                       |
| `source_urls`            | string (semicolon list) | yes      | URLs scraped from                                                                                                          |                                                       |
| `last_scraped_date`      | date                    | yes      | `2026-05-30`                                                                                                               |                                                       |

---

## File 3: `reviews.csv`

Patient reviews from all public sources.

| Field                    | Type          | Required | Example                                                                    |
| ------------------------ | ------------- | -------- | -------------------------------------------------------------------------- |
| `review_id`              | string        | yes      | `rev-00000001`                                                             |
| `provider_id`            | string (FK)   | no       | `prov-nyc-00001` (when review names a specific injector)                   |
| `clinic_id`              | string (FK)   | yes      | `clinic-nyc-00042`                                                         |
| `reviewer_first_name`    | string        | no       | `Maya`                                                                     |
| `reviewer_initial`       | string        | no       | `R`                                                                        |
| `reviewer_age_range`     | string        | no       | `30-34`                                                                    |
| `reviewer_city`          | string        | no       | `Brooklyn`                                                                 |
| `rating`                 | integer (1-5) | yes      | `5`                                                                        |
| `review_title`           | string        | no       | `Best Botox in NYC`                                                        |
| `review_text`            | text          | yes      | Full review body                                                           |
| `treatment_tag`          | string        | no       | `Botox`                                                                    |
| `review_date`            | date          | yes      | `2026-04-12`                                                               |
| `source_platform`        | string        | yes      | `google` (one of: google, yelp, healthgrades, vitals, zocdoc, clinic_site) |
| `source_url`             | URL           | yes      | `https://...`                                                              |
| `response_from_provider` | text          | no       | Reply text if provider responded                                           |
| `response_date`          | date          | no       | `2026-04-14`                                                               |

---

## File 4: `photos.csv`

Provider photos, clinic photos, and before/after pairs.

| Field                  | Type        | Required | Example                                                                                                            |
| ---------------------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `photo_id`             | string      | yes      | `ph-00000001`                                                                                                      |
| `provider_id`          | string (FK) | no       | `prov-nyc-00001`                                                                                                   |
| `clinic_id`            | string (FK) | no       | `clinic-nyc-00042`                                                                                                 |
| `treatment_tag`        | string      | no       | `Lip Filler`                                                                                                       |
| `photo_url`            | URL         | yes      | `https://...jpg`                                                                                                   |
| `type`                 | string      | yes      | One of: `before`, `after`, `headshot`, `clinic_interior`, `clinic_exterior`, `treatment_room`, `team`, `equipment` |
| `pair_id`              | string      | no       | `pair-00001` (use same id to link a before + after)                                                                |
| `weeks_post_treatment` | integer     | no       | `4` (only on `after` photos)                                                                                       |
| `caption`              | string      | no       | Photo caption if any                                                                                               |
| `consent_documented`   | boolean     | no       | `false` (we will verify before publishing)                                                                         |
| `source_platform`      | string      | yes      | `clinic_site` / `google` / `instagram`                                                                             |
| `source_url`           | URL         | yes      |                                                                                                                    |

---

## File 5: `qa.csv`

Public questions answered by providers. Big SEO long-tail capture.

| Field                     | Type        | Required | Example                                       |
| ------------------------- | ----------- | -------- | --------------------------------------------- |
| `qa_id`                   | string      | yes      | `qa-00000001`                                 |
| `question_title`          | string      | yes      | `Is Botox safe during pregnancy?`             |
| `question_text`           | text        | no       | Full question body                            |
| `answered_by_provider_id` | string (FK) | no       | `prov-nyc-00001`                              |
| `answered_by_name`        | string      | no       | `Dr. Lena Park` (when provider not in our DB) |
| `answer_text`             | text        | yes      | Full answer                                   |
| `treatment_tag`           | string      | no       | `Botox`                                       |
| `city_tag`                | string      | no       | `New York`                                    |
| `source_platform`         | string      | yes      | `clinic_blog` / `forum` / `directory`         |
| `source_url`              | URL         | yes      |                                               |
| `date`                    | date        | no       | `2026-03-22`                                  |

---

## Rules

1. **Deduplicate** providers by `full_name + license_state + license_number`. Deduplicate clinics by `google_place_id`.
2. **Lat/lng is mandatory** on every clinic.
3. **Audit trail.** Every row must have at least one `source_url`.
4. **Flag low-confidence matches.** Output a 6th file `dedup_review.csv` listing any rows that needed manual matching.
5. **Save raw HTML samples** of the first 100 records per source. Zip and deliver alongside the CSVs.
6. **Phone numbers in E.164 format** (+1 212 555 0100), not free text.
7. **Dates in ISO format** (YYYY-MM-DD).
8. **Empty cells are blank.** Do not write `N/A` or `null` or `unknown`.

---

## Deliverables

| File                     | Format    | Notes                                                         |
| ------------------------ | --------- | ------------------------------------------------------------- |
| `providers.csv`          | UTF-8 CSV | ~15,000 rows                                                  |
| `clinics.csv`            | UTF-8 CSV | ~5,000 rows                                                   |
| `reviews.csv`            | UTF-8 CSV | ~50,000 rows                                                  |
| `photos.csv`             | UTF-8 CSV | ~10,000 rows                                                  |
| `qa.csv`                 | UTF-8 CSV | ~8,000 rows                                                   |
| `dedup_review.csv`       | UTF-8 CSV | Low-confidence matches                                        |
| `raw_samples.zip`        | Zip       | First 100 raw HTML per source                                 |
| `data_quality_report.md` | Markdown  | Total rows, null rate per field, dedup rate, source breakdown |
