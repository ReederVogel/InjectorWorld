import type { Payload, PayloadRequest } from 'payload'
import { guessFaqSection, isFaqSection, type FaqSection } from './sections'
import { faqKebab } from './slug'

/**
 * Picks the home category for an FAQ that does not have one yet.
 *
 * One code path for all three callers, so they can never disagree:
 *   - the FAQs beforeChange hook (every admin save, bulk upload, API write)
 *   - the "Assign missing" button on the FAQs screen
 *   - scripts/assign-faq-categories.ts (the one-time backfill, with a dry run)
 *
 * Order: place, then treatment, then brand, then guide topic, else General.
 * Place wins because "How much does Botox cost in NYC" belongs to NYC: on the
 * Botox page it would be wrong for everyone outside New York.
 *
 * The admin can move any FAQ to any category afterwards. Only an EMPTY category
 * is filled here.
 */

export type LinkField = 'services' | 'brands' | 'guides' | 'locations'
export type CategoryType = 'treatment' | 'brand' | 'topic' | 'location' | 'general'

export type CategorySpec = {
  name: string
  slug: string
  type: CategoryType
  link?: { field: LinkField; id: number }
}

export type ResolveResult = {
  id: number | null
  spec: CategorySpec
  /** existing: already linked. linked: found by slug and the link was added. created: new category. */
  action: 'existing' | 'linked' | 'created' | 'would-link' | 'would-create'
}

export function relId(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'object') return relId((v as any).id)
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

function titleCase(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bNyc\b/g, 'NYC')
    .replace(/\bDc\b/g, 'DC')
}

/**
 * "What Are Dermal Fillers? Types, Uses, Cost & Safety (2026 Guide)" -> "Dermal Fillers".
 * "Botox for Migraines: How It Works, Cost & Results (2026)" -> "Botox for Migraines".
 */
