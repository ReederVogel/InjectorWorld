import type { PoolConfig } from 'pg'

/**
 * Railway and DO Managed Postgres sign their certs with a private CA, not a
 * public root, so full chain verification needs that CA supplied via DB_SSL_CA
 * (download it from the database's Connection Details page in the provider's
 * dashboard, paste the PEM contents as the env var value). Localhost has no
 * cert at all, so SSL is off there. rejectUnauthorized: false is never used
 * here — it would silently accept any cert, including a MitM's.
 *
 * Shared by payload.config.ts (the app's own DB pool) and scripts/run-migrations.ts
 * (a separate raw pg.Pool for migrations Payload doesn't manage) so both stay
 * in sync instead of duplicating this logic.
 */

// Env var UIs routinely mangle multi-line PEM values on paste (newlines collapsed
// to nothing, or the whole value wrapped in stray quotes) — confirmed against a
// real DB while debugging a deploy. Rebuilding the PEM from just its base64
// alphabet characters is immune to both: only the marker lines and the base64
// body matter, never the original whitespace.
function normalizePem(raw: string): string {
  const body = raw
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/[^A-Za-z0-9+/=]/g, '')
  const lines = body.match(/.{1,64}/g) ?? []
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`
}

export function getDbSsl(): PoolConfig['ssl'] {
  const uri = process.env.DATABASE_URI
  if (!uri || /@(localhost|127\.0\.0\.1)[:/]/.test(uri)) {
    return false
  }
  if (process.env.DB_SSL_CA) {
    return { rejectUnauthorized: true, ca: normalizePem(process.env.DB_SSL_CA) }
  }
  return { rejectUnauthorized: true }
}
