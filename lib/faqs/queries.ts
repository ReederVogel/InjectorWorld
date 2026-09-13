import { cache } from 'react'
import { getPayloadInstance } from '../payload-server'
import { FAQ_SECTIONS, isFaqSection } from './sections'
import { faqAnchor } from './slug'

/**
 * Read side of the FAQ system. Every public FAQ block on the site comes through
 * here, so the page rules in docs/FAQ-SYSTEM-2026-09-13.md live in one file:
 *
 *   getFaqCategoryPage  /faq/<slug>: every approved FAQ, grouped by section
 *   getFaqHub           /faq: every enabled category that has an approved FAQ
 *   getFaqPreview       treatment, brand and guide pages: first N from the
 *                       categories linked to that page, never place-specific FAQs
 *   getFaqsForPlace     state and city pages: only FAQs set to that place, no
 *                       fallback to general FAQs (that fallback repeated the same
 *                       block on ~50 state pages)
 *
 * Only /faq/<slug> may emit FAQPage schema. The other blocks are previews of a
 * page that already carries it.
 */

export type FaqRow = {
  id: string
  question: string
  answer: string
  detail?: string
  offLabel?: boolean
  safetyFlag?: string
  relatedGuideSlug?: string
  relatedGuideTitle?: string
  /** Anchor id on the category page, e.g. will-botox-make-me-look-frozen. */
  anchor?: string
}

export type FaqSeeAll = { href: string; label: string; count: number }
export type FaqBlock = { faqs: FaqRow[]; seeAll: FaqSeeAll | null }

export const EMPTY_FAQ_BLOCK: FaqBlock = { faqs: [], seeAll: null }

export type FaqSettingsResolved = {
  hubEnabled: boolean
  hubTitle: string
  hubIntro: string
  hubMetaDescription: string
  previewCount: number
  showOnServicePages: boolean
  showOnBrandPages: boolean
  showOnGuidePages: boolean
  showOnLocationPages: boolean
  schemaEnabled: boolean
}

/** Mirrors the defaultValues in collections/globals/FaqSettings.ts. */
export const FAQ_SETTINGS_DEFAULTS: FaqSettingsResolved = {
  hubEnabled: true,
  hubTitle: 'Frequently Asked Questions',
  hubIntro:
    'Straight answers to the questions people ask most about injectables, from what a treatment does to what it costs and what can go wrong.',
  hubMetaDescription: '',
  previewCount: 5,
  showOnServicePages: true,
  showOnBrandPages: true,
  showOnGuidePages: true,
  showOnLocationPages: true,
  schemaEnabled: true,
}

const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v : fallback)

export const getFaqSettings = cache(async function getFaqSettings(): Promise<FaqSettingsResolved> {
  const d = FAQ_SETTINGS_DEFAULTS
  try {
    const payload = await getPayloadInstance()
    const s: any = await payload.findGlobal({ slug: 'faq-settings', depth: 0 })
    const count = Number(s?.previewCount)
    return {
      hubEnabled: bool(s?.hubEnabled, d.hubEnabled),
      hubTitle: str(s?.hubTitle, d.hubTitle),
      hubIntro: str(s?.hubIntro, d.hubIntro),
      hubMetaDescription: str(s?.hubMetaDescription, d.hubMetaDescription),
      previewCount: Number.isInteger(count) && count >= 1 && count <= 20 ? count : d.previewCount,
      showOnServicePages: bool(s?.showOnServicePages, d.showOnServicePages),
      showOnBrandPages: bool(s?.showOnBrandPages, d.showOnBrandPages),
      showOnGuidePages: bool(s?.showOnGuidePages, d.showOnGuidePages),
      showOnLocationPages: bool(s?.showOnLocationPages, d.showOnLocationPages),
      schemaEnabled: bool(s?.schemaEnabled, d.schemaEnabled),
    }
  } catch {
    // A missing or unreadable settings row must never take a page down.
    return d
  }
})