export function topicNameFromGuideTitle(title: string): string {
  let t = String(title ?? '').split(/[:?(|]/)[0].trim()
  t = t.replace(/^(what (is|are|causes)( a| an| the)?|how (does|do|to)|why)\s+/i, '').trim()
  return t || String(title ?? '').trim()
}

async function findOne(payload: Payload, collection: any, id: number, req?: PayloadRequest): Promise<any | null> {
  try {
    return await payload.findByID({ collection, id, depth: 0, overrideAccess: true, req })
  } catch {
    return null
  }
}

/** What the category for this FAQ should be, before looking at what exists. */
export async function specForFaq(payload: Payload, faq: any, req?: PayloadRequest): Promise<CategorySpec> {
  const locationId = relId(faq?.location)
  if (locationId) {
    const loc = await findOne(payload, 'locations', locationId, req)
    if (loc?.slug) {
      const name = loc.kind === 'state' || !loc.state
        ? titleCase(loc.name)
        : `${titleCase(String(loc.name).replace(/\s+city$/i, ''))}, ${String(loc.state).toUpperCase()}`
      return { name, slug: faqKebab(loc.slug), type: 'location', link: { field: 'locations', id: locationId } }
    }
  }

  const serviceId = relId(faq?.service)
  if (serviceId) {
    const s = await findOne(payload, 'services', serviceId, req)
    if (s?.slug) return { name: s.name, slug: faqKebab(s.slug), type: 'treatment', link: { field: 'services', id: serviceId } }
  }

  const brandId = relId(faq?.brand)
  if (brandId) {
    const b = await findOne(payload, 'brands', brandId, req)
    if (b?.slug) return { name: b.name, slug: faqKebab(b.slug), type: 'brand', link: { field: 'brands', id: brandId } }
  }

  const guideId = relId(faq?.guide)
  if (guideId) {
    const g = await findOne(payload, 'guides', guideId, req)
    if (g?.title) {
      const name = topicNameFromGuideTitle(g.title)
      return { name, slug: faqKebab(name), type: 'topic', link: { field: 'guides', id: guideId } }
    }
  }

  return { name: 'General', slug: 'general', type: 'general' }
}

async function findCategory(payload: Payload, where: any, req?: PayloadRequest): Promise<any | null> {
  const res = await payload.find({
    collection: 'faq-categories' as any,
    where,
    limit: 1,
    depth: 0,
    sort: 'sortRank',
    overrideAccess: true,
    req,
  })
  return res.docs[0] ?? null
}

/** A topic called "Dermal Fillers" should also preview on the "Dermal Filler" treatment page. */
async function matchingServiceId(payload: Payload, name: string, req?: PayloadRequest): Promise<number | null> {
  const base = name.trim().toLowerCase().replace(/s$/, '')
  const res = await payload.find({
    collection: 'services',
    where: { or: [{ name: { equals: name } }, { name: { equals: titleCase(base) } }, { name: { equals: `${titleCase(base)}s` } }] },
    limit: 5,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const hit = (res.docs as any[]).find((s) => String(s.name).toLowerCase().replace(/s$/, '') === base)
  return hit ? Number(hit.id) : null
}

export async function resolveFaqCategory(
  payload: Payload,
  faq: any,
  opts: { create: boolean; req?: PayloadRequest; context?: Record<string, unknown> },
): Promise<ResolveResult> {
  const { req, context } = opts
  const spec = await specForFaq(payload, faq, req)

  if (spec.link) {
    const linked = await findCategory(payload, { [spec.link.field]: { in: [spec.link.id] } }, req)
    if (linked) return { id: Number(linked.id), spec, action: 'existing' }
  }

  const bySlug = await findCategory(payload, { slug: { equals: spec.slug } }, req)
  if (bySlug) {
    if (!spec.link) return { id: Number(bySlug.id), spec, action: 'existing' }
    if (!opts.create) return { id: Number(bySlug.id), spec, action: 'would-link' }
    const current = ((bySlug as any)[spec.link.field] ?? []).map(relId).filter(Boolean) as number[]
    await payload.update({
      collection: 'faq-categories' as any,
      id: bySlug.id,
      data: { [spec.link.field]: [...new Set([...current, spec.link.id])] } as any,
      overrideAccess: true,
      req,
      context,
    })
    return { id: Number(bySlug.id), spec, action: 'linked' }
  }

  if (!opts.create) return { id: null, spec, action: 'would-create' }

  const data: Record<string, any> = {
    name: spec.name,
    slug: spec.slug,
    type: spec.type,
    enabled: true,
    sortRank: spec.type === 'general' ? 900 : 100,
  }
  if (spec.link) data[spec.link.field] = [spec.link.id]
  if (spec.type === 'topic') {
    const serviceId = await matchingServiceId(payload, spec.name, req)
    if (serviceId) {
      // Only when no other category already previews on that treatment page.
      const taken = await findCategory(payload, { services: { in: [serviceId] } }, req)
      if (!taken) data.services = [serviceId]
    }
  }

  const created = await payload.create({ collection: 'faq-categories' as any, data: data as any, overrideAccess: true, req, context })
  return { id: Number(created.id), spec, action: 'created' }
}

export type AssignPlanRow = {
  id: number
  question: string
  categoryName: string
  categorySlug: string
  action: ResolveResult['action'] | 'kept'
  section: FaqSection
  sectionAction: 'kept' | 'guessed'
}

export type AssignReport = {
  apply: boolean
  scanned: number
  changed: number
  categoriesCreated: string[]
  rows: AssignPlanRow[]
  errors: Array<{ id: number; reason: string }>
}

/**
 * Fills category and section on every FAQ missing either one. Dry run unless
 * `apply`. Writes go through payload.update so the FAQ keeps every other hook,
 * with `disableHooks` in context so a 600-row run does not trigger 600 site-wide
 * cache purges (lib/revalidate-hook.ts honours that flag). The caller purges once.
 */
export async function assignMissingFaqFields(payload: Payload, opts: { apply: boolean }): Promise<AssignReport> {
  const res = await payload.find({
    collection: 'faqs',
    where: { or: [{ category: { exists: false } }, { section: { exists: false } }] } as any,
    limit: 10000,
    depth: 0,
    sort: 'id',
    overrideAccess: true,
  })

  const report: AssignReport = { apply: opts.apply, scanned: res.docs.length, changed: 0, categoriesCreated: [], rows: [], errors: [] }
  const plannedSlugs = new Set<string>()

  for (const faq of res.docs as any[]) {
    try {
      const data: Record<string, any> = {}
      let categoryName = ''
      let categorySlug = ''
      let action: AssignPlanRow['action'] = 'kept'

      if (!relId(faq.category)) {
        const r = await resolveFaqCategory(payload, faq, { create: opts.apply, context: { disableHooks: true } })
        categoryName = r.spec.name
        categorySlug = r.spec.slug
        action = r.action
        if (r.action === 'created') report.categoriesCreated.push(r.spec.slug)
        if (r.action === 'would-create' && !plannedSlugs.has(r.spec.slug)) {
          plannedSlugs.add(r.spec.slug)
          report.categoriesCreated.push(r.spec.slug)
        }
        if (r.id) data.category = r.id
      }

      const sectionAction: AssignPlanRow['sectionAction'] = isFaqSection(faq.section) ? 'kept' : 'guessed'
      const section = isFaqSection(faq.section) ? faq.section : guessFaqSection(faq.question)
      if (sectionAction === 'guessed') data.section = section

      report.rows.push({ id: Number(faq.id), question: faq.question, categoryName, categorySlug, action, section, sectionAction })

      if (opts.apply && Object.keys(data).length > 0) {
        await payload.update({
          collection: 'faqs',
          id: faq.id,
          data: data as any,
          overrideAccess: true,
          context: { disableHooks: true },
        })
        report.changed++
      }
    } catch (err: any) {
      report.errors.push({ id: Number(faq.id), reason: err?.message ?? String(err) })
    }
  }

  return report
}
