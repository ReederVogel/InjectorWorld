import { z } from 'zod'
import type { Payload } from 'payload'
import { faqKebab } from './slug'
import { FAQ_SETTINGS_DEFAULTS } from './queries'

/**
 * Server side of the FAQ admin panels (components/admin/list-headers/Faq*Panel.tsx).
 * Every FAQ control lives on the FAQs screen (founder, 2026-09-13), so the
 * routes under app/api/admin/faqs/ are the only way categories and settings
 * change. Validation lives here so the routes stay thin.
 */

export const CATEGORY_TYPES = ['treatment', 'brand', 'topic', 'location', 'general'] as const

const idList = z.array(z.coerce.number().int().positive()).max(200).default([])

export const categoryInput = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  slug: z.string().trim().max(80).optional().default(''),
  type: z.enum(CATEGORY_TYPES),
  enabled: z.boolean().default(true),
  intro: z.string().trim().max(2000).optional().default(''),
  metaTitle: z.string().trim().max(160).optional().default(''),
  metaDescription: z.string().trim().max(320).optional().default(''),
  sortRank: z.coerce.number().int().min(0).max(100000).default(100),
  services: idList,
  brands: idList,
  guides: idList,
  locations: idList,
})
export type CategoryInput = z.infer<typeof categoryInput>

export const settingsInput = z.object({
  hubEnabled: z.boolean(),
  hubTitle: z.string().trim().min(1).max(120),
  hubIntro: z.string().trim().max(1000),
  hubMetaDescription: z.string().trim().max(320),
  previewCount: z.coerce.number().int().min(1).max(20),
  showOnServicePages: z.boolean(),
  showOnBrandPages: z.boolean(),
  showOnGuidePages: z.boolean(),
  showOnLocationPages: z.boolean(),
  schemaEnabled: z.boolean(),
})
export type SettingsInput = z.infer<typeof settingsInput>

export function firstZodError(err: z.ZodError): string {
  const i = err.issues[0]
  return i ? `${i.path.join('.') || 'input'}: ${i.message}` : 'Invalid input.'
}

/** Payload data for a create/update, with the slug normalised (or derived from the name). */
export function toCategoryData(input: CategoryInput) {
  return {
    name: input.name,
    slug: faqKebab(input.slug || input.name),
    type: input.type,
    enabled: input.enabled,
    intro: input.intro || null,
    metaTitle: input.metaTitle || null,
    metaDescription: input.metaDescription || null,
    sortRank: input.sortRank,
    services: input.services,
    brands: input.brands,
    guides: input.guides,
    locations: input.locations,
  }
}

export type AdminCategoryRow = {
  id: number
  name: string
  slug: string
  type: string
  enabled: boolean
  intro: string
  metaTitle: string
  metaDescription: string
  sortRank: number
  services: Array<{ id: number; label: string }>
  brands: Array<{ id: number; label: string }>
  guides: Array<{ id: number; label: string }>
  locations: Array<{ id: number; label: string }>
  total: number
  approved: number
}

function locationLabel(l: any): string {
  const name = String(l?.name ?? '')
  return l?.kind === 'state' || !l?.state ? name : `${name}, ${String(l.state).toUpperCase()}`
}

