-- fix-junk-clinic-cities.sql (2026-10-26, QA IW-WS9W)
--
-- Five imported clinics had review text or an address in the city field, and each one
-- created a junk "city" location with its own city page. Same ids on staging and production.
--
--   80392  ESPA Lymphatic & Post Surgery Care  IN 46322  city was review text     -> Highland
--                                                        lat/lng were ~43 km away in Illinois -> ZIP 46322 centre
--   85372  Primal Health and Wellness          OH 44515  city was review text     -> Youngstown
--                                                        lat/lng were in the Pacific -> ZIP 44515 centre
--   88405  A's Relaxation Spa                  SC 29928  city held the street     -> Hilton Head Island
--  100872  A&A Day Spa                         CA 92260  city was "Ca-111"        -> Palm Desert
--   47139  Flawless Faces MedSpa               Abbotsford BC, Canada (not a US clinic) -> deleted
--
-- City names come from the ZIP table; every target location already exists and is live.
-- Clinic slugs are not touched (name-zip, locked). Deleting 47139 cascades only to its own
-- photo-url and brand rows; it has no bookings, claims, reviews, photos or users (checked on
-- both databases 2026-10-26, backup in the session scratchpad).
--
-- Idempotent: every statement matches on the junk value or the junk slug, so a second run
-- changes nothing.

-- 1. The four real clinics. Junk address_line1 values ("This spa is clean", "to them",
--    "US", "United States") are replaced with the real street where the old data had one.
UPDATE clinics SET city = 'Highland', address_line1 = NULL, latitude = 41.55, longitude = -87.4569
 WHERE id = 80392 AND city ILIKE 'the staff is very friendly%';
UPDATE clinics SET city = 'Youngstown', address_line1 = NULL, latitude = 41.0979, longitude = -80.7598
 WHERE id = 85372 AND city ILIKE 'and communication has stopped%';
UPDATE clinics SET city = 'Hilton Head Island', address_line1 = '19 Shelter Cove Ln Suite 101'
 WHERE id = 88405 AND city = '19 Shelter Cove Ln Suite 101 Hilton Head Island';
UPDATE clinics SET city = 'Palm Desert', address_line1 = 'CA-111'
 WHERE id = 100872 AND city = 'Ca-111';

-- 1b. The "Get directions" link is its own column and still pointed at the old coordinates.
--     Added 2026-10-26 after the staging check; matched on the old value, so it is a no-op
--     once applied.
UPDATE clinics SET directions_url = 'https://www.google.com/maps/dir/?api=1&destination=41.55,-87.4569'
 WHERE id = 80392 AND directions_url = 'https://www.google.com/maps/dir/?api=1&destination=41.7032935,-87.9357745';
UPDATE clinics SET directions_url = 'https://www.google.com/maps/dir/?api=1&destination=41.0979,-80.7598'
 WHERE id = 85372 AND directions_url = 'https://www.google.com/maps/dir/?api=1&destination=46.423669,-129.9427085';

-- 2. Their url registry rows move to the real city now, instead of waiting for the next scan.
UPDATE page_index SET city_slug = 'highland-in',
       path = '/clinics/indiana/highland-in/espa-lymphatic-post-surgery-care-46322', updated_at = NOW()
 WHERE page_key = 'clinic:80392' AND city_slug <> 'highland-in';
UPDATE page_index SET city_slug = 'youngstown-oh',
       path = '/clinics/ohio/youngstown-oh/primal-health-and-wellness-44515', updated_at = NOW()
 WHERE page_key = 'clinic:85372' AND city_slug <> 'youngstown-oh';
UPDATE page_index SET city_slug = 'hilton-head-island-sc',
       path = '/clinics/south-carolina/hilton-head-island-sc/a-s-relaxation-spa-29928', updated_at = NOW()
 WHERE page_key = 'clinic:88405' AND city_slug <> 'hilton-head-island-sc';
UPDATE page_index SET city_slug = 'palm-desert-ca',
       path = '/clinics/california/palm-desert-ca/a-a-day-spa-92260', updated_at = NOW()
 WHERE page_key = 'clinic:100872' AND city_slug <> 'palm-desert-ca';

-- 3. The Canadian clinic and its registry row.
DELETE FROM page_index WHERE page_key = 'clinic:47139';
DELETE FROM clinics WHERE id = 47139 AND city = 'Bc V2s 6r6';

-- 4. The five junk city locations and every registry row under them (city, service-city and
--    brand-city pages; all queued, none indexed). Nothing else references them.
--    A location is only removed once no clinic still carries its name.
DROP TABLE IF EXISTS pg_temp.junk_city;
CREATE TEMP TABLE junk_city ON COMMIT DROP AS
  SELECT l.id, l.slug FROM locations l
   WHERE l.id IN (4903, 6129, 6287, 6375, 6686)
     AND l.slug IN (
       'bc-v2s-6r6-ca',
       'ca-111-ca',
       '19-shelter-cove-ln-suite-101-hilton-head-island-sc',
       'the-staff-is-very-friendly-and-its-peaceful-when-you-walk-in-i-m-on-my-3rd-session-i-ve-been-dealing-with-premenopausal-acne-since-seeing-claudia-i-ve-noticed-a-difference-in-my-sk-in',
       'and-communication-has-stopped-on-their-part-i-have-spent-thousands-of-dollars-the-last-couple-of-years-oh')
     AND NOT EXISTS (SELECT 1 FROM clinics c WHERE c.city = l.name AND c.state = l.state);
DELETE FROM page_index WHERE city_slug IN (SELECT slug FROM junk_city);
DELETE FROM payload_locked_documents_rels WHERE locations_id IN (SELECT id FROM junk_city);
DELETE FROM locations WHERE id IN (SELECT id FROM junk_city);
