import { kebab } from './import/helpers'

/**
 * Branch (multi-location) detection + linking. Shared by the admin branch-confirm
 * API, the integrity scan, and the demo seed.
 *
 * RULE (locked): detection only SUGGESTS. Clinics are never auto-merged or
 * auto-grouped. A human links a suggested group under a Brand (or dismisses it).
 */

export type BranchClinic = {
  id: number
  clinicId: string
  clinicName: string
  city: string
  state: string
  brandId: number | null
  websiteUrl?: string
  logoUrl?: string
}

export type BranchSuggestion = {
  /** Stable id for the group = sorted clinic db ids joined. */
  groupId: string
  /** Why these were grouped: shared phone and/or website. */
  signals: Array<'phone' | 'website'>
  /** DataAlert keys covering this group (for resolve/dismiss). */
  alertKeys: string[]
  /** Suggested brand name = common leading words of the clinic names. */
  suggestedBrandName: string
  clinics: BranchClinic[]
}

const normSite = (url: string) =>
  url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')

/** Mirror of scan.ts: brand prefix = first two kebab words of the clinic name. */
function brandToken(name: string): string {
  return kebab(name).split('-').slice(0, 2).join('-')
}

/** The DataAlert key scan.ts uses, recomputed so dismissals match. */
export function branchAlertKey(by: 'phone' | 'website', signalKey: string): string {
  return `scan-branch-${by}-${kebab(signalKey)}`
}

/** Longest common leading word sequence across the clinic names. */
export function commonBrandName(names: string[]): string {
  if (names.length === 0) return ''
  const wordLists = names.map((n) => n.trim().split(/\s+/))
  const first = wordLists[0]
  const common: string[] = []
  for (let i = 0; i < first.length; i++) {
    const w = first[i]
    if (wordLists.every((wl) => wl[i] && wl[i].toLowerCase() === w.toLowerCase())) common.push(w)
    else break
  }
  // Fall back to the first clinic's first two words if there is no shared prefix.
  if (common.length === 0) return first.slice(0, 2).join(' ')
  return common.join(' ')
}

/**
 * Group clinics into branch suggestions (same brand prefix + phone, or same
 * website), only across DISTINCT google_place_ids. Excludes groups already
 * fully linked under one brand. Pure — caller supplies the clinic rows.
 */
export function detectBranchGroups(
  clinics: Array<{
    id: number | string
    clinicId: string
    clinicName: string
    city: string
    state: string
    phone?: string
    websiteUrl?: string
    googlePlaceId?: string
    logoUrl?: string
    brand?: any
  }>,
): BranchSuggestion[] {
  const byPhone: Record<string, typeof clinics> = {}
  const bySite: Record<string, typeof clinics> = {}

  for (const c of clinics) {
    const token = brandToken(c.clinicName ?? '')
    if (token && c.phone) {
      const k = `${token}|${String(c.phone).replace(/\D/g, '')}`
      ;(byPhone[k] ??= []).push(c)
    }
    if (c.websiteUrl) {
      const site = normSite(String(c.websiteUrl))
      if (site) (bySite[site] ??= []).push(c)
    }
  }

  // Collect qualifying groups, tracked by their member-id-set so phone+website
  // groups over the same clinics merge into one suggestion.
  const merged = new Map<string, BranchSuggestion>()

  const consider = (signalKey: string, by: 'phone' | 'website', members: typeof clinics) => {
    if (members.length < 2) return
    const placeIds = new Set(members.map((m) => m.googlePlaceId).filter(Boolean))
    if (placeIds.size < 2) return // same listing, not branches

    const brandRefs = members.map((m) =>
      m.brand == null ? null : typeof m.brand === 'object' ? Number(m.brand.id) : Number(m.brand),
    )
    // Already linked: every member shares one brand → nothing to suggest.
    if (brandRefs.every((b) => b != null && b === brandRefs[0])) return

    const ids = members.map((m) => Number(m.id)).sort((a, b) => a - b)
    const groupId = ids.join('-')
    const alertKey = branchAlertKey(by, signalKey)

    const existing = merged.get(groupId)
    if (existing) {
      if (!existing.signals.includes(by)) existing.signals.push(by)
      if (!existing.alertKeys.includes(alertKey)) existing.alertKeys.push(alertKey)
      return
    }
    merged.set(groupId, {
      groupId,
      signals: [by],
      alertKeys: [alertKey],
      suggestedBrandName: commonBrandName(members.map((m) => m.clinicName)),
      clinics: members.map((m) => ({
        id: Number(m.id),
        clinicId: m.clinicId,
        clinicName: m.clinicName,
        city: m.city,
        state: m.state,
        brandId: m.brand == null ? null : typeof m.brand === 'object' ? Number(m.brand.id) : Number(m.brand),
        websiteUrl: m.websiteUrl,
        logoUrl: m.logoUrl,
      })),
    })
  }

  for (const [k, members] of Object.entries(byPhone)) consider(k, 'phone', members)
  for (const [k, members] of Object.entries(bySite)) consider(k, 'website', members)

  return Array.from(merged.values())
}

