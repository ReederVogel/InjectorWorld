-- seed-guide-categories.sql (2026-10-28)
--
-- First load of the /guides filter chips from the founder's sheet
-- "injector.world Guides and News (2026-10-26) v12.xlsx": 26 categories, and one
-- primary plus 1 to 4 secondary categories for each of the 100 guides, matched by
-- guide slug. Generated from the sheet, not hand-typed.
--
-- One-shot on purpose. Categories are inserted only while guide_categories is
-- empty, and guides are tagged only while no guide has a category yet, so later
-- admin edits (renames, deletes, re-tagging) are never overwritten by a rebuild.
-- Runs post-push: db-push creates guide_categories first.

INSERT INTO guide_categories (name, slug, sort_order, updated_at, created_at)
SELECT v.name, v.slug, v.sort_order, now(), now()
  FROM (VALUES
    ('Dermal Fillers', 'dermal-fillers', 10),
    ('Botox & Neuromodulators', 'botox-and-neuromodulators', 20),
    ('Biostimulators', 'biostimulators', 30),
    ('PRP/PRF & Regenerative', 'prp-prf-and-regenerative', 40),
    ('Fat Dissolving', 'fat-dissolving', 50),
    ('Microneedling & Skin Boosters', 'microneedling-and-skin-boosters', 60),
    ('Hair Restoration', 'hair-restoration', 70),
    ('Cost & Pricing', 'cost-and-pricing', 80),
    ('Product Explainers', 'product-explainers', 90),
    ('Results & Longevity', 'results-and-longevity', 100),
    ('Comparisons', 'comparisons', 110),
    ('Causes & Conditions', 'causes-and-conditions', 120),
    ('Side Effects & Safety', 'side-effects-and-safety', 130),
    ('Cheeks & Midface', 'cheeks-and-midface', 140),
    ('Chin & Jawline', 'chin-and-jawline', 150),
    ('Lips', 'lips', 160),
    ('Skin Quality', 'skin-quality', 170),
    ('Double Chin', 'double-chin', 180),
    ('Under-Eyes', 'under-eyes', 190),
    ('Aftercare', 'aftercare', 200),
    ('Forehead & Frown Lines', 'forehead-and-frown-lines', 210),
    ('Neck', 'neck', 220),
    ('Eyes & Brows', 'eyes-and-brows', 230),
    ('Nose', 'nose', 240),
    ('Hands', 'hands', 250),
    ('Temples', 'temples', 260)
  ) AS v(name, slug, sort_order)
 WHERE NOT EXISTS (SELECT 1 FROM guide_categories);