const APPROVED = { reviewStatus: { equals: 'approved' } }
const IN_PREVIEWS = { showInPreview: { not_equals: false } }
const ENABLED = { enabled: { not_equals: false } }
const FAQ_SORT = ['sortRank', 'createdAt']

export function mapFaq(f: any): FaqRow {
  return {
    id: String(f.id),
    question: f.question,
    answer: f.answer,
    detail: f.answerDetail || undefined,
    offLabel: !!f.offLabel,
    safetyFlag: f.safetyFlag || undefined,
    relatedGuideSlug: f.relatedGuide && typeof f.relatedGuide === 'object' ? f.relatedGuide.slug : undefined,
    relatedGuideTitle: f.relatedGuide && typeof f.relatedGuide === 'object' ? f.relatedGuide.title : undefined,
    anchor: faqAnchor(f.question),
  }
}

async function seeAllFor(payload: any, category: any, settings: FaqSettingsResolved): Promise<FaqSeeAll | null> {
  if (!settings.hubEnabled || !category?.slug) return null
  const res = await payload.count({ collection: 'faqs', where: { and: [{ category: { equals: category.id } }, APPROVED] } })
  const count = Number(res?.totalDocs ?? 0)
  if (count === 0) return null
  return {
    href: `/faq/${category.slug}`,
    label: `See all ${count} ${category.name} question${count === 1 ? '' : 's'}`,
    count,
  }
}

/** Preview on a treatment, brand or guide page. */
export async function getFaqPreview(link: { field: 'services' | 'brands' | 'guides'; id: number | string }): Promise<FaqBlock> {
  try {
    const settings = await getFaqSettings()
    const on =
      link.field === 'services' ? settings.showOnServicePages
        : link.field === 'brands' ? settings.showOnBrandPages
          : settings.showOnGuidePages
    if (!on) return EMPTY_FAQ_BLOCK

    const payload = await getPayloadInstance()
    const cats = await payload.find({
      collection: 'faq-categories',
      where: { and: [{ [link.field]: { in: [Number(link.id)] } }, ENABLED] },
      sort: ['sortRank', 'name'],
      limit: 10,
      depth: 0,
    })
    if (cats.docs.length === 0) return EMPTY_FAQ_BLOCK

    const faqs = await payload.find({
      collection: 'faqs',
      where: {
        and: [
          { category: { in: cats.docs.map((c) => c.id) } },
          APPROVED,
          IN_PREVIEWS,
          // A place-specific answer ("Botox cost in NYC") is wrong for everyone
          // else reading the national page.
          { location: { exists: false } },
        ],
      },
      sort: FAQ_SORT,
      limit: settings.previewCount,
      depth: 1,
    })

    return { faqs: faqs.docs.map(mapFaq), seeAll: await seeAllFor(payload, cats.docs[0], settings) }
  } catch (err) {
    console.error('[faqs] preview failed:', err)
    return EMPTY_FAQ_BLOCK
  }
}

/**
 * FAQs set to one place. With serviceId/brandId, only those also set to that
 * treatment/brand (the /services/<svc>/<place> and /brands/<b>/<place> pages).
 * Without, every FAQ for the place (the /clinics/<place> pages).
 */
