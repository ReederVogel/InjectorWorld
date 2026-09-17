/**
 * organize-media-folders.ts — move the hand-placed editorial images out of the
 * flat `images/editorial/` folder and into one folder per article.
 *
 *   images/editorial/<name>  ->  news/<slug>/<kebab-name>
 *                            ->  guides/<slug>/<kebab-name>
 *
 * This is the one-off companion to the hooks in lib/media-folders.ts, which
 * already put every NEW admin upload in the right folder. It exists only for
 * the 14 rows that predate them. See docs/MEDIA-FOLDERS-PLAN-2026-09-18.md.
 *
 * It is deliberately NOT in package.json: every npm script in this repo is
 * hardcoded to --env-file=.env.local, and .env.local points at PRODUCTION.
 *
 * Usage (always pass --env-file explicitly, never `npm run`):
 *   npx tsx --env-file=.env.staging scripts/organize-media-folders.ts              # dry run
 *   npx tsx --env-file=.env.staging scripts/organize-media-folders.ts --apply
 *   npx tsx --env-file=.env.staging scripts/organize-media-folders.ts --delete-old
 *
 * Env it needs:
 *   DATABASE_URI          the environment being migrated
 *   R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_REGION
 *                         the Spaces bucket (the vars keep their R2_* names,
 *                         see lib/storage.ts). Only .env.local carries these
 *                         today, so whoever runs this supplies them.
 *   OTHER_DATABASE_URI    required by --delete-old only: the OTHER environment's
 *                         database, so the delete pass can prove both of them
 *                         have already moved off the old urls.
 *
 * THE ORDER MATTERS. Staging and production share one bucket and both databases
 * hold the same 14 urls, so deleting a source too early breaks the other
 * environment's live images:
 *
 *   1. dry run against staging
 *   2. --apply against staging, then look at the pages
 *   3. --apply against production
 *   4. only then, --delete-old once
 *
 * Safety properties, in case this is read before it is run:
 *   - The default path is a dry run. It performs reads only.
 *   - --apply copies, never moves: the source object is left in place, so a
 *     wrong url is a one-line fix rather than a lost file.
 *   - Every copy is verified with HeadObject before its database row changes.
 *   - --delete-old touches nothing outside images/editorial/. Clinic photos
 *     under images/publish/ are hard-excluded (HARD RULE 4).
 */

import pg from 'pg'
import {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getDbSsl, getDbConnectionString } from '../lib/db-ssl'
import { kebabFilename } from '../lib/media-folders'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const DELETE_OLD = args.includes('--delete-old')

/** Only keys under here are ever read as a source or deleted. */
const EDITORIAL_PREFIX = 'images/editorial/'
/** Clinic photos. Named here purely so the delete pass can refuse to touch it. */
const CLINIC_PREFIX = 'images/publish/'
/**
 * New urls are written against the CDN host, not the origin. The editorial
 * images already use it and the CDN is what visitors should hit.
 */
const CDN_BASE = 'https://iw-media.sfo3.cdn.digitaloceanspaces.com'

const TABLES = ['news', 'guides'] as const
type Table = (typeof TABLES)[number]

type Item = {
  table: Table
  id: number
  slug: string
  oldUrl: string
  oldKey: string
  newKey: string
  newUrl: string
  copied: string
  verified: string
  dbUpdated: string
}

const log = (msg = '') => console.log(msg ? `[media-folders] ${msg}` : '')

function hostOf(uri: string): string {
  try {
    return new URL(uri).host
  } catch {
    return 'unparseable'
  }
}

/** The object key inside the bucket for one of our public urls. */
function keyFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname.replace(/^\/+/, '')
    return path ? decodeURIComponent(path) : null
  } catch {
    return null
  }
}

/** CopySource wants "bucket/key" with each path segment percent-encoded. */
function copySource(bucket: string, key: string): string {
  return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`
}

function buildS3(): { client: S3Client; bucket: string } | null {
  const bucket = process.env.R2_BUCKET
  const endpoint = process.env.R2_ENDPOINT
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null
  return {
    bucket,
    // Same shape as lib/storage.ts so this script talks to the bucket exactly
    // the way the app does.
    client: new S3Client({
      endpoint,
      region: process.env.R2_REGION || 'auto',
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
  }
}

async function objectExists(client: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch {
    return false
  }
}

/** Every news/guides row still pointing at the flat editorial folder. */
async function collect(pool: pg.Pool): Promise<Item[]> {
  const items: Item[] = []

  for (const table of TABLES) {
    const { rows } = await pool.query<{ id: number; slug: string | null; cover_image_url: string }>(
      // table is one of two literals from TABLES, never user input.
      `SELECT id, slug, cover_image_url
         FROM ${table}
        WHERE cover_image_url LIKE '%/${EDITORIAL_PREFIX}%'
        ORDER BY id`,
    )

    for (const row of rows) {
      const oldKey = keyFromUrl(row.cover_image_url)
      const base = oldKey ? oldKey.split('/').pop() : null
      if (!oldKey || !base || !row.slug) {
        log(
          `SKIP ${table}#${row.id}: ${!row.slug ? 'row has no slug' : 'url has no usable key'} (${row.cover_image_url})`,
        )
        continue
      }
      const newKey = `${table}/${row.slug}/${kebabFilename(base)}`
      items.push({
        table,
        id: row.id,
        slug: row.slug,
        oldUrl: row.cover_image_url,
        oldKey,
        newKey,
        newUrl: `${CDN_BASE}/${newKey}`,
        copied: '-',
        verified: '-',
        dbUpdated: '-',
      })
    }
  }

  return items
}

