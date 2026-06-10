import type { Plugin } from 'payload'
import { s3Storage } from '@payloadcms/storage-s3'

/**
 * Media storage adapter.
 *
 * Production media lives in S3-compatible object storage so uploads persist
 * across deploys/restarts (the local disk on Railway/DO is ephemeral, so any
 * admin-uploaded image would otherwise vanish on the next restart).
 *
 * Right now the bucket is Cloudflare R2 (free tier, zero egress). The whole
 * point of using an S3-compatible adapter is that moving to DigitalOcean Spaces
 * later is an ENV-ONLY change: swap the six R2_* values for the DO Spaces ones
 * and this file stays exactly as is. The adapter (@payloadcms/storage-s3) does
 * not change.
 *
 * R2 specifics:
 *   - endpoint   = https://<account-id>.r2.cloudflarestorage.com (private S3 API)
 *   - region     = 'auto' (R2 has no real regions)
 *   - forcePathStyle = true (R2 prefers path-style addressing)
 *   - NO per-object ACL: R2 ignores S3 ACLs. Public access is granted on the
 *     bucket (the managed pub-xxxx.r2.dev URL, or a custom domain), so we never
 *     send acl: 'public-read'.
 *   - The S3 endpoint is PRIVATE. Public file URLs must be built from the
 *     separate public domain (R2_PUBLIC_URL), which is what generateFileURL does.
 *
 * Dev fallback: if the R2 env vars are not all present, this returns an empty
 * plugin list and Media falls back to local-disk storage (staticDir in
 * collections/Media.ts), so a fresh clone runs `npm run dev` with no keys.
 */

const bucket = process.env.R2_BUCKET
const endpoint = process.env.R2_ENDPOINT
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const publicUrl = process.env.R2_PUBLIC_URL

/** True only when every credential needed to talk to R2 is set. */
export const isRemoteStorageEnabled = Boolean(
  bucket && endpoint && accessKeyId && secretAccessKey && publicUrl,
)

/**
 * Returns the S3 storage plugin pointed at R2 when configured, otherwise an
 * empty array (local-disk fallback). Spread into the Payload `plugins` array.
 */
export function mediaStoragePlugins(): Plugin[] {
  if (!isRemoteStorageEnabled) return []

  // Strip a trailing slash so the joined URL never has a double slash.
  const base = publicUrl!.replace(/\/$/, '')

  return [
    s3Storage({
      collections: {
        media: {
          // Serve files straight from the R2 public domain, not through the
          // Payload static route (the S3 endpoint itself is private).
          disablePayloadAccessControl: true,
          generateFileURL: ({ filename, prefix }) =>
            prefix ? `${base}/${prefix}/${filename}` : `${base}/${filename}`,
        },
      },
      bucket: bucket!,
      config: {
        endpoint,
        region: 'auto',
        forcePathStyle: true,
        credentials: {
          accessKeyId: accessKeyId!,
          secretAccessKey: secretAccessKey!,
        },
      },
    }),
  ]
}