export async function listCategoriesForAdmin(payload: Payload): Promise<{
  categories: AdminCategoryRow[]
  uncategorised: number
  noSection: number
}> {
  const pool = (payload.db as any).pool
  const [cats, counts, loose] = await Promise.all([
    payload.find({ collection: 'faq-categories', limit: 1000, depth: 1, sort: ['sortRank', 'name'], overrideAccess: true, pagination: false }),
    pool.query(
      `SELECT category_id AS id, count(*)::int AS total,
              count(*) FILTER (WHERE review_status = 'approved')::int AS approved
         FROM faqs WHERE category_id IS NOT NULL GROUP BY category_id`,
    ),
    pool.query(
      `SELECT count(*) FILTER (WHERE category_id IS NULL)::int AS uncategorised,
              count(*) FILTER (WHERE section IS NULL)::int AS no_section
         FROM faqs`,
    ),
  ])
  const byId = new Map<number, { total: number; approved: number }>(
    (counts.rows as any[]).map((r) => [Number(r.id), { total: Number(r.total), approved: Number(r.approved) }]),
  )
  const rel = (v: any, label: (d: any) => string) =>
    ((v ?? []) as any[]).filter((d) => d && typeof d === 'object').map((d) => ({ id: Number(d.id), label: label(d) }))

  return {
    categories: (cats.docs as any[]).map((c) => ({
      id: Number(c.id),
      name: c.name,
      slug: c.slug,
      type: c.type,
      enabled: c.enabled !== false,
      intro: c.intro ?? '',
      metaTitle: c.metaTitle ?? '',
      metaDescription: c.metaDescription ?? '',
      sortRank: Number(c.sortRank ?? 100),
      services: rel(c.services, (d) => d.name),
      brands: rel(c.brands, (d) => d.name),
      guides: rel(c.guides, (d) => d.title),
      locations: rel(c.locations, locationLabel),
      total: byId.get(Number(c.id))?.total ?? 0,
      approved: byId.get(Number(c.id))?.approved ?? 0,
    })),
    uncategorised: Number(loose.rows[0]?.uncategorised ?? 0),
    noSection: Number(loose.rows[0]?.no_section ?? 0),
  }
}

export async function readSettingsForAdmin(payload: Payload): Promise<SettingsInput> {
  const s: any = await payload.findGlobal({ slug: 'faq-settings', depth: 0, overrideAccess: true }).catch(() => null)
  const d = FAQ_SETTINGS_DEFAULTS
  const pick = <T>(v: unknown, fallback: T): T => (v === null || v === undefined || v === '' ? fallback : (v as T))
  return {
    hubEnabled: pick(s?.hubEnabled, d.hubEnabled),
    hubTitle: pick(s?.hubTitle, d.hubTitle),
    hubIntro: pick(s?.hubIntro, d.hubIntro),
    hubMetaDescription: pick(s?.hubMetaDescription, d.hubMetaDescription),
    previewCount: pick(s?.previewCount, d.previewCount),
    showOnServicePages: pick(s?.showOnServicePages, d.showOnServicePages),
    showOnBrandPages: pick(s?.showOnBrandPages, d.showOnBrandPages),
    showOnGuidePages: pick(s?.showOnGuidePages, d.showOnGuidePages),
    showOnLocationPages: pick(s?.showOnLocationPages, d.showOnLocationPages),
    schemaEnabled: pick(s?.schemaEnabled, d.schemaEnabled),
  }
}

/** Search for the "linked pages" pickers. */
export async function lookupLinkTargets(
  payload: Payload,
  type: 'services' | 'brands' | 'guides' | 'locations',
  q: string,
): Promise<Array<{ id: number; label: string }>> {
  const term = q.trim().slice(0, 80)
  if (type === 'guides') {
    const res = await payload.find({
      collection: 'guides',
      where: term ? { title: { like: term } } : {},
      limit: 15, depth: 0, sort: 'title', overrideAccess: true,
    })
    return (res.docs as any[]).map((d) => ({ id: Number(d.id), label: d.title }))
  }
  if (type === 'locations') {
    const res = await payload.find({
      collection: 'locations',
      where: {
        and: [
          { kind: { in: ['state', 'metro', 'city'] } },
          ...(term ? [{ name: { like: term } }] : []),
        ],
      },
      limit: 15, depth: 0, sort: 'name', overrideAccess: true,
    })
    return (res.docs as any[]).map((d) => ({ id: Number(d.id), label: `${locationLabel(d)} (${d.kind})` }))
  }
  const res = await payload.find({
    collection: type,
    where: term ? { name: { like: term } } : {},
    limit: 15, depth: 0, sort: 'name', overrideAccess: true,
  })
  return (res.docs as any[]).map((d) => ({ id: Number(d.id), label: d.name }))
}
