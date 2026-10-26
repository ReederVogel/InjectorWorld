-- fix-dead-source-links.sql (2026-10-26, QA IW-WCEQ)
--
-- Replace the dead "Sources" links in guides and news with each publisher's current page.
-- Every new url was opened on 2026-10-26 and answered 200 with the matching page title,
-- except GoodRx, which blocks every automated request (403 even on live pages): those four
-- new urls come from GoodRx's own pages as listed by search, and the tester saw the old
-- four show "Page not found" in a normal browser.
--
-- new_title / new_publisher are only set where the new page is a different article; NULL
-- keeps the existing value. new_url NULL drops the entry (no current version exists).
-- If a row already cites the new url, the old entry is dropped instead of duplicated.
--
-- Idempotent: rows are only touched while they still cite an old url, so the second run is
-- a no-op. Raw SQL on purpose: it does not bump contentUpdatedAt ("Updated" date).

WITH map(old_url, new_url, new_title, new_publisher) AS (VALUES
  ('https://my.clevelandclinic.org/health/treatments/8312-botox',                 'https://my.clevelandclinic.org/health/treatments/8312-botulinum-toxin-injections', NULL, NULL),
  ('https://my.clevelandclinic.org/health/treatments/8478-botox',                 'https://my.clevelandclinic.org/health/treatments/8312-botulinum-toxin-injections', NULL, NULL),
  ('https://my.clevelandclinic.org/health/treatments/8987-botulinum-toxin-injections', 'https://my.clevelandclinic.org/health/treatments/8312-botulinum-toxin-injections', NULL, NULL),
  ('https://my.clevelandclinic.org/health/diseases/marionette-lines',             'https://my.clevelandclinic.org/health/diseases/23028-marionette-lines', NULL, NULL),
  ('https://my.clevelandclinic.org/health/treatments/21642-dermal-fillers',       'https://my.clevelandclinic.org/health/treatments/22667-dermal-fillers', NULL, NULL),
  ('https://my.clevelandclinic.org/health/treatments/11179-dermal-fillers',       'https://my.clevelandclinic.org/health/treatments/22667-dermal-fillers', NULL, NULL),
  ('https://www.carecredit.com/well-u/cosmetic-procedures/kybella-cost/',         'https://www.carecredit.com/well-u/health-wellness/kybella-cost/', NULL, NULL),
  ('https://www.carecredit.com/well-u/health-wellness/botox-cost/',               'https://www.carecredit.com/well-u/health-wellness/botox-cost-and-botox-financing/', NULL, NULL),
  ('https://www.carecredit.com/well-u/beauty-wellness/microneedling-cost/',       'https://www.carecredit.com/well-u/health-wellness/microneedling-cost/', NULL, NULL),
  ('https://www.aad.org/public/cosmetic/wrinkles/wrinkle-treatments-botulinum-toxin', 'https://www.aad.org/public/cosmetic/wrinkles/botulinum-toxin-overview', NULL, NULL),
  ('https://www.aad.org/public/cosmetic/wrinkles/dermal-fillers-overview',        'https://www.aad.org/public/cosmetic/wrinkles/fillers-overview', NULL, NULL),
  ('https://www.aad.org/public/cosmetic/wrinkles/dermal-fillers-safe',            'https://www.aad.org/public/cosmetic/wrinkles/fillers-overview', NULL, NULL),
  ('https://www.aad.org/public/cosmetic/wrinkles/fillers-safety',                 'https://www.aad.org/public/cosmetic/wrinkles/fillers-faqs', 'Fillers: FAQs', NULL),
  ('https://www.aad.org/public/cosmetic/safety/who-should-provide',               'https://www.aad.org/public/cosmetic/safety/ask-questions', NULL, NULL),
  ('https://www.healthline.com/health/beauty-skin-care/dysport-vs-botox',         'https://www.healthline.com/health/dysport-botox', NULL, NULL),
  ('https://www.healthline.com/health/how-long-do-fillers-last',                  'https://www.healthline.com/health/how-long-does-filler-last', NULL, NULL),
  ('https://www.healthline.com/health/beauty-skin-care/cheek-fillers',            'https://www.healthline.com/health/cheek-fillers', NULL, NULL),
  ('https://www.healthline.com/health/beauty-skin-care/restylane-lyft',           'https://www.healthline.com/health/restylane-lyft', NULL, NULL),
  ('https://www.healthline.com/health/beauty-skin-care/temple-filler',            'https://www.healthline.com/health/beauty-skin-care/fillers-for-temples', 'Fillers for Temples: Purpose, Effectiveness, and Side Effects', NULL),
  ('https://www.mayoclinic.org/tests-procedures/facial-fillers/about/pac-20430531', 'https://www.mayoclinic.org/tests-procedures/facial-fillers/about/pac-20394072', NULL, NULL),
  ('https://www.mayoclinic.org/drugs-supplements/hyaluronidase-injection-route-subcutaneous-route/description/drg-20064330', 'https://www.mayoclinic.org/drugs-supplements/hyaluronidase-injection-route-subcutaneous-route/description/drg-20064183', NULL, NULL),
  ('https://www.webmd.com/beauty/what-to-know-liquid-nose-job',                   'https://www.webmd.com/beauty/what-you-should-know-about-liquid-nose-jobs', NULL, NULL),
  ('https://www.restylaneusa.com/products/restylane-kysse',                       'https://www.restylaneusa.com/product/restylane-kysse', NULL, NULL),
  ('https://www.allure.com/story/skinvive-juvederm-injectable',                   'https://www.skinvivebyjuvederm.com/', 'SKINVIVE by JUVEDERM: microdroplet injectable treatment (official product site)', 'Allergan Aesthetics'),
  ('https://www.accessdata.fda.gov/drugsatfda_docs/label/2021/103000s5312lbl.pdf', 'https://www.rxabbvie.com/pdf/botox_pi.pdf', NULL, NULL),
  ('https://www.accessdata.fda.gov/drugsatfda_docs/label/2015/206333lbl.pdf',     'https://www.accessdata.fda.gov/drugsatfda_docs/label/2015/206333s000lbl.pdf', NULL, NULL),
  ('https://www.massgeneral.org/assets/MGH/pdf/surgery/plastic-surgery/botox-aftercare-instructions.pdf', NULL, NULL, NULL),
  ('https://www.goodrx.com/botox/botox-cost',                                     'https://www.goodrx.com/botox/how-much-does-botox-cost', 'How Much Is Botox?', NULL),
  ('https://www.goodrx.com/conditions/wrinkles/botox-vs-daxxify',                 'https://www.goodrx.com/compare/botox-cosmetic-vs-daxxify', NULL, NULL),
  ('https://www.goodrx.com/conditions/cosmetic/botox-vs-jeuveau',                 'https://www.goodrx.com/botox/jeuveau-vs-botox', 'What''s the Difference Between Jeuveau vs. Botox Injections?', NULL),
  ('https://www.goodrx.com/conditions/skin-care/botox-vs-fillers',                'https://www.goodrx.com/health-topic/dermatology/botox-vs-fillers-uses-side-effects-cost-differences', NULL, NULL)
)
UPDATE guides g
   SET sources = (
     SELECT COALESCE(jsonb_agg(
              CASE WHEN m.old_url IS NULL THEN e.s
                   ELSE e.s || jsonb_build_object('url', m.new_url)
                            || CASE WHEN m.new_title IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('title', m.new_title) END
                            || CASE WHEN m.new_publisher IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('publisher', m.new_publisher) END
              END ORDER BY e.ord), '[]'::jsonb)
       FROM jsonb_array_elements(g.sources) WITH ORDINALITY AS e(s, ord)
       LEFT JOIN map m ON m.old_url = e.s->>'url'
      WHERE m.old_url IS NULL
         OR (m.new_url IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(g.sources) x WHERE x->>'url' = m.new_url))
   )
 WHERE jsonb_typeof(g.sources) = 'array'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(g.sources) s JOIN map m ON m.old_url = s->>'url');

-- News: one dead source (AOL dropped the article). Swapped for other press coverage of the
-- same deal; the article already cites the Novo Nordisk and Hims releases themselves.
UPDATE news n
   SET sources = (
     SELECT jsonb_agg(
              CASE WHEN e.s->>'url' = 'https://www.aol.com/articles/hims-hers-partner-novo-nordisk-203229864.html'
                   THEN e.s || jsonb_build_object(
                          'url', 'https://hlth.com/insights/news/hims-and-hers-makes-deal-with-novo-nordisk-as-it-shifts-obesity-strategy-2026-03-10',
                          'title', 'HLTH, Hims & Hers makes deal with Novo Nordisk as it shifts obesity strategy',
                          'publisher', 'HLTH')
                   ELSE e.s
              END ORDER BY e.ord)
       FROM jsonb_array_elements(n.sources) WITH ORDINALITY AS e(s, ord)
   )
 WHERE jsonb_typeof(n.sources) = 'array'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(n.sources) s
                WHERE s->>'url' = 'https://www.aol.com/articles/hims-hers-partner-novo-nordisk-203229864.html');