export async function getFaqsForPlace(opts: {
  locationId: number | string
  serviceId?: number | string
  brandId?: number | string
}): Promise<FaqBlock> {
  try {
    const settings = await getFaqSettings()
    if (!settings.showOnLocationPages) return EMPTY_FAQ_BLOCK
    const payload = await getPayloadInstance()

    const disabled = await payload.find({
      collection: 'faq-categories',
      where: { enabled: { equals: false } },
      limit: 1000,
      depth: 0,
      pagination: false,
    })
    const disabledIds = disabled.docs.map((c) => c.id)

    const and: any[] = [{ location: { equals: Number(opts.locationId) } }, APPROVED, IN_PREVIEWS]
    if (opts.serviceId != null) and.push({ service: { equals: Number(opts.serviceId) } })
    if (opts.brandId != null) and.push({ brand: { equals: Number(opts.brandId) } })
    if (disabledIds.length > 0) {
      and.push({ or: [{ category: { not_in: disabledIds } }, { category: { exists: false } }] })
    }

    const faqs = await payload.find({ collection: 'faqs', where: { and }, sort: FAQ_SORT, limit: settings.previewCount, depth: 1 })
    if (faqs.docs.length === 0) return EMPTY_FAQ_BLOCK

    const cat = await payload.find({
      collection: 'faq-categories',
      where: { and: [{ locations: { in: [Number(opts.locationId)] } }, ENABLED] },
      sort: ['sortRank', 'name'],
      limit: 1,
      depth: 0,
    })

    return { faqs: faqs.docs.map(mapFaq), seeAll: await seeAllFor(payload, cat.docs[0], settings) }
  } catch (err) {
    console.error('[faqs] place block failed:', err)
    return EMPTY_FAQ_BLOCK
  }
}

// ─── /faq ────────────────────────────────────────────────────────────────────

export const FAQ_CATEGORY_TYPES = [
  { value: 'treatment', label: 'Treatments' },
  { value: 'brand', label: 'Brands' },
  { value: 'topic', label: 'Topics' },
  { value: 'location', label: 'Places' },
  { value: 'general', label: 'About injector.world' },
] as const

export type FaqHubCategory = { id: string; name: string; slug: string; type: string; count: number }
export type FaqHubData = {
  settings: FaqSettingsResolved
  groups: Array<{ type: string; label: string; categories: FaqHubCategory[] }>
  totalQuestions: number
  totalCategories: number
}

export const getFaqHub = cache(async function getFaqHub(): Promise<FaqHubData | null> {
  const settings = await getFaqSettings()
  if (!settings.hubEnabled) return null
  const payload = await getPayloadInstance()
  const pool = (payload.db as any).pool
  // Raw SQL: one grouped count instead of a count query per category.
  const res = await pool.query(
    `SELECT c.id, c.name, c.slug, c.type::text AS type, count(f.id)::int AS n
       FROM faq_categories c
       JOIN faqs f ON f.category_id = c.id AND f.review_status = 'approved'
      WHERE c.enabled IS DISTINCT FROM false
      GROUP BY c.id, c.name, c.slug, c.type, c.sort_rank
      ORDER BY c.sort_rank NULLS LAST, c.name`,
  )
  const rows: FaqHubCategory[] = (res.rows as any[]).map((r) => ({
    id: String(r.id), name: r.name, slug: r.slug, type: r.type, count: Number(r.n),
  }))
  const groups = FAQ_CATEGORY_TYPES
    .map((t) => ({ type: t.value as string, label: t.label as string, categories: rows.filter((r) => r.type === t.value) }))
    .filter((g) => g.categories.length > 0)
  return {
    settings,
    groups,
    totalQuestions: rows.reduce((n, r) => n + r.count, 0),
    totalCategories: rows.length,
  }
})

// ─── /faq/<slug> ─────────────────────────────────────────────────────────────

export type FaqCategoryPageData = {
  settings: FaqSettingsResolved
  category: {
    id: string
    name: string
    slug: string
    type: string
    intro?: string
    metaTitle?: string
    metaDescription?: string
    updatedAt?: string
  }
  sections: Array<{ value: string; label: string; faqs: FaqRow[] }>
  total: number
  /** Most recent edit to any FAQ on the page. */
  lastUpdated?: string
  /** Where to go next: the treatment, brand, guide and place pages this category is linked to. */
  links: Array<{ href: string; label: string }>
}

