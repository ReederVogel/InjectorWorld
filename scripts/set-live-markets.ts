/**
 * Phase 3 — Markets control. Switch the locked launch markets live.
 *
 * Locked launch states (CLAUDE.md / docs/DECISIONS.md): California, Texas,
 * New York, Florida. This script enforces exactly that set:
 *   - The 4 launch states + every city/metro/neighborhood inside them
 *       → isLive = true, noindex = false  (live + indexable)
 *   - The 4 launch states also → featured = true, sortRank 1-4
 *       (so they lead the homepage "Browse by State" grid)
 *   - Everything else → isLive = false, noindex = true  (coming soon)
 *
 * Idempotent: safe to re-run. Only writes when a value actually changes.
 *
 * Run:  npm run set:live
 * (db:backup first — this mutates data. scan:alerts after.)
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const LAUNCH_STATE_CODES = new Set(['CA', 'TX', 'NY', 'FL'])
const LAUNCH_STATE_NAMES = new Set(['California', 'Texas', 'New York', 'Florida'])
// Lead order on the homepage grid.
const LAUNCH_SORT_RANK: Record<string, number> = { California: 1, Texas: 2, 'New York': 3, Florida: 4 }

async function main() {
  const payload = await getPayload({ config })

  const all = await payload.find({ collection: 'locations', limit: 10000, depth: 0 })

  let live = 0
  let comingSoon = 0
  let unchanged = 0

  for (const loc of all.docs as any[]) {
    const code = (loc.state ?? '').toUpperCase()
    const isLaunchState = loc.kind === 'state' && (LAUNCH_STATE_NAMES.has(loc.name) || LAUNCH_STATE_CODES.has(code))
    const inLaunchState = loc.kind !== 'state' && LAUNCH_STATE_CODES.has(code)
    const shouldBeLive = isLaunchState || inLaunchState

    const data: Record<string, unknown> = {}

    if ((loc.isLive === true) !== shouldBeLive) data.isLive = shouldBeLive
    if ((loc.noindex !== false) !== !shouldBeLive) data.noindex = !shouldBeLive

    if (isLaunchState) {
      if (loc.featured !== true) data.featured = true
      const rank = LAUNCH_SORT_RANK[loc.name]
      if (rank && loc.sortRank !== rank) data.sortRank = rank
    }

    if (Object.keys(data).length === 0) {
      unchanged++
      continue
    }

    await payload.update({ collection: 'locations', id: loc.id, data })
    if (shouldBeLive) {
      live++
      console.log(`  LIVE       ${loc.kind.padEnd(13)} ${loc.name}`)
    } else {
      comingSoon++
      console.log(`  coming-soon ${loc.kind.padEnd(12)} ${loc.name}`)
    }
  }

  console.log(`\nSet-live-markets: ${live} set live, ${comingSoon} set coming-soon, ${unchanged} unchanged.`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