WITH map(guide_slug, primary_slug, secondary_slugs) AS (VALUES
    ('ozempic-face', 'dermal-fillers', ARRAY['biostimulators', 'causes-and-conditions', 'cheeks-and-midface']::varchar[]),
    ('masseter-botox', 'botox-and-neuromodulators', ARRAY['chin-and-jawline', 'product-explainers', 'results-and-longevity']::varchar[]),
    ('lip-filler', 'dermal-fillers', ARRAY['lips', 'cost-and-pricing', 'results-and-longevity']::varchar[]),
    ('lip-flip', 'botox-and-neuromodulators', ARRAY['lips', 'comparisons', 'cost-and-pricing']::varchar[]),
    ('crows-feet-causes-and-treatments', 'botox-and-neuromodulators', ARRAY['eyes-and-brows', 'causes-and-conditions']::varchar[]),
    ('what-is-microneedling', 'microneedling-and-skin-boosters', ARRAY['skin-quality', 'product-explainers']::varchar[]),
    ('nasolabial-folds-causes-and-filler-options', 'dermal-fillers', ARRAY['cheeks-and-midface', 'causes-and-conditions']::varchar[]),
    ('what-is-kybella', 'fat-dissolving', ARRAY['double-chin', 'product-explainers']::varchar[]),
    ('hooded-eyes-causes-and-botox-brow-lift', 'botox-and-neuromodulators', ARRAY['eyes-and-brows', 'causes-and-conditions']::varchar[]),
    ('botox-for-migraines', 'botox-and-neuromodulators', ARRAY['causes-and-conditions', 'cost-and-pricing', 'results-and-longevity']::varchar[]),
    ('sculptra-cost', 'biostimulators', ARRAY['cost-and-pricing']::varchar[]),
    ('how-long-does-botox-last', 'botox-and-neuromodulators', ARRAY['results-and-longevity', 'aftercare']::varchar[]),
    ('what-is-sculptra', 'biostimulators', ARRAY['product-explainers', 'results-and-longevity']::varchar[]),
    ('microneedling-cost', 'microneedling-and-skin-boosters', ARRAY['skin-quality', 'cost-and-pricing']::varchar[]),
    ('under-eye-bags', 'dermal-fillers', ARRAY['under-eyes', 'causes-and-conditions']::varchar[]),
    ('festoons-malar-bags-causes-and-treatment', 'dermal-fillers', ARRAY['under-eyes', 'cheeks-and-midface', 'causes-and-conditions']::varchar[]),
    ('nefertiti-lift', 'botox-and-neuromodulators', ARRAY['chin-and-jawline', 'neck', 'product-explainers']::varchar[]),
    ('marionette-lines-causes-and-fillers', 'dermal-fillers', ARRAY['chin-and-jawline', 'causes-and-conditions', 'biostimulators']::varchar[]),
    ('neck-bands-platysmal-bands-botox-treatment', 'botox-and-neuromodulators', ARRAY['neck', 'causes-and-conditions']::varchar[]),
    ('dysport-results', 'botox-and-neuromodulators', ARRAY['results-and-longevity']::varchar[]),
    ('smile-line-filler', 'dermal-fillers', ARRAY['cheeks-and-midface', 'cost-and-pricing']::varchar[]),
    ('botox-cost', 'botox-and-neuromodulators', ARRAY['cost-and-pricing']::varchar[]),
    ('how-to-get-rid-of-a-double-chin', 'fat-dissolving', ARRAY['double-chin', 'causes-and-conditions', 'chin-and-jawline']::varchar[]),
    ('under-eye-hollows', 'dermal-fillers', ARRAY['under-eyes', 'causes-and-conditions']::varchar[]),
    ('masseter-botox-cost', 'botox-and-neuromodulators', ARRAY['chin-and-jawline', 'cost-and-pricing']::varchar[]),
    ('nasolabial-fold-filler', 'dermal-fillers', ARRAY['cheeks-and-midface', 'cost-and-pricing', 'results-and-longevity']::varchar[]),
    ('botox-vs-dysport', 'botox-and-neuromodulators', ARRAY['comparisons', 'cost-and-pricing', 'results-and-longevity']::varchar[]),
    ('lip-filler-cost', 'dermal-fillers', ARRAY['lips', 'cost-and-pricing']::varchar[]),
    ('juvederm-products-explained', 'dermal-fillers', ARRAY['product-explainers']::varchar[]),
    ('under-eye-filler', 'dermal-fillers', ARRAY['under-eyes', 'cost-and-pricing', 'side-effects-and-safety']::varchar[]),
    ('what-is-dysport', 'botox-and-neuromodulators', ARRAY['product-explainers', 'comparisons', 'cost-and-pricing']::varchar[]),
    ('kybella-vs-coolsculpting', 'fat-dissolving', ARRAY['double-chin', 'comparisons']::varchar[]),
    ('sunken-cheeks-causes-and-cheek-filler', 'dermal-fillers', ARRAY['cheeks-and-midface', 'causes-and-conditions']::varchar[]),
    ('what-is-juvederm', 'dermal-fillers', ARRAY['product-explainers', 'cost-and-pricing', 'results-and-longevity']::varchar[]),
    ('smile-lines-types-and-treatments', 'dermal-fillers', ARRAY['botox-and-neuromodulators', 'cheeks-and-midface', 'causes-and-conditions']::varchar[]),
    ('kybella-cost', 'fat-dissolving', ARRAY['cost-and-pricing', 'double-chin']::varchar[]),
    ('what-is-xeomin', 'botox-and-neuromodulators', ARRAY['product-explainers', 'comparisons']::varchar[]),
    ('turkey-neck-causes-and-nonsurgical-treatments', 'botox-and-neuromodulators', ARRAY['neck', 'causes-and-conditions', 'biostimulators']::varchar[]),
    ('bunny-lines-causes-and-botox-treatment', 'botox-and-neuromodulators', ARRAY['nose', 'causes-and-conditions', 'results-and-longevity']::varchar[]),
    ('what-is-skinvive', 'microneedling-and-skin-boosters', ARRAY['skin-quality', 'cheeks-and-midface', 'product-explainers']::varchar[]),
    ('what-is-radiesse', 'biostimulators', ARRAY['dermal-fillers', 'product-explainers', 'results-and-longevity']::varchar[]),
    ('sculptra-vs-filler', 'biostimulators', ARRAY['comparisons', 'dermal-fillers', 'cost-and-pricing']::varchar[]),
    ('what-causes-jowls-sagging-jawline', 'dermal-fillers', ARRAY['chin-and-jawline', 'causes-and-conditions']::varchar[]),
    ('sculptra-vs-radiesse', 'biostimulators', ARRAY['comparisons', 'cost-and-pricing', 'side-effects-and-safety']::varchar[]),
    ('hyaluronidase', 'dermal-fillers', ARRAY['product-explainers', 'side-effects-and-safety']::varchar[]),
    ('what-is-prp', 'prp-prf-and-regenerative', ARRAY['product-explainers', 'cost-and-pricing', 'side-effects-and-safety']::varchar[]),
    ('what-is-dermal-fillers', 'dermal-fillers', ARRAY['product-explainers', 'cost-and-pricing', 'side-effects-and-safety']::varchar[]),
    ('sculptra-results', 'biostimulators', ARRAY['results-and-longevity', 'product-explainers']::varchar[]),
    ('does-botox-hurt', 'botox-and-neuromodulators', ARRAY['side-effects-and-safety', 'aftercare']::varchar[]),
    ('is-botox-safe', 'botox-and-neuromodulators', ARRAY['side-effects-and-safety']::varchar[]),
    ('dysport-cost', 'botox-and-neuromodulators', ARRAY['cost-and-pricing', 'comparisons']::varchar[]),
    ('restylane-kysse', 'dermal-fillers', ARRAY['lips', 'product-explainers', 'results-and-longevity']::varchar[]),
    ('prp-vs-prf', 'prp-prf-and-regenerative', ARRAY['comparisons', 'cost-and-pricing']::varchar[]),
    ('what-is-restylane', 'dermal-fillers', ARRAY['product-explainers', 'results-and-longevity', 'cost-and-pricing']::varchar[]),
    ('how-many-units-of-botox', 'botox-and-neuromodulators', ARRAY['product-explainers']::varchar[]),
    ('botox-side-effects', 'botox-and-neuromodulators', ARRAY['side-effects-and-safety', 'aftercare']::varchar[]),
    ('temple-filler', 'dermal-fillers', ARRAY['temples', 'cost-and-pricing', 'results-and-longevity']::varchar[]),
    ('what-is-prf', 'prp-prf-and-regenerative', ARRAY['product-explainers', 'cost-and-pricing']::varchar[]),
    ('botox-aftercare', 'botox-and-neuromodulators', ARRAY['aftercare', 'side-effects-and-safety', 'results-and-longevity']::varchar[]),
    ('prp-plus-microneedling-for-skin-renewal', 'prp-prf-and-regenerative', ARRAY['microneedling-and-skin-boosters', 'skin-quality', 'results-and-longevity']::varchar[]),
    ('jawline-filler', 'dermal-fillers', ARRAY['chin-and-jawline', 'cost-and-pricing', 'results-and-longevity']::varchar[]),
    ('what-is-jeuveau', 'botox-and-neuromodulators', ARRAY['product-explainers', 'comparisons', 'cost-and-pricing']::varchar[]),
    ('prp-for-hair-loss', 'hair-restoration', ARRAY['prp-prf-and-regenerative', 'results-and-longevity', 'cost-and-pricing']::varchar[]),
    ('lip-lines-causes-and-treatments', 'dermal-fillers', ARRAY['lips', 'causes-and-conditions', 'skin-quality']::varchar[]),
    ('juvederm-cost', 'dermal-fillers', ARRAY['cost-and-pricing', 'product-explainers']::varchar[]),
    ('what-causes-forehead-wrinkles', 'botox-and-neuromodulators', ARRAY['forehead-and-frown-lines', 'causes-and-conditions']::varchar[]),
    ('juvederm-vs-restylane', 'dermal-fillers', ARRAY['comparisons', 'cost-and-pricing']::varchar[]),
    ('chin-filler', 'dermal-fillers', ARRAY['chin-and-jawline', 'results-and-longevity']::varchar[]),
    ('what-is-daxxify', 'botox-and-neuromodulators', ARRAY['product-explainers', 'comparisons', 'results-and-longevity']::varchar[]),
    ('forehead-filler', 'dermal-fillers', ARRAY['forehead-and-frown-lines', 'cost-and-pricing', 'side-effects-and-safety']::varchar[]),
    ('liquid-rhinoplasty', 'dermal-fillers', ARRAY['nose', 'product-explainers', 'comparisons', 'side-effects-and-safety']::varchar[]),
    ('preventative-botox-vs-waiting', 'botox-and-neuromodulators', ARRAY['comparisons']::varchar[]),
    ('what-is-botox', 'botox-and-neuromodulators', ARRAY['product-explainers', 'cost-and-pricing', 'side-effects-and-safety']::varchar[]),
    ('lip-flip-vs-lip-filler', 'dermal-fillers', ARRAY['lips', 'botox-and-neuromodulators', 'comparisons', 'cost-and-pricing']::varchar[]),
    ('what-causes-frown-lines-11s', 'botox-and-neuromodulators', ARRAY['forehead-and-frown-lines', 'causes-and-conditions']::varchar[]),
    ('how-long-do-fillers-last', 'dermal-fillers', ARRAY['results-and-longevity']::varchar[]),
    ('daxxify-cost', 'botox-and-neuromodulators', ARRAY['cost-and-pricing', 'comparisons']::varchar[]),
    ('hand-filler', 'dermal-fillers', ARRAY['hands', 'cost-and-pricing', 'results-and-longevity']::varchar[]),
    ('restylane-products-explained', 'dermal-fillers', ARRAY['product-explainers', 'comparisons', 'cheeks-and-midface']::varchar[]),
    ('dermal-fillers-cost', 'dermal-fillers', ARRAY['cost-and-pricing']::varchar[]),
    ('dermal-filler-side-effects', 'dermal-fillers', ARRAY['side-effects-and-safety']::varchar[]),
    ('kybella-side-effects', 'fat-dissolving', ARRAY['double-chin', 'side-effects-and-safety']::varchar[]),
    ('filler-migration', 'dermal-fillers', ARRAY['side-effects-and-safety', 'causes-and-conditions']::varchar[]),
    ('dysport-vs-daxxify', 'botox-and-neuromodulators', ARRAY['comparisons', 'cost-and-pricing', 'results-and-longevity']::varchar[]),
    ('cheek-filler', 'dermal-fillers', ARRAY['cheeks-and-midface', 'cost-and-pricing', 'results-and-longevity']::varchar[]),
    ('exosomes-for-hair', 'hair-restoration', ARRAY['prp-prf-and-regenerative', 'side-effects-and-safety', 'product-explainers']::varchar[]),
    ('jawline-filler-cost', 'dermal-fillers', ARRAY['chin-and-jawline', 'cost-and-pricing']::varchar[]),
    ('how-long-does-juvederm-last', 'dermal-fillers', ARRAY['results-and-longevity', 'product-explainers']::varchar[]),
    ('chin-filler-cost', 'dermal-fillers', ARRAY['chin-and-jawline', 'cost-and-pricing']::varchar[]),
    ('botox-vs-daxxify', 'botox-and-neuromodulators', ARRAY['comparisons', 'results-and-longevity', 'cost-and-pricing']::varchar[]),
    ('dysport-vs-jeuveau', 'botox-and-neuromodulators', ARRAY['comparisons', 'cost-and-pricing']::varchar[]),
    ('dimpled-chin-causes-and-botox-treatment', 'botox-and-neuromodulators', ARRAY['chin-and-jawline', 'causes-and-conditions']::varchar[]),
    ('neuromodulators-compared', 'botox-and-neuromodulators', ARRAY['comparisons', 'cost-and-pricing']::varchar[]),
    ('what-causes-tear-trough-hollows', 'dermal-fillers', ARRAY['under-eyes', 'causes-and-conditions']::varchar[]),
    ('botox-vs-xeomin', 'botox-and-neuromodulators', ARRAY['comparisons', 'product-explainers', 'cost-and-pricing']::varchar[]),
    ('cheek-filler-cost', 'dermal-fillers', ARRAY['cheeks-and-midface', 'cost-and-pricing']::varchar[]),
    ('botox-vs-jeuveau', 'botox-and-neuromodulators', ARRAY['comparisons', 'cost-and-pricing', 'side-effects-and-safety']::varchar[]),
    ('botox-vs-dermal-fillers', 'botox-and-neuromodulators', ARRAY['dermal-fillers', 'comparisons', 'cost-and-pricing']::varchar[]),
    ('biostimulators-explained', 'biostimulators', ARRAY['product-explainers', 'results-and-longevity', 'skin-quality']::varchar[]),
    ('xeomin-vs-jeuveau', 'botox-and-neuromodulators', ARRAY['comparisons', 'cost-and-pricing']::varchar[])
),
first_run AS (
  SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM guides WHERE primary_category_id IS NOT NULL)
             AND NOT EXISTS (SELECT 1 FROM guides_rels WHERE guide_categories_id IS NOT NULL)
),
todo AS (
  SELECT g.id AS guide_id, m.primary_slug, m.secondary_slugs
    FROM map m JOIN guides g ON g.slug = m.guide_slug
   WHERE EXISTS (SELECT 1 FROM first_run)
),
set_primary AS (
  UPDATE guides g
     SET primary_category_id = c.id
    FROM todo t JOIN guide_categories c ON c.slug = t.primary_slug
   WHERE g.id = t.guide_id
  RETURNING g.id
)
INSERT INTO guides_rels ("order", parent_id, path, guide_categories_id)
SELECT s.ord, t.guide_id, 'secondaryCategories', c.id
  FROM todo t
  CROSS JOIN LATERAL unnest(t.secondary_slugs) WITH ORDINALITY AS s(slug, ord)
  JOIN guide_categories c ON c.slug = s.slug;
