/**
 * Scoped directory-data wipe (CLI). For the launch-day fake → real swap.
 *
 *   npm run db:wipe -- --scope=directory --dry-run        # preview counts, deletes nothing
 *   npm run db:wipe -- --scope=directory --confirm        # real wipe (auto-backs-up first)
 *   npm run db:wipe -- --scope=state --state=CA --confirm  # wipe one state's directory data
 *
 * Safety: a real wipe (no --dry-run) REQUIRES --confirm and takes an automatic
 * db:backup first. If the backup fails, the wipe is aborted. Preserves users,
 * treatments, locations, guides, authors, reviewers, faqs, media, audit-logs.
 *
 * Roll back: npm run db:restore -- "<the .dump printed below>"
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { runWipe, type WipeScope } from '../lib/import/wipe'
import { backupDatabase } from '../lib/db-backup-core'

function arg(name: string): string | undefined {
  const pre = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(pre))
  return hit ? hit.slice(pre.length) : undefined
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

async function main() {
  const scope = (arg('scope') ?? 'directory') as WipeScope
  const state = arg('state')
  const dryRun = flag('dry-run')
  const confirm = flag('confirm')

  if (scope !== 'directory' && scope !== 'state') {
    console.error('Invalid --scope. Use "directory" or "state".')
    process.exit(1)
  }
  if (scope === 'state' && !state) {
    console.error('--scope=state requires --state=XX (e.g. --state=CA).')
    process.exit(1)
  }

  if (!dryRun && !confirm) {
    console.error('\nRefusing to wipe without --confirm. Add --dry-run to preview, or --confirm to proceed.')
    process.exit(1)
  }

  console.log(`\n===== directory wipe (${dryRun ? 'DRY RUN' : 'LIVE'}) =====`)
  console.log(`Scope: ${scope}${state ? ` (${state.toUpperCase()})` : ''}\n`)

  if (!dryRun) {
    console.log('Taking a safety backup first...')
    try {
      const { file } = backupDatabase()
      console.log(`Backup written: ${file}`)
      console.log(`Roll back with: npm run db:restore -- "${file}"\n`)
    } catch (err: any) {
      console.error(`\nBackup failed, aborting wipe: ${err?.message ?? err}`)
      process.exit(1)
    }
  }

  const payload = await getPayload({ config })
  const result = await runWipe(payload, { scope, state, dryRun, actorEmail: 'cli' })

  console.log(dryRun ? 'Would delete:' : 'Deleted:')
  for (const [slug, n] of Object.entries(result.counts)) console.log(`  ${slug.padEnd(20)} ${n}`)
  console.log(`  ${'TOTAL'.padEnd(20)} ${result.total}`)
  console.log(`\n===== wipe ${dryRun ? 'preview' : 'complete'} =====\n`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
