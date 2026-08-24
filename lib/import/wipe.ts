import type { Payload } from 'payload'

/**
 * Scoped, safe directory-data wipe. Used for the launch-day fake → real swap.
 *
 * SAFETY (enforced by callers, the API route and CLI):
 *   - admin-only
 *   - operator must type a confirmation phrase
 *   - an automatic db:backup is taken BEFORE this runs (no backup → no wipe)
 * This module itself only does the deletes, in child → parent dependency order,
 * with hooks disabled (one summary AuditLog entry is written instead of one per
 * row). Preserves: users, services, locations, guides, authors,
 * medical-reviewers, faqs, media, AND audit-logs (the wipe is recorded there).
 */

export type WipeScope = 'directory' | 'state'

export type WipeResult = {
  scope: WipeScope
  state?: string
  dryRun: boolean
  counts: Record<string, number>
  total: number
}

// Directory reset, in CHILD → PARENT delete order.
const DIRECTORY_ORDER = [
  'reviews', 'photos', 'before-after-cases', 'qa',
  'bookings', 'claims', 'promotions', 'data-alerts',
  'providers', 'clinics',
] as const

const ALL_WHERE = { id: { exists: true } } as const

async function countWhere(payload: Payload, collection: string, where: any): Promise<number> {
  const res = await payload.find({ collection: collection as any, where, limit: 1, depth: 0 })
  return res.totalDocs
}

async function idsWhere(payload: Payload, collection: string, where: any): Promise<number[]> {
  const res = await payload.find({ collection: collection as any, where, limit: 100000, depth: 0 })
  return (res.docs as any[]).map((d) => d.id)
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

type Step = { slug: string; where: any }

/** Build the ordered (child → parent) delete steps for a scope. */
async function buildSteps(payload: Payload, scope: WipeScope, state?: string): Promise<Step[]> {
  if (scope === 'directory') {
    return DIRECTORY_ORDER.map((slug) => ({ slug, where: ALL_WHERE }))
  }

  // By-state: collect target clinic ids, then their dependents.
  const code = (state ?? '').toUpperCase()
  const clinicIds = await idsWhere(payload, 'clinics', { state: { equals: code } })

  const orClinic = (cField: string) => {
    const or: any[] = []
    if (clinicIds.length) or.push({ [cField]: { in: clinicIds } })
    return or
  }

  const steps: Step[] = []
  const pushIfOr = (slug: string, or: any[]) => { if (or.length) steps.push({ slug, where: { or } }) }

  pushIfOr('reviews', clinicIds.length ? [{ clinic: { in: clinicIds } }] : [])
  pushIfOr('photos', orClinic('clinic'))
  // before-after-cases carry their own state field.
  steps.push({ slug: 'before-after-cases', where: { or: [{ state: { equals: code } }] } })
  pushIfOr('bookings', orClinic('clinic'))
  pushIfOr('claims', orClinic('targetClinic'))
  // Parents last. (data-alerts are DB-wide; a re-scan reconciles them after.)
  if (clinicIds.length) steps.push({ slug: 'clinics', where: { id: { in: clinicIds } } })

  return steps
}

export async function runWipe(
  payload: Payload,
  opts: { scope: WipeScope; state?: string; dryRun?: boolean; actorEmail?: string },
): Promise<WipeResult> {
  const { scope, state, dryRun = false, actorEmail = 'system' } = opts
  if (scope === 'state' && !state) throw new Error('A state code is required for a by-state wipe.')

  const steps = await buildSteps(payload, scope, state)
  const counts: Record<string, number> = {}
  let total = 0

  for (const step of steps) {
    const n = await countWhere(payload, step.slug, step.where)
    counts[step.slug] = (counts[step.slug] ?? 0) + n
    total += n
    if (dryRun || n === 0) continue
    await payload.delete({
      collection: step.slug as any,
      where: step.where,
      overrideAccess: true,
      // Skip per-row audit + revalidate; we log one summary entry below.
      context: { disableHooks: true },
    })
  }

  if (!dryRun) {
    try {
      await payload.create({
        collection: 'audit-logs',
        overrideAccess: true,
        data: {
          action: 'delete',
          collectionSlug: scope === 'state' ? `wipe:state:${(state ?? '').toUpperCase()}` : 'wipe:directory',
          documentTitle: `Directory wipe (${scope}${state ? `: ${state.toUpperCase()}` : ''}): ${total} rows`,
          userEmail: actorEmail,
          summary: `Data wipe by ${actorEmail}. Scope: ${scope}${state ? ` (${state.toUpperCase()})` : ''}. Deleted ${total} rows: ${JSON.stringify(counts)}`,
          changedFields: counts,
        } as any,
      })
    } catch (err) {
      payload.logger.error(`[wipe] failed to write audit entry: ${err}`)
    }
  }

  return { scope, state: state ? state.toUpperCase() : undefined, dryRun, counts, total }
}
