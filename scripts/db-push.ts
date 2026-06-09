/**
 * Schema push for deploys (Neon / production).
 *
 * Payload only auto-syncs the database schema when NODE_ENV !== 'production'.
 * On Vercel the build runs in production mode, so schema changes never reach
 * the database and queries fail with "column ... does not exist".
 *
 * This script forces a one-shot schema push BEFORE `next build` runs, so the
 * production database (Neon) always matches the code. It is additive: Payload's
 * push applies new tables/columns without prompting. If a change would cause
 * data loss, push aborts safely without applying (see note below) — handle
 * those with a real migration instead.
 *
 * Runs automatically as part of `npm run build` (see package.json).
 * Locally it no-ops unless DATABASE_URI is present in the environment.
 */
import { getPayload } from 'payload'
import config from '../payload.config'

async function run() {
  if (!process.env.DATABASE_URI) {
    console.log('[db-push] No DATABASE_URI in environment. Skipping schema push.')
    process.exit(0)
  }

  // Payload pushes the dev schema only when NODE_ENV !== 'production'.
  // ESM imports are hoisted, so this assignment runs before getPayload() is
  // called below — which is when the adapter reads NODE_ENV at connect time.
  ;(process.env as Record<string, string>).NODE_ENV = 'development'
  // Turn on the adapter's schema push (off by default for fast dev — see payload.config.ts).
  ;(process.env as Record<string, string>).PAYLOAD_FORCE_PUSH = 'true'

  console.log('[db-push] Syncing database schema...')
  const payload = await getPayload({ config })
  payload.logger.info('[db-push] Schema push complete.')
  process.exit(0)
}

run().catch((err) => {
  console.error('[db-push] Schema push failed:')
  console.error(err)
  process.exit(1)
})
