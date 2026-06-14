/**
 * Schema push for deploys (Neon / Railway / DO) and local schema sync.
 *
 * Payload only syncs the schema when the adapter's `push` is on, which
 * payload.config.ts gates behind PAYLOAD_FORCE_PUSH === 'true', and only when
 * NODE_ENV !== 'production'. Both env vars are read when payload.config is
 * evaluated, so they MUST be set before that module loads. ESM hoists static
 * `import` to the top of the file, so a plain `import config` would evaluate the
 * config (and lock in push:false) before any assignment here runs. We therefore
 * use a DYNAMIC import after setting the env, otherwise this script is a silent
 * no-op and schema changes never reach the database ("column ... does not exist").
 *
 * Runs automatically as part of `npm run build`. Locally it no-ops unless
 * DATABASE_URI is present; to push a local schema change run:
 *   PAYLOAD_FORCE_PUSH=true NODE_ENV=development npx tsx --env-file=.env.local scripts/db-push.ts
 */
async function run() {
  if (!process.env.DATABASE_URI) {
    console.log('[db-push] No DATABASE_URI in environment. Skipping schema push.')
    process.exit(0)
  }

  // If NODE_ENV was already 'production' when this script started, we're running during a live
  // deploy (Railway/DO build step). Log the masked target so operators can verify in build logs.
  if (process.env.NODE_ENV === 'production') {
    const safeUri = (process.env.DATABASE_URI || '').replace(/:\/\/[^@]+@/, '://***:***@')
    console.warn('[db-push] Running schema push against a PRODUCTION database.')
    console.warn(`[db-push] Target: ${safeUri}`)
    console.warn('[db-push] This is expected during deploy. If you ran this manually, verify the target above.')
  }

  // Set BEFORE payload.config is imported (dynamic import below).
  ;(process.env as Record<string, string>).NODE_ENV = 'development'
  ;(process.env as Record<string, string>).PAYLOAD_FORCE_PUSH = 'true'

  const { getPayload } = await import('payload')
  const { default: config } = await import('../payload.config')

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