/** Warns rather than refuses: two rows sharing a destination is worth seeing. */
function reportCollisions(items: Item[]) {
  const seen = new Map<string, Item[]>()
  for (const item of items) {
    const list = seen.get(item.newKey) ?? []
    list.push(item)
    seen.set(item.newKey, list)
  }
  for (const [key, list] of seen) {
    if (list.length > 1) {
      log(`WARNING: ${list.length} rows resolve to the same key ${key}: ${list.map((i) => `${i.table}#${i.id}`).join(', ')}`)
    }
  }
}

function printPlan(items: Item[]) {
  console.table(
    items.map((i) => ({
      row: `${i.table}#${i.id}`,
      oldKey: i.oldKey,
      newKey: i.newKey,
      copied: i.copied,
      verified: i.verified,
      dbUpdated: i.dbUpdated,
    })),
  )
}

async function copyPass(pool: pg.Pool) {
  const items = await collect(pool)
  log(`Found ${items.length} rows pointing at ${EDITORIAL_PREFIX}`)
  if (!items.length) {
    log('Nothing to do.')
    return
  }
  reportCollisions(items)

  const s3 = buildS3()

  if (!APPLY) {
    // ---- THIS IS THE GATE. Everything above is reads only; nothing below this
    // ---- block runs without --apply, so the default invocation writes nothing
    // ---- to the bucket and nothing to the database.
    if (s3) {
      for (const item of items) {
        item.copied = (await objectExists(s3.client, s3.bucket, item.oldKey)) ? 'source ok' : 'SOURCE MISSING'
        item.verified = (await objectExists(s3.client, s3.bucket, item.newKey)) ? 'dest exists' : 'dest absent'
      }
    } else {
      log('No R2_* credentials set, so the bucket was not contacted. Showing the database side only.')
    }
    printPlan(items)
    log('Dry run only. Nothing was copied, updated or deleted. Re-run with --apply to write.')
    return
  }

  if (!s3) {
    log('Cannot --apply without R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.')
    process.exit(1)
  }

  for (const item of items) {
    // Idempotent: a destination that already exists is left exactly as it is.
    if (await objectExists(s3.client, s3.bucket, item.newKey)) {
      item.copied = 'already there'
    } else {
      if (!(await objectExists(s3.client, s3.bucket, item.oldKey))) {
        item.copied = 'SOURCE MISSING'
        log(`SKIP ${item.table}#${item.id}: source ${item.oldKey} does not exist.`)
        continue
      }
      try {
        await s3.client.send(
          new CopyObjectCommand({
            Bucket: s3.bucket,
            CopySource: copySource(s3.bucket, item.oldKey),
            Key: item.newKey,
            // CopyObject does NOT inherit the source ACL, and these objects were
            // uploaded public-read. Without this the copy is private and the
            // image breaks on the page.
            ACL: 'public-read',
            MetadataDirective: 'COPY',
          }),
        )
        item.copied = 'copied'
      } catch (err) {
        item.copied = 'COPY FAILED'
        log(`ERROR copying ${item.oldKey} -> ${item.newKey}: ${(err as Error).message}`)
        continue
      }
    }

    // Verify before the database moves. A row pointing at a key that holds no
    // object is a silent 404 on a live page.
    if (!(await objectExists(s3.client, s3.bucket, item.newKey))) {
      item.verified = 'VERIFY FAILED'
      log(`ERROR: ${item.newKey} not readable after copy. Leaving ${item.table}#${item.id} alone.`)
      continue
    }
    item.verified = 'ok'

    const res = await pool.query(
      // table is one of two literals from TABLES. The url values are bound.
      `UPDATE ${item.table} SET cover_image_url = $1 WHERE id = $2 AND cover_image_url = $3`,
      [item.newUrl, item.id, item.oldUrl],
    )
    item.dbUpdated = res.rowCount === 1 ? 'updated' : `no-op (${res.rowCount} rows)`
  }

  printPlan(items)
  log('Copy pass done. Sources were NOT deleted. Run --apply on the other environment before --delete-old.')
}

async function deletePass(pool: pg.Pool) {
  const s3 = buildS3()
  if (!s3) {
    log('Cannot --delete-old without R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.')
    process.exit(1)
  }

  const otherUri = process.env.OTHER_DATABASE_URI
  if (!otherUri) {
    log('Refusing: --delete-old needs OTHER_DATABASE_URI (the other environment) to prove both databases moved.')
    log('Staging and production share this bucket, so deleting on the evidence of one database breaks the other.')
    process.exit(1)
  }

  const otherPool = new pg.Pool({ connectionString: otherUri, ssl: getDbSsl(), max: 2 })
  log(`Other database host: ${hostOf(otherUri)}`)

  try {
    // Guard 1: neither environment may still reference the old folder. This is
    // also the proof that --apply already ran in both of them, which is the
    // precondition for deleting anything at all.
    for (const [label, p] of [['this', pool], ['other', otherPool]] as const) {
      for (const table of TABLES) {
        const { rows } = await p.query<{ n: string }>(
          `SELECT count(*) AS n FROM ${table} WHERE cover_image_url LIKE '%/${EDITORIAL_PREFIX}%'`,
        )
        const n = Number(rows[0]?.n ?? 0)
        if (n > 0) {
          log(`Refusing: ${label} database still has ${n} ${table} rows on ${EDITORIAL_PREFIX}. Run --apply there first.`)
          process.exit(1)
        }
      }
    }
    log('Both databases are clear of the old folder.')

    // Guard 2: every new url both environments now point at must resolve to a
    // real object, or deleting the sources destroys the only copy.
    const newKeys = new Set<string>()
    for (const p of [pool, otherPool]) {
      for (const table of TABLES) {
        const { rows } = await p.query<{ cover_image_url: string }>(
          `SELECT cover_image_url FROM ${table}
            WHERE cover_image_url LIKE $1 OR cover_image_url LIKE $2`,
          [`${CDN_BASE}/news/%`, `${CDN_BASE}/guides/%`],
        )
        for (const row of rows) {
          const key = keyFromUrl(row.cover_image_url)
          if (key) newKeys.add(key)
        }
      }
    }
    const missing: string[] = []
    for (const key of newKeys) {
      if (!(await objectExists(s3.client, s3.bucket, key))) missing.push(key)
    }
    if (missing.length) {
      log(`Refusing: ${missing.length} destination objects are missing. Nothing is safe to delete yet.`)
      missing.forEach((k) => log(`  missing: ${k}`))
      process.exit(1)
    }
    log(`All ${newKeys.size} destination objects verified.`)

    // Now list the sources and delete them.
    const sources: string[] = []
    let token: string | undefined
    do {
      const res = await s3.client.send(
        new ListObjectsV2Command({ Bucket: s3.bucket, Prefix: EDITORIAL_PREFIX, ContinuationToken: token }),
      )
      for (const obj of res.Contents ?? []) {
        if (obj.Key) sources.push(obj.Key)
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (token)

    // Guard 3: belt and braces. Nothing outside the editorial folder is ever a
    // candidate, and clinic photos are named explicitly (HARD RULE 4).
    const unsafe = sources.filter((k) => !k.startsWith(EDITORIAL_PREFIX) || k.startsWith(CLINIC_PREFIX))
    if (unsafe.length) {
      log(`Refusing: the listing returned ${unsafe.length} keys outside ${EDITORIAL_PREFIX}. Aborting rather than guessing.`)
      process.exit(1)
    }

    log(`Deleting ${sources.length} objects under ${EDITORIAL_PREFIX}`)
    const results: { key: string; deleted: string }[] = []
    for (const key of sources) {
      try {
        await s3.client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key }))
        results.push({ key, deleted: 'deleted' })
      } catch (err) {
        results.push({ key, deleted: `FAILED: ${(err as Error).message}` })
      }
    }
    console.table(results)
    log('Delete pass done.')
  } finally {
    await otherPool.end()
  }
}