export const getFaqCategoryPage = cache(async function getFaqCategoryPage(slug: string): Promise<FaqCategoryPageData | null> {
  const settings = await getFaqSettings()
  if (!settings.hubEnabled) return null
  const payload = await getPayloadInstance()

  const catRes = await payload.find({
    collection: 'faq-categories',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
  })
  const cat: any = catRes.docs[0]
  if (!cat || cat.enabled === false) return null

  const faqRes = await payload.find({
    collection: 'faqs',
    where: { and: [{ category: { equals: cat.id } }, APPROVED] },
    sort: FAQ_SORT,
    limit: 2000,
    pagination: false,
    depth: 1,
  })
  if (faqRes.docs.length === 0) return null

  // Two FAQs with the same question in one category would share an anchor.
  const seen = new Map<string, number>()
  const bySection = new Map<string, FaqRow[]>()
  let lastUpdated: string | undefined
  for (const f of faqRes.docs as any[]) {
    if (f.updatedAt && (!lastUpdated || f.updatedAt > lastUpdated)) lastUpdated = f.updatedAt
    const row = mapFaq(f)
    const n = (seen.get(row.anchor!) ?? 0) + 1
    seen.set(row.anchor!, n)
    if (n > 1) row.anchor = `${row.anchor}-${n}`
    const key = isFaqSection(f.section) ? f.section : 'basics'
    bySection.set(key, [...(bySection.get(key) ?? []), row])
  }
  const sections = FAQ_SECTIONS
    .map((s) => ({ value: s.value as string, label: s.label as string, faqs: bySection.get(s.value) ?? [] }))
    .filter((s) => s.faqs.length > 0)

  const links: Array<{ href: string; label: string }> = []
  for (const s of (cat.services ?? []) as any[]) {
    if (s && typeof s === 'object' && s.slug) links.push({ href: `/services/${s.slug}`, label: `Find ${s.name} injectors` })
  }
  for (const b of (cat.brands ?? []) as any[]) {
    if (b && typeof b === 'object' && b.slug) links.push({ href: `/brands/${b.slug}`, label: `Find ${b.name} injectors` })
  }
  for (const g of (cat.guides ?? []) as any[]) {
    // An unpublished guide 404s, so never link to one.
    if (g && typeof g === 'object' && g.slug && g.status === 'published' && g.reviewStatus === 'approved') {
      links.push({ href: `/guides/${g.slug}`, label: `Read the guide: ${String(g.title).split(/[:(]/)[0].trim()}` })
    }
  }
  const locs = ((cat.locations ?? []) as any[]).filter((l) => l && typeof l === 'object' && l.slug)
  if (locs.length > 0) {
    const codes = [...new Set(locs.filter((l) => l.kind !== 'state' && l.state).map((l) => String(l.state).toUpperCase()))]
    const states = codes.length
      ? await payload.find({ collection: 'locations', where: { and: [{ kind: { equals: 'state' } }, { state: { in: codes } }] }, limit: 60, depth: 0 })
      : { docs: [] as any[] }
    const stateSlugByCode = new Map((states.docs as any[]).map((s) => [String(s.state).toUpperCase(), s.slug as string]))
    for (const l of locs) {
      if (l.kind === 'state') {
        links.push({ href: `/clinics/${l.slug}`, label: `Injectors in ${l.name}` })
      } else {
        const stateSlug = stateSlugByCode.get(String(l.state ?? '').toUpperCase())
        if (stateSlug) links.push({ href: `/clinics/${stateSlug}/${l.slug}`, label: `Injectors in ${String(l.name).replace(/\s+city$/i, '')}` })
      }
    }
  }

  return {
    settings,
    category: {
      id: String(cat.id),
      name: cat.name,
      slug: cat.slug,
      type: cat.type,
      intro: cat.intro || undefined,
      metaTitle: cat.metaTitle || undefined,
      metaDescription: cat.metaDescription || undefined,
      updatedAt: cat.updatedAt,
    },
    sections,
    total: faqRes.docs.length,
    lastUpdated,
    links,
  }
})
