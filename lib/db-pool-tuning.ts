import type { PoolConfig } from 'pg'

/**
 * Timeout/keepalive settings for the Payload postgres pool.
 *
 * Lives here rather than inline in payload.config.ts because WHERE these apply
 * is the whole subtlety, and the config file gives no way to test it: the
 * adapter never exposes what it was handed.
 *
 * Background. On 2026-08-17 staging wedged: every DB-backed route (listing APIs,
 * /api/search, robots.txt) stopped responding, Cloudflare returned 520 after
 * ~162s, and pg_stat_activity showed the app holding ZERO sessions throughout.
 * The pool's four connections were dead sockets it had not noticed, and pg's
 * defaults (connectionTimeoutMillis: 0) mean every later query waits forever.
 * A restart cleared it. These settings make that fail fast and self-heal.
 *
 * Then the first version of this broke a DigitalOcean deploy, because the same
 * pool is used by `db:push`: drizzle's schema introspection fires a burst of
 * parallel queries at a pool of 4, one waiter passed the 10s connect timeout,
 * and the build died with "timeout exceeded when trying to connect". It had
 * scraped through on two earlier deploys, so it is a race rather than a hard
 * limit. Hence isServerRuntime: the timeouts apply to the deployed, running
 * server and to nothing else.
 */

export type PoolTuning = Pick<
  PoolConfig,
  | 'connectionTimeoutMillis'
  | 'idleTimeoutMillis'
  | 'keepAlive'
  | 'keepAliveInitialDelayMillis'
  | 'statement_timeout'
  | 'query_timeout'
>

export type PoolEnv = {
  NEXT_RUNTIME?: string
  NEXT_PHASE?: string
  PAYLOAD_FORCE_PUSH?: string
  NODE_ENV?: string
  DB_CONN_TIMEOUT_MS?: string
  DB_STATEMENT_TIMEOUT_MS?: string
  DB_QUERY_TIMEOUT_MS?: string
}

/**
 * True only inside the deployed, running Next server. Each exclusion below is
 * something that legitimately runs long and must never be cut short:
 *
 * - db-push (PAYLOAD_FORCE_PUSH): drizzle introspection, the deploy break above.
 * - `next build` (NEXT_PHASE): prerendering, many queries through a pool of 4.
 * - plain `tsx scripts/...` (no NEXT_RUNTIME): imports, seeds, backfills, and
 *   setup-search-indexes building GIN/GIST indexes over ~40k clinics.
 * - dev.
 */
export function isServerRuntime(env: PoolEnv): boolean {
  return (
    !!env.NEXT_RUNTIME &&
    env.NEXT_PHASE !== 'phase-production-build' &&
    env.PAYLOAD_FORCE_PUSH !== 'true' &&
    env.NODE_ENV === 'production'
  )
}

const int = (value: string | undefined, fallback: number): number => {
  if (value == null || value.trim() === '') return fallback
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

export function poolTuning(env: PoolEnv = process.env as PoolEnv): PoolTuning {
  // Safe everywhere, because neither can abort work in progress. Keepalives let
  // a connection killed at the far end (managed-PG maintenance, failover, an
  // idle NAT drop) surface as a socket error the pool can evict, instead of a
  // socket that looks alive forever. The idle timeout recycles connections so a
  // stale one is less likely to be handed out in the first place.
  const always: PoolTuning = {
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    idleTimeoutMillis: 30_000,
  }

  if (!isServerRuntime(env)) return always

  // 20s, not the 10s that broke the deploy: this should never fire under normal
  // load, only when the pool is genuinely not coming back.
  const connectionTimeoutMillis = int(env.DB_CONN_TIMEOUT_MS, 20_000)
  // The heaviest runtime query today, the distance-banded listing over ~39.7k
  // clinics, measures ~1.3s. 30s is a wide margin, not a tuning knob.
  const statementTimeout = int(env.DB_STATEMENT_TIMEOUT_MS, 30_000)
  // statement_timeout only fires once the query reaches the server. The
  // 2026-08-19 recurrence of the 2026-08-17 wedge showed that isn't enough:
  // a pool handed out an already-dead-but-idle connection, the query never
  // reached the server at all, and nothing aborted it. query_timeout is
  // enforced client-side by node-postgres itself, so it fires even when the
  // socket never delivers a response -- this is what actually frees the pool
  // instead of waiting on OS-default TCP keepalive probes (minutes).
  const queryTimeout = int(env.DB_QUERY_TIMEOUT_MS, 30_000)

  return {
    ...always,
    ...(connectionTimeoutMillis > 0 ? { connectionTimeoutMillis } : {}),
    ...(statementTimeout > 0 ? { statement_timeout: statementTimeout } : {}),
    ...(queryTimeout > 0 ? { query_timeout: queryTimeout } : {}),
  }
}
