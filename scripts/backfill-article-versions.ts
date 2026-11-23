/**
 * Give every Guide and News article that has no version yet one starting
 * version: a copy of the article exactly as it is now.
 *
 * Why: version history (`versions` on collections/Guides.ts and News.ts)
 * saves a copy on every save, but that copy is the NEW state. Without a
 * starting copy, the first edit made after the feature ships has nothing to
 * go back to in the Versions tab.
 *
 * What it writes: rows in _guides_v / _guides_v_rels / _news_v only, through
 * Payload's db adapter. No hooks run, the articles themselves are not touched
 * (updatedAt, contentUpdatedAt and the page caches stay as they are). Each
 * starting version carries the article's own updatedAt as its date.
 * Idempotent: an article that already has any version is skipped.
 *
 * Deliberately not an npm script (every npm script here is wired to
 * .env.local, which is PRODUCTION). Dry run first, then apply with the
 * database name or host fragment you expect, which must match:
 *
 *   npx tsx --env-file=.env.staging scripts/backfill-article-versions.ts
 *   npx tsx --env-file=.env.staging scripts/backfill-article-versions.ts --apply --expect-db=<host fragment>
 */
export {}

const APPLY = process.argv.includes('--apply')
const EXPECT = process.argv.find((a) => a.startsWith('--expect-db='))?.slice('--expect-db='.length) ?? ''
const COLLECTIONS = ['guides', 'news'] as const

async function main() {
  const uri = process.env.DATABASE_URI ?? ''
  if (!uri) throw new Error('DATABASE_URI is not set (pass --env-file=...)')
  const target = uri.replace(/^[^@]*@/, '').replace(/\?.*$/, '') // host:port/db, no credentials
  console.log(`[versions-backfill] ${APPLY ? 'APPLY' : 'dry run'} on ${target}`)
  if (APPLY && (!EXPECT || !target.includes(EXPECT))) {
    throw new Error(`--apply needs --expect-db=<part of "${target}"> so a wrong env file cannot write`)
  }

  // A long one-off script: keep the pool small (see project memory on pool size).
  process.env.DB_POOL_MAX ||= '3'
  const { getPayload } = await import('payload')
  const { default: config } = await import('../payload.config')
  const payload = await getPayload({ config })

  for (const slug of COLLECTIONS) {
    let page = 1
    let total = 0
    let created = 0
    let skipped = 0
    for (;;) {
      const res = await payload.find({
        collection: slug,
        depth: 0,
        limit: 50,
        page,
        sort: 'id',
        overrideAccess: true,
        showHiddenFields: true,
      })
      for (const doc of res.docs as any[]) {
        total++
        const { totalDocs } = await payload.countVersions({
          collection: slug,
          where: { parent: { equals: doc.id } },
          overrideAccess: true,
        })
        if (totalDocs > 0) {
          skipped++
          continue
        }
        if (APPLY) {
          await payload.db.createVersion({
            autosave: false,
            collectionSlug: slug,
            createdAt: doc.updatedAt,
            parent: doc.id,
            returning: false,
            updatedAt: doc.updatedAt,
            versionData: doc,
          } as any)
        }
        created++
      }
      if (!res.hasNextPage) break
      page++
    }
    console.log(
      `[versions-backfill] ${slug}: ${total} articles, ${created} ${APPLY ? 'starting versions created' : 'would get a starting version'}, ${skipped} already had versions`,
    )
  }
  process.exit(0)
}

main().catch((err) => {
  // Drizzle errors carry every query parameter (whole article bodies): print the cause only.
  const cause = err?.cause ?? err
  console.error('[versions-backfill] failed:', cause?.message ?? String(err))
  if (cause?.detail) console.error('[versions-backfill] detail:', cause.detail)
  process.exit(1)
})