async function run() {
  const connectionString = getDbConnectionString()
  if (!connectionString) {
    log('No DATABASE_URI. Pass --env-file=.env.staging')
    process.exit(1)
  }

  // Show which database this is about to touch before doing anything. The
  // .env.local / .env.staging mixup is the expensive mistake here.
  log(`Database host: ${hostOf(connectionString)}`)
  log(`Bucket: ${process.env.R2_BUCKET || '(no R2_BUCKET set)'}`)
  log(`Mode: ${DELETE_OLD ? 'DELETE OLD' : APPLY ? 'APPLY' : 'DRY RUN'}`)
  log()

  const pool = new pg.Pool({ connectionString, ssl: getDbSsl(), max: 2 })

  try {
    // Fail loudly and early if the schema is not what this script expects.
    const { rows: cols } = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
          AND column_name IN ('slug', 'cover_image_url')`,
      [TABLES as unknown as string[]],
    )
    for (const table of TABLES) {
      for (const column of ['slug', 'cover_image_url']) {
        if (!cols.some((c) => c.table_name === table && c.column_name === column)) {
          log(`Schema check failed: ${table}.${column} does not exist. Wrong database?`)
          process.exit(1)
        }
      }
    }

    if (DELETE_OLD) {
      await deletePass(pool)
    } else {
      await copyPass(pool)
    }
  } finally {
    await pool.end()
  }
}

run().catch((err) => {
  console.error('[media-folders] Fatal:', err)
  process.exit(1)
})
