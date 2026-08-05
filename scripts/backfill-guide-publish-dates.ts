/**
 * One-off: spread the guides' publishedAt across a date range.
 *
 * Why this exists: all 100 guides carry one identical publishedAt
 * (2026-07-25T20:59:19.354Z). The batch upload file shipped no per-guide
 * publishedAt, so approveContentUpload's `doc.publishedAt ?? now` fallback
 * (lib/import/content-bulk-upload.ts) stamped the whole batch with a single
 * timestamp. The original editorial package has no publish dates to recover, so
 * these are ASSIGNED dates, not recovered ones (founder's call, 2026-08-06).
 *
 * Dates are deterministic, not random: guides are ordered by a hash of their
 * slug and spread evenly across the window below. Re-running produces the same
 * result. Nothing lands in the future.
 *
 * The hash ordering matters. Every guide was created in one alphabetical import
 * run, so ordering by createdAt would hand out dates alphabetically and the
 * listing would come out in reverse-alphabetical order, which reads as machine
 * generated at a glance.
 *
 * Only `publishedAt` is touched. lastMedicallyReviewed stays at 2026-07-20 for
 * every guide, which is correct: the source package really does record a single
 * review date for the whole set.
 *
 * Usage (STAGING):
 *   npx tsx --env-file=.env.staging scripts/backfill-guide-publish-dates.ts
 *   npx tsx --env-file=.env.staging scripts/backfill-guide-publish-dates.ts --apply
 *
 * Default is a dry run. Nothing is written without --apply.
 */

import { getPayload } from 'payload'
import config from '../payload.config'

const WINDOW_START = Date.UTC(2026, 1, 1, 9, 0, 0) // 2026-02-01 09:00 UTC
const WINDOW_END = Date.UTC(2026, 6, 25, 9, 0, 0) // 2026-07-25 09:00 UTC, the real go-live day
const DAY = 24 * 60 * 60 * 1000

/** FNV-1a. Stable across runs, unlike Math.random or object key order. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

async function main() {
  const apply = process.argv.includes('--apply')

  const host = process.env.DATABASE_URI ? new URL(process.env.DATABASE_URI).host : '(unset)'
  console.log(`\nDatabase host : ${host}`)
  console.log(`Mode          : ${apply ? 'APPLY (writes)' : 'DRY RUN (no writes)'}\n`)

  const payload = await getPayload({ config })

  const res = await payload.find({
    collection: 'guides',
    limit: 1000,
    depth: 0,
    sort: 'createdAt',
    overrideAccess: true,
  })

  const guides = res.docs as any[]
  if (guides.length === 0) {
    console.log('No guides found. Nothing to do.')
    return
  }

  const totalDays = Math.round((WINDOW_END - WINDOW_START) / DAY)
  const span = guides.length > 1 ? totalDays / (guides.length - 1) : 0

  const ordered = [...guides].sort((a, b) => hash(String(a.slug)) - hash(String(b.slug)))

  const plan = ordered.map((g, i) => {
    const dayOffset = Math.round(i * span)
    const next = new Date(WINDOW_START + dayOffset * DAY).toISOString()
    return { id: g.id, slug: g.slug, from: g.publishedAt ?? null, to: next }
  })

  const distinct = new Set(plan.map((p) => p.to)).size
  console.log(`Guides        : ${guides.length}`)
  console.log(`Window        : ${new Date(WINDOW_START).toISOString().slice(0, 10)} to ${new Date(WINDOW_END).toISOString().slice(0, 10)}`)
  console.log(`Distinct dates: ${distinct}\n`)

  console.log('First 5 and last 5:')
  for (const p of [...plan.slice(0, 5), ...plan.slice(-5)]) {
    console.log(`  ${p.slug.padEnd(42)} ${String(p.from).slice(0, 10)} -> ${p.to.slice(0, 10)}`)
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to write.')
    return
  }

  console.log('\nWriting...')
  let done = 0
  let failed = 0
  for (const p of plan) {
    try {
      await payload.update({
        collection: 'guides',
        id: p.id,
        data: { publishedAt: p.to },
        overrideAccess: true,
      } as any)
      done++
      if (done % 20 === 0) console.log(`  ${done}/${plan.length}`)
    } catch (err) {
      failed++
      console.log(`  FAILED ${p.slug}: ${(err as Error).message}`)
    }
  }

  console.log(`\nUpdated: ${done}, failed: ${failed}`)

  const check = await payload.find({
    collection: 'guides',
    limit: 1000,
    depth: 0,
    sort: '-publishedAt',
    overrideAccess: true,
  })
  const after = new Set((check.docs as any[]).map((g) => g.publishedAt))
  console.log(`Distinct publishedAt now: ${after.size}`)
  console.log('Newest 3:')
  for (const g of (check.docs as any[]).slice(0, 3)) {
    console.log(`  ${String(g.slug).padEnd(42)} ${String(g.publishedAt).slice(0, 10)}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
