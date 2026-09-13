/**
 * One-time backfill for the FAQ system (docs/FAQ-SYSTEM-2026-09-13.md): gives
 * every FAQ with no category a home category, and every FAQ with no section a
 * section. Creates the categories it needs.
 *
 *   npx tsx --env-file=.env.staging scripts/assign-faq-categories.ts           # dry run
 *   npx tsx --env-file=.env.staging scripts/assign-faq-categories.ts --apply   # write
 *
 * NOT an npm script on purpose: every npm script here is hardcoded to
 * --env-file=.env.local, and .env.local is PRODUCTION.
 *
 * Same logic as the "Assign missing" button on the FAQs admin screen
 * (lib/faqs/assign.ts). Safe to re-run: it only touches rows that are still
 * missing a category or section, so an admin's choices are never overwritten.
 *
 * Page caches are not purged from a script (there is no Next request here).
 * Pages pick the change up on their own ISR timer, or save anything on the FAQ
 * settings panel to purge at once.
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { assignMissingFaqFields } from '../lib/faqs/assign'

async function main() {
  const apply = process.argv.includes('--apply')
  const host = (() => {
    try { return new URL(process.env.DATABASE_URI ?? '').host } catch { return 'unknown' }
  })()
  console.log(`[assign-faq-categories] Database host: ${host}`)
  console.log(`[assign-faq-categories] Mode: ${apply ? 'APPLY (writes)' : 'dry run (no writes)'}\n`)

  const payload = await getPayload({ config })
  const report = await assignMissingFaqFields(payload, { apply })

  const byCategory = new Map<string, { name: string; n: number; action: string }>()
  const bySection = new Map<string, number>()
  for (const r of report.rows) {
    if (r.categorySlug) {
      const e = byCategory.get(r.categorySlug) ?? { name: r.categoryName, n: 0, action: r.action }
      e.n++
      byCategory.set(r.categorySlug, e)
    }
    if (r.sectionAction === 'guessed') bySection.set(r.section, (bySection.get(r.section) ?? 0) + 1)
  }

  console.log(`FAQs missing a category or section: ${report.scanned}`)
  console.log(`\nCategories (${byCategory.size}):`)
  for (const [slug, e] of [...byCategory.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  /faq/${slug.padEnd(34)} ${String(e.n).padStart(4)}  ${e.name}  [first row: ${e.action}]`)
  }
  console.log(`\nSections guessed:`)
  for (const [s, n] of bySection) console.log(`  ${s.padEnd(10)} ${n}`)

  if (report.errors.length) {
    console.log(`\nErrors (${report.errors.length}):`)
    for (const e of report.errors.slice(0, 30)) console.log(`  faq ${e.id}: ${e.reason}`)
  }

  console.log(apply ? `\nWrote ${report.changed} FAQ(s).` : `\nDry run only. Re-run with --apply to write.`)
  process.exit(report.errors.length ? 1 : 0)
}

main().catch((err) => {
  console.error('[assign-faq-categories] Fatal:', err)
  process.exit(1)
})
