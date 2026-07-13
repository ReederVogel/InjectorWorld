import type { Payload } from 'payload'

// Self-contained News/Guides bulk-upload logic (JSON, Payload local API). Deliberately
// does not share code with lib/import/admin-bulk-upload.ts (the CSV pipeline that still
// powers Clinics/Reviews) -- this pipeline was rebuilt as its own isolated module so a
// bug here can never affect Clinics/Reviews, and vice versa. Field coverage matches the
// old CSV importer's capability exactly (title, slug, excerpt/lede, cover image, body,
// category, author, featured) -- richer fields like medical reviewer, related service,
// at-a-glance facts, and sources were never bulk-importable and stay manual-only.

export type ContentCollection = 'news' | 'guides'

export type ContentUploadItem = { id: number; slug: string; title: string; status: 'created' | 'updated' }
export type ContentUploadError = { index: number; slug?: string; reason: string }
export type ContentUploadReport = {
  collection: ContentCollection
  batch: string
  total: number
  created: number
  updated: number
  failed: number
  errors: ContentUploadError[]
  items: ContentUploadItem[]
}

const NEWS_CATEGORIES = new Set([
  'treatment-update',
  'industry',
  'company',
  'announcement',
  'product-launch',
  'research',
  'regulation',
])

const GUIDE_CATEGORIES = new Set(['treatment-guide', 'article', 'expert-qa', 'cost-report'])

const EDITORIAL_AUTHOR_NAME = 'injector.world Editorial Team'
const EDITORIAL_AUTHOR_SLUG = 'injectors-world-editorial-team'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

function lexicalBody(value: unknown): unknown {
  const paragraphs = Array.isArray(value)
    ? value.map((v) => String(v ?? '').trim()).filter(Boolean)
    : String(value ?? '').trim() ? [String(value).trim()] : []

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children: paragraphs.length > 0
        ? paragraphs.map((p) => ({
            type: 'paragraph',
            format: '',
            indent: 0,
            version: 1,
            children: [{ type: 'text', format: 0, mode: 'normal', style: '', text: p, version: 1 }],
          }))
        : [{ type: 'paragraph', format: '', indent: 0, version: 1, children: [] }],
    },
  }
}

async function resolveAuthorId(payload: Payload, fullName: string | undefined): Promise<number> {
  if (fullName) {
    const res: any = await payload.find({
      collection: 'authors',
      where: { fullName: { equals: fullName } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const match = res.docs[0]
    if (match) return Number(match.id)
  }

  const editorial: any = await payload.find({
    collection: 'authors',
    where: { slug: { equals: EDITORIAL_AUTHOR_SLUG } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (editorial.docs[0]) return Number(editorial.docs[0].id)

  const created: any = await payload.create({
    collection: 'authors',
    data: { fullName: EDITORIAL_AUTHOR_NAME, slug: EDITORIAL_AUTHOR_SLUG, role: 'Editorial Team', bio: 'The injector.world editorial team.' },
    overrideAccess: true,
  } as any)
  return Number(created.id)
}

export function makeContentBatch(collection: ContentCollection): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const rand = Math.random().toString(36).slice(2, 8)
  return `${collection}-upload-${stamp}-${rand}`
}

export async function stageContentUpload(
  payload: Payload,
  collection: ContentCollection,
  input: unknown,
  opts: { batch?: string } = {},
): Promise<ContentUploadReport> {
  const batch = opts.batch?.trim() || makeContentBatch(collection)
  const list = Array.isArray(input) ? input : (input as any)?.[collection]
  if (!Array.isArray(list)) {
    throw new Error(`Expected a JSON array of ${collection} (or an object with a "${collection}" array).`)
  }

  const categorySet = collection === 'news' ? NEWS_CATEGORIES : GUIDE_CATEGORIES
  const excerptMaxLen = collection === 'news' ? 298 : 198

  const report: ContentUploadReport = { collection, batch, total: list.length, created: 0, updated: 0, failed: 0, errors: [], items: [] }

  for (let i = 0; i < list.length; i++) {
    const raw = list[i]
    const rawSlug = raw && typeof raw === 'object' ? (raw as any).slug : undefined
    try {
      if (!raw || typeof raw !== 'object') throw new Error('Row is not an object.')

      const title = String((raw as any).title ?? '').trim()
      if (!title) throw new Error('Missing title.')
      const slug = String(rawSlug ?? '').trim() || slugify(title)
      if (!slug) throw new Error('Could not derive a slug from the title.')

      const categoryRaw = String((raw as any).category ?? '').trim()
      if (!categorySet.has(categoryRaw)) {
        throw new Error(`category must be one of: ${[...categorySet].join(', ')}.`)
      }

      const authorName = (raw as any).authorName ? String((raw as any).authorName).trim() : undefined
      const authorId = await resolveAuthorId(payload, authorName)

      const excerpt = (raw as any).excerpt ? String((raw as any).excerpt).trim() : title.slice(0, excerptMaxLen)
      const body = lexicalBody((raw as any).body)
      const coverImageUrl = (raw as any).coverImageUrl ? String((raw as any).coverImageUrl).trim() : undefined
      const featured = Boolean((raw as any).featured)

      const data: Record<string, any> = {
        title,
        slug,
        excerpt,
        coverImageUrl,
        body,
        category: categoryRaw,
        author: authorId,
        featured,
        status: 'draft',
        reviewStatus: 'imported',
        indexState: 'noindex',
        nofollow: true,
        importBatch: batch,
      }
      if (collection === 'guides') {
        data.lede = (raw as any).lede ? String((raw as any).lede).trim() : excerpt || title
      }

      const existing: any = await payload.find({
        collection,
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const match = existing.docs[0]

      if (match) {
        const updated: any = await payload.update({ collection, id: match.id, data, overrideAccess: true } as any)
        report.updated++
        report.items.push({ id: Number(updated.id), slug, title, status: 'updated' })
      } else {
        const created: any = await payload.create({ collection, data, overrideAccess: true } as any)
        report.created++
        report.items.push({ id: Number(created.id), slug, title, status: 'created' })
      }
    } catch (err: any) {
      report.failed++
      report.errors.push({
        index: i,
        slug: typeof rawSlug === 'string' ? rawSlug : undefined,
        reason: err?.message ?? 'Unknown error.',
      })
    }
  }

  return report
}

export async function approveContentUpload(
  payload: Payload,
  collection: ContentCollection,
  opts: { batch?: string; ids?: number[]; actorUserId?: number },
): Promise<{ approved: number }> {
  const { batch, ids, actorUserId } = opts
  if (!batch && (!ids || ids.length === 0)) {
    throw new Error('Provide batch or ids.')
  }

  const now = new Date().toISOString()

  const approveOne = async (doc: any) => {
    await payload.update({
      collection,
      id: doc.id,
      data: {
        status: 'published',
        reviewStatus: 'approved',
        publishedAt: doc.publishedAt ?? now,
        approvedAt: doc.approvedAt ?? now,
        approvedBy: actorUserId,
      },
      overrideAccess: true,
    } as any)
  }

  if (ids && ids.length > 0) {
    let approved = 0
    for (const id of ids) {
      const doc: any = await payload.findByID({ collection, id, depth: 0, overrideAccess: true } as any)
      if (!doc) continue
      await approveOne(doc)
      approved++
    }
    return { approved }
  }

  const res: any = await payload.find({
    collection,
    where: { and: [{ importBatch: { equals: batch } }, { reviewStatus: { equals: 'imported' } }] },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  for (const doc of res.docs as any[]) {
    await approveOne(doc)
  }
  return { approved: res.docs.length }
}