// ─── Payload-backed operations ───────────────────────────────────────────────

/** Load all clinics (depth 0) and detect branch suggestions, skipping any group
 * whose alert was dismissed (a resolved possible_branch alert). */
export async function getBranchSuggestions(payload: any): Promise<BranchSuggestion[]> {
  const res = await payload.find({ collection: 'clinics', limit: 10000, depth: 0 })
  const groups = detectBranchGroups(res.docs as any)
  if (groups.length === 0) return []

  // Which alert keys were dismissed/resolved by an operator?
  const allKeys = Array.from(new Set(groups.flatMap((g) => g.alertKeys)))
  const dismissed = new Set<string>()
  try {
    const alertRes = await payload.find({
      collection: 'data-alerts',
      where: { and: [{ alertKey: { in: allKeys } }, { status: { not_equals: 'open' } }] },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    for (const a of alertRes.docs) dismissed.add(a.alertKey)
  } catch {
    /* no alerts table access — show all */
  }

  return groups.filter((g) => !g.alertKeys.some((k) => dismissed.has(k)))
}

async function uniqueBrandSlug(payload: any, base: string): Promise<string> {
  let slug = base || 'brand'
  let n = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await payload.find({
      collection: 'brands',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length === 0) return slug
    n += 1
    slug = `${base}-${n}`
  }
}

/** Mark the group's possible_branch alerts resolved (self-heal / dismiss). */
async function resolveBranchAlerts(payload: any, alertKeys: string[], note: string) {
  for (const key of alertKeys) {
    try {
      const found = await payload.find({
        collection: 'data-alerts',
        where: { alertKey: { equals: key } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (found.docs.length > 0) {
        await payload.update({
          collection: 'data-alerts',
          id: found.docs[0].id,
          data: { status: 'resolved' },
          overrideAccess: true,
        })
      } else {
        await payload.create({
          collection: 'data-alerts',
          data: {
            alertKey: key,
            type: 'possible_branch',
            severity: 'info',
            message: note,
            collectionSlug: 'clinics',
            source: 'branch-tool',
            status: 'resolved',
          },
          overrideAccess: true,
        })
      }
    } catch {
      /* best-effort */
    }
  }
}

/**
 * Link a set of clinics under one brand. Creates the brand if no brandId given.
 * Never merges clinic records — each stays its own location, only its `brand`
 * relationship is set. Resolves the group's branch alerts.
 */
export async function linkClinicsToBrand(
  payload: any,
  opts: {
    clinicIds: number[]
    brandName: string
    brandId?: number
    alertKeys?: string[]
    websiteUrl?: string
    logoUrl?: string
    description?: string
  },
): Promise<{ brandId: number; brandSlug: string; brandName: string; linked: number }> {
  const { clinicIds, brandName } = opts
  if (clinicIds.length === 0) throw new Error('No clinics to link.')

  let brand: any
  if (opts.brandId) {
    brand = await payload.findByID({ collection: 'brands', id: opts.brandId, depth: 0, overrideAccess: true })
    if (!brand) throw new Error('Brand not found.')
  } else {
    const name = brandName.trim()
    if (!name) throw new Error('Brand name is required.')
    const base = kebab(name)
    const slug = await uniqueBrandSlug(payload, base)
    brand = await payload.create({
      collection: 'brands',
      data: {
        brandId: `brand-${slug}`,
        name,
        slug,
        websiteUrl: opts.websiteUrl || undefined,
        logoUrl: opts.logoUrl || undefined,
        description: opts.description || undefined,
      },
      overrideAccess: true,
    })
  }

  let linked = 0
  for (const cid of clinicIds) {
    try {
      await payload.update({
        collection: 'clinics',
        id: cid,
        data: { brand: brand.id }, // raw number id (locked rule)
        overrideAccess: true,
      })
      linked += 1
    } catch {
      /* skip an individual clinic that fails, keep going */
    }
  }

  if (opts.alertKeys && opts.alertKeys.length > 0) {
    await resolveBranchAlerts(payload, opts.alertKeys, `Linked under brand "${brand.name}".`)
  }

  return { brandId: Number(brand.id), brandSlug: brand.slug, brandName: brand.name, linked }
}

/** Dismiss a branch suggestion ("not a branch") so it stops surfacing. */
export async function dismissBranchSuggestion(payload: any, alertKeys: string[]): Promise<void> {
  await resolveBranchAlerts(payload, alertKeys, 'Reviewed and dismissed: not a branch.')
}
