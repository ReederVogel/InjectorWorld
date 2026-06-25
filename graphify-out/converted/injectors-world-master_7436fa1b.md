<!-- converted from injectors-world-master.xlsx -->

## Sheet: Instructions
|  | injector.world — Master Import Sheet |  |
| --- | --- | --- |
|  | HOW TO USE |  |
|  | 1. Clinics tab | Fill in every clinic first. Each row = one location. |
|  | 2. Providers tab | Each row = one injector. clinic_id must match a value from the Clinics tab. |
|  | 3. Reviews tab | Each row = one review. clinic_id must match Clinics tab. |
|  | 4. Photos tab | Each row = one photo. provider_id or clinic_id must match. |
|  | 5. Convert & upload | Run:  python scripts/excel-to-import.py
Then upload data/import/combined.csv via Admin → Import. |
|  | COLOR CODING |  |
|  | Red header | Required field — cannot be blank. Row will be skipped on import. |
|  | Blue header | Optional field — leave blank if not available. |
|  | Gray example row | Row 2 on each tab is a sample. Delete or overwrite before uploading. |
|  | IMPORTANT RULES |  |
|  | clinic_id / provider_id | Keep the scraper IDs exactly as-is (e.g. clinic-rs-123456). Do not renumber. |
|  | treatments_offered | Semicolon-separated. Use exact names: Botox; Lip Filler; Sculptra |
|  | provider_ids (on clinic) | Semicolon-separated list of all provider_ids working at this clinic. |
|  | Dates | Always YYYY-MM-DD format, e.g. 2026-06-22 |
|  | Phones | E.164 format: +12025550100 (no dashes or spaces) |
|  | source_urls | At least one URL per clinic/provider. Audit trail. |
|  | consent_documented | Before/After photos MUST have true before going live. |
|  | VALID TREATMENTS | Botox; Dysport; Xeomin; Jeuveau; Daxxify; Lip Filler; Cheek Filler; Tear Trough; Masseter Botox; Sculptra; Kybella; PRP; Microneedling; Thread Lift |
|  | VALID CREDENTIALS | MD, DO, NP, PA, RN, DDS |
|  | VALID SOURCE PLATFORMS | google, yelp, healthgrades, vitals, zocdoc, clinic_site |
|  | VALID PHOTO TYPES | before, after, headshot, clinic_interior, clinic_exterior, treatment_room, team, equipment |
## Sheet: Clinics
| injector.world — Clinics |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| clinic_id * | clinic_name * | address_line_1 * | address_line_2 | city * | state * | zip * | neighborhood | county | country | latitude * | longitude * | google_place_id | google_maps_url | directions_url | apple_maps_url | phone | email | website_url | booking_url | hours_json | service_type | accepts_insurance | payment_methods | amenities | logo_url | clinic_photo_urls | aggregate_rating | aggregate_rating_count | year_established | provider_ids | source_urls * | last_scraped_date * |
| Unique ID, e.g. clinic-rs-123456 | Full practice name | Street address | Suite / floor | City name, e.g. Scottsdale | 2-letter, e.g. AZ | 5-digit ZIP | e.g. Upper East Side (critical for SEO) | e.g. Maricopa County | Default: US | 6 decimal places | 6 decimal places | From Google Places API | Direct Google Maps link | Pre-built directions URL | For iOS users | E.164 format: +12025550100 | info@clinic.com | https://... | Direct booking link | {"mon":"9-17","tue":"9-17","sun":"closed"} | In-Person / Telehealth / Both | true / false | Visa; Mastercard; CareCredit | Parking; Wheelchair accessible | Logo image URL | url1; url2; url3 (semicolon-separated) | e.g. 4.8 | Total review count | e.g. 2015 | prov-rs-001; prov-rs-002 (semicolon-sep) | All URLs scraped from (semicolon-sep) | YYYY-MM-DD |
| clinic-rs-123456 | Infini Cosmetic Associates | 8841 E Bell Rd | Suite 105 | Scottsdale | AZ | 85260 | North Scottsdale | Maricopa | US | 33.623400 | -111.891200 |  |  |  |  | +14805550100 | info@infini.com | https://infinicosmetic.com |  | {"mon":"9-17","tue":"9-17","wed":"9-17","thu":"9-17","fri":"9-17","sat":"closed","sun":"closed"} | In-Person | false | Visa; Mastercard; CareCredit | Parking; Wheelchair accessible |  |  | 4.9 | 312 | 2011 | prov-rs-arizona-001; prov-rs-arizona-002 | https://realself.com/find/arizona/scottsdale/infini-cosmetic | 2026-06-22 |
## Sheet: Providers
| injector.world — Providers |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| provider_id * | full_name * | credentials * | title * | board_certifications | license_number | license_state | license_status | license_verification_url | npi_number | years_experience | year_started_practicing | clinic_id * | additional_clinic_ids | tagline | bio | profile_photo_url | languages | gender | treatments_offered * | specialties | pricing_botox_per_unit | pricing_filler_per_syringe | pricing_consultation | accepts_new_patients | offers_virtual_consult | offers_in_person | website_url | email | phone_direct | instagram_url | tiktok_url | linkedin_url | aggregate_rating | aggregate_rating_count | source_urls * | last_scraped_date * |
| Unique ID, e.g. prov-rs-arizona-001 | First + Last only, no titles | MD / DO / NP / PA / RN / DDS | e.g. Board-Certified Dermatologist | Dermatology; AAD Fellow (semicolon-sep) | From state medical board | 2-letter, e.g. AZ | Active / Inactive / Expired | Direct link to state board record | 10-digit NPI | e.g. 12 | e.g. 2012 | Must match a clinic_id in Clinics tab | Secondary clinics (semicolon-sep) | Max 100 chars, short pitch | 2-3 paragraph bio | Headshot URL | English; Spanish (semicolon-sep) | Female / Male / Non-binary / Unknown | Botox; Lip Filler; Sculptra (semicolon-sep) | Forehead; Crow's Feet (semicolon-sep) | USD per unit, e.g. 16 | USD per syringe, e.g. 850 | USD, 0 if free | true / false | true / false | true / false | https://... | provider@clinic.com | E.164 format: +12025550100 | https://instagram.com/... | https://tiktok.com/... | https://linkedin.com/... | e.g. 4.9 | Total review count | All URLs scraped from (semicolon-sep) | YYYY-MM-DD |
| prov-rs-arizona-001 | Sarah Kim | MD | Board-Certified Plastic Surgeon | Plastic Surgery; ASPS Member | 271832 | AZ | Active | https://azmd.gov/lookup?id=271832 | 1234567890 | 14 | 2012 | clinic-rs-123456 |  | Conservative, natural-looking results |  | https://infinicosmetic.com/team/sarah-kim | English; Korean | Female | Botox; Lip Filler; Cheek Filler; Sculptra | Forehead; Tear Trough | 16 | 850 | 100 | true | false | true | https://infinicosmetic.com | dr.kim@infini.com | +14805550101 |  |  |  | 4.9 | 187 | https://realself.com/find/arizona/scottsdale/sarah-kim-md | 2026-06-22 |
## Sheet: Reviews
| injector.world — Reviews |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| review_id * | clinic_id * | provider_id | reviewer_first_name | reviewer_initial | reviewer_age_range | reviewer_city | rating * | review_title | review_text * | treatment_tag | review_date * | source_platform * | source_url * | response_from_provider | response_date |
| Unique ID, e.g. rev-rs-001 | Must match a clinic_id in Clinics tab | Optional — links to a specific provider | First name only | Last initial, e.g. R | e.g. 30-34 | e.g. Brooklyn | Integer 1-5 | e.g. Best Botox in NYC | Full review body | e.g. Botox | YYYY-MM-DD | google/yelp/healthgrades/vitals/zocdoc/clinic_site | Original review URL | Provider reply text | YYYY-MM-DD |
| rev-rs-001 | clinic-rs-123456 | prov-rs-arizona-001 | Maya | R | 30-34 | Scottsdale | 5 | Incredible results, so natural | Dr. Kim was amazing. My lips look completely natural and exactly what I asked for. | Lip Filler | 2026-05-14 | google | https://google.com/maps/place/.../reviews/... |  |  |
## Sheet: Photos
| injector.world — Photos |  |  |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| photo_id * | provider_id | clinic_id | photo_url * | type * | pair_id | weeks_post_treatment | treatment_tag | caption | consent_documented | source_platform * | source_url * |
| Unique ID, e.g. ph-001 | Optional — photo owner | Optional — photo owner | Direct image URL | before/after/headshot/clinic_interior/clinic_exterior/treatment_room/team/equipment | Links before + after pair, e.g. pair-001 | Integer, only for 'after' photos | e.g. Lip Filler | Photo caption | true / false — MUST be true before going live | clinic_site / google / instagram | Source page URL |
| ph-001 | prov-rs-arizona-001 | clinic-rs-123456 | https://infinicosmetic.com/photos/sarah-kim-headshot.jpg | headshot |  |  |  | Dr. Kim professional headshot | true | clinic_site | https://infinicosmetic.com/team/sarah-kim |