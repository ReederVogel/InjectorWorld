/**
 * The Content screen's data layer.
 *
 * ── Why this joins instead of denormalising ─────────────────────────────────
 *
 * The screen needs a document's name, dates, import batch and readiness signals
 * alongside its indexing decision. The decision lives in `page_index`; everything
 * else lives in `clinics` / `guides` / `news`. The alternative was to have the
 * scan copy those fields onto `page_index`, which reads faster but goes stale
 * between scans: link a service to a clinic today and the screen would still say
 * "no services" until the next scan, and an operator would index on a stale
 * signal. Correctness wins here, so readiness is computed live in SQL.
 *
 * ── Why the query is driven FROM the content table ──────────────────────────
 *
 * Measured on staging, 39,639 clinic rows. Driving from `page_index` and joining
 * to `clinics` sorts the whole set before LIMIT and takes ~2.5s for a name sort.
 * Driving from `clinics` and looking `page_index` up lets the clinics indexes do
 * the work: the same query is ~310ms, roughly 8x faster.
 *
 * It also makes a real problem visible. A LEFT JOIN surfaces documents with NO
 * registry row at all (135 clinics today, whose city/state matches no Location so
 * no url could be built). Those are invisible to a page_index-driven query, and
 * they are exactly the ones worth knowing about.
 *
 * ── Readiness ───────────────────────────────────────────────────────────────
 *
 * Five signals per type, all computed as booleans. EXISTS rather than COUNT for
 * the relationship checks: it short-circuits on the first match and uses
 * clinics_rels_parent_idx, where aggregating the whole 442k-row table would not.
 */

export type ContentTab = 'clinics' | 'guides' | 'news'

export type ContentFilters = {
  importBatch?: string
  state?: string
  city?: string
  status?: string
  /** indexed | queued | excluded | unregistered */
  submitted?: string
  /** ready | no-services | no-photos | no-description | type-other | no-cover | no-reviewer */
  problem?: string
  q?: string
}

export type SortKey = 'name' | 'uploaded' | 'published' | 'updated' | 'reviews'

const SORTS: Record<ContentTab, Record<SortKey, string>> = {
  clinics: {
    name: 'c.clinic_name ASC, c.id ASC',
    uploaded: 'c.created_at DESC, c.id ASC',
    published: 'c.published_at DESC NULLS LAST, c.id ASC',
    updated: 'c.updated_at DESC, c.id ASC',
    reviews: 'c.aggregate_rating_count DESC NULLS LAST, c.id ASC',
  },
  guides: {
    name: 'c.title ASC, c.id ASC',
    uploaded: 'c.created_at DESC, c.id ASC',
    published: 'c.published_at DESC NULLS LAST, c.id ASC',
    updated: 'c.updated_at DESC, c.id ASC',
    reviews: 'c.updated_at DESC, c.id ASC',
  },
  news: {
    name: 'c.title ASC, c.id ASC',
    uploaded: 'c.created_at DESC, c.id ASC',
    published: 'c.published_at DESC NULLS LAST, c.id ASC',
    updated: 'c.updated_at DESC, c.id ASC',
    reviews: 'c.updated_at DESC, c.id ASC',
  },
}

/** Readiness signal labels, in the order the booleans are returned. */
export const READINESS_LABELS: Record<ContentTab, string[]> = {
  clinics: ['Description', 'Photos', 'Services linked', 'Contact details', 'Real clinic type'],
  guides: ['Meta title', 'Meta description', 'Cover image', 'Author', 'Medical reviewer'],
  news: ['Meta title', 'Meta description', 'Cover image', 'Author', 'Medical reviewer'],
}

const TABLE: Record<ContentTab, string> = { clinics: 'clinics', guides: 'guides', news: 'news' }

/** The five readiness booleans, aliased r1..r5 so the client can zip them to labels. */
function readinessSelect(tab: ContentTab): string {
  if (tab === 'clinics') {
    return `
      (c.description IS NOT NULL AND c.description <> '')                                   AS r1,
      EXISTS (SELECT 1 FROM clinics_clinic_photo_urls p WHERE p._parent_id = c.id)          AS r2,
      EXISTS (SELECT 1 FROM clinics_rels r
               WHERE r.parent_id = c.id AND r.services_id IS NOT NULL)                      AS r3,
      ((c.phone IS NOT NULL AND c.phone <> '')
        OR (c.website_url IS NOT NULL AND c.website_url <> ''))                              AS r4,
      (c.clinic_type::text <> 'other')                                                       AS r5`
  }
  return `
      (c.meta_title IS NOT NULL AND c.meta_title <> '')                                      AS r1,
      (c.meta_description IS NOT NULL AND c.meta_description <> '')                           AS r2,
      (c.meta_image_id IS NOT NULL OR (c.cover_image_url IS NOT NULL AND c.cover_image_url <> '')) AS r3,
      (c.author_id IS NOT NULL)                                                               AS r4,
      (c.medical_reviewer_id IS NOT NULL)                                                     AS r5`
}

function identitySelect(tab: ContentTab): string {
  if (tab === 'clinics') {
    return `
      c.clinic_name                       AS "name",
      c.city, c.state,
      c.clinic_type::text                 AS "subType",
      c.aggregate_rating_count            AS "reviewCount"`
  }
  return `
      c.title                             AS "name",
      NULL::text                          AS city,
      NULL::text                          AS state,
      ${tab === 'news' ? 'c.category::text' : "'guide'::text"} AS "subType",
      NULL::int                           AS "reviewCount"`
}

/**
 * Builds the shared FROM + WHERE. Everything the caller supplies is a bound
 * parameter; nothing from the request is ever concatenated into SQL.
 */
function buildWhere(tab: ContentTab, f: ContentFilters, params: any[]): string {
  const clauses: string[] = []

  if (f.importBatch) { params.push(f.importBatch); clauses.push(`c.import_batch = $${params.length}`) }
  if (f.status) { params.push(f.status); clauses.push(`c.status::text = $${params.length}`) }

  if (tab === 'clinics') {
    if (f.state) { params.push(f.state); clauses.push(`c.state = $${params.length}`) }
    if (f.city) { params.push(f.city); clauses.push(`c.city = $${params.length}`) }
  }

  if (f.q) {
    params.push(`%${f.q}%`)
    clauses.push(tab === 'clinics' ? `c.clinic_name ILIKE $${params.length}` : `c.title ILIKE $${params.length}`)
  }

  switch (f.submitted) {
    case 'indexed': clauses.push(`pi.indexed = true`); break
    case 'queued': clauses.push(`pi.index_mode::text = 'queued'`); break
    case 'excluded': clauses.push(`pi.index_mode::text = 'excluded'`); break
    // No registry row: the scan could not build a url for this document.
    case 'unregistered': clauses.push(`pi.id IS NULL`); break
  }

  if (tab === 'clinics') {
    switch (f.problem) {
      case 'ready':
        clauses.push(
          `c.clinic_type::text <> 'other'`,
          `c.description IS NOT NULL AND c.description <> ''`,
          `EXISTS (SELECT 1 FROM clinics_rels r WHERE r.parent_id = c.id AND r.services_id IS NOT NULL)`,
        )
        break
      case 'no-services':
        clauses.push(`NOT EXISTS (SELECT 1 FROM clinics_rels r WHERE r.parent_id = c.id AND r.services_id IS NOT NULL)`)
        break
      case 'no-photos':
        clauses.push(`NOT EXISTS (SELECT 1 FROM clinics_clinic_photo_urls p WHERE p._parent_id = c.id)`)
        break
      case 'no-description':
        clauses.push(`(c.description IS NULL OR c.description = '')`)
        break
      case 'type-other':
        clauses.push(`c.clinic_type::text = 'other'`)
        break
    }
  } else {
    switch (f.problem) {
      case 'ready':
        clauses.push(
          `(c.meta_title IS NOT NULL AND c.meta_title <> '')`,
          `(c.meta_image_id IS NOT NULL OR (c.cover_image_url IS NOT NULL AND c.cover_image_url <> ''))`,
        )
        break
      case 'no-cover':
        clauses.push(`c.meta_image_id IS NULL AND (c.cover_image_url IS NULL OR c.cover_image_url = '')`)
        break
      case 'no-reviewer':
        clauses.push(`c.medical_reviewer_id IS NULL`)
        break
      case 'no-description':
        clauses.push(`(c.meta_description IS NULL OR c.meta_description = '')`)
        break
    }
  }

  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
}

function fromClause(tab: ContentTab, params: any[]): string {
  params.push(TABLE[tab])
  return `FROM ${TABLE[tab]} c
          LEFT JOIN page_index pi
            ON pi.source_collection = $${params.length}
           AND pi.source_id = c.id::text`
}

export type ContentRow = {
  rowId: number | null
  sourceId: number
  name: string
  city: string | null
  state: string | null
  subType: string | null
  reviewCount: number | null
  path: string | null
  slug: string
  status: string
  indexMode: string | null
  indexed: boolean
  publishable: boolean
  indexedAt: string | null
  batchLabel: string | null
  uploadedAt: string | null
  publishedAt: string | null
  updatedAt: string | null
  importBatch: string | null
  readiness: boolean[]
}

export async function fetchContentPage(
  pool: any,
  tab: ContentTab,
  filters: ContentFilters,
  sort: SortKey,
  page: number,
  limit: number,
): Promise<{ rows: ContentRow[]; total: number }> {
  // Separate param arrays: the two statements bind different trailing values.
  const listParams: any[] = []
  const listFrom = fromClause(tab, listParams)
  const listWhere = buildWhere(tab, filters, listParams)

  const countParams: any[] = []
  const countFrom = fromClause(tab, countParams)
  const countWhere = buildWhere(tab, filters, countParams)

  listParams.push(limit, Math.max(0, (page - 1) * limit))

  const listSql = `
    SELECT
      pi.id                       AS "rowId",
      c.id                        AS "sourceId",
      ${identitySelect(tab)},
      c.slug,
      c.status::text              AS status,
      pi.path,
      pi.index_mode::text         AS "indexMode",
      COALESCE(pi.indexed, false) AS indexed,
      COALESCE(pi.publishable, false) AS publishable,
      pi.indexed_at               AS "indexedAt",
      pi.batch_label              AS "batchLabel",
      c.created_at                AS "uploadedAt",
      c.published_at              AS "publishedAt",
      c.updated_at                AS "updatedAt",
      c.import_batch              AS "importBatch",
      ${readinessSelect(tab)}
    ${listFrom}
    ${listWhere}
    ORDER BY ${SORTS[tab][sort] ?? SORTS[tab].name}
    LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`

  const [listRes, countRes] = await Promise.all([
    pool.query(listSql, listParams),
    pool.query(`SELECT count(*)::int AS n ${countFrom} ${countWhere}`, countParams),
  ])

  return {
    total: countRes.rows[0]?.n ?? 0,
    rows: (listRes.rows as any[]).map((r) => ({
      rowId: r.rowId ?? null,
      sourceId: Number(r.sourceId),
      name: r.name,
      city: r.city ?? null,
      state: r.state ?? null,
      subType: r.subType ?? null,
      reviewCount: r.reviewCount == null ? null : Number(r.reviewCount),
      path: r.path ?? null,
      slug: r.slug,
      status: r.status,
      indexMode: r.indexMode ?? null,
      indexed: r.indexed === true,
      publishable: r.publishable === true,
      indexedAt: r.indexedAt ?? null,
      batchLabel: r.batchLabel ?? null,
      uploadedAt: r.uploadedAt ?? null,
      publishedAt: r.publishedAt ?? null,
      updatedAt: r.updatedAt ?? null,
      importBatch: r.importBatch ?? null,
      readiness: [r.r1, r.r2, r.r3, r.r4, r.r5].map(Boolean),
    })),
  }
}

/** Per-tab headline counts, for the chips above the table. */
export async function fetchContentSummary(pool: any, tab: ContentTab) {
  const params: any[] = []
  const from = fromClause(tab, params)
  const readyClause =
    tab === 'clinics'
      ? `c.clinic_type::text <> 'other' AND c.description IS NOT NULL AND c.description <> ''
         AND EXISTS (SELECT 1 FROM clinics_rels r WHERE r.parent_id = c.id AND r.services_id IS NOT NULL)`
      : `(c.meta_title IS NOT NULL AND c.meta_title <> '')
         AND (c.meta_image_id IS NOT NULL OR (c.cover_image_url IS NOT NULL AND c.cover_image_url <> ''))`

  const { rows } = await pool.query(
    `SELECT count(*)::int                                              AS total,
            count(*) FILTER (WHERE pi.indexed)::int                     AS submitted,
            count(*) FILTER (WHERE pi.index_mode::text = 'queued')::int AS queued,
            count(*) FILTER (WHERE pi.index_mode::text = 'excluded')::int AS excluded,
            count(*) FILTER (WHERE pi.id IS NULL)::int                  AS unregistered,
            count(*) FILTER (WHERE ${readyClause})::int                 AS ready
       ${from}`,
    params,
  )
  return rows[0] ?? {}
}

/** Filter dropdown options, with counts so empty choices are obvious. */
export async function fetchContentFacets(pool: any, tab: ContentTab) {
  const batchParams: any[] = []
  const batchFrom = fromClause(tab, batchParams)

  const queries: Promise<any>[] = [
    pool.query(
      `SELECT c.import_batch AS v, count(*)::int AS n ${batchFrom}
        WHERE c.import_batch IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 40`,
      batchParams,
    ),
  ]

  if (tab === 'clinics') {
    queries.push(
      pool.query(
        `SELECT state AS v, count(*)::int AS n FROM clinics
          WHERE state IS NOT NULL AND state <> '' GROUP BY 1 ORDER BY 1`,
      ),
    )
  }

  const [batches, states] = await Promise.all(queries)
  return {
    importBatches: batches.rows.map((r: any) => ({ value: r.v, count: r.n })),
    states: states ? states.rows.map((r: any) => ({ value: r.v, count: r.n })) : [],
  }
}

// ─── Row detail (the drawer) ─────────────────────────────────────────────────

/**
 * Mirrors formatClinicType() in the clinic page. Kept in step deliberately: the
 * drawer's job is to show what the page ACTUALLY emits, so a divergence here
 * would make the drawer lie in a way that is very hard to notice.
 */
function formatClinicType(type?: string | null): string {
  const labels: Record<string, string> = {
    medspa: 'med spa',
    dermatology: 'dermatology clinic',
    'plastic-surgery': 'plastic surgery clinic',
    'dental-aesthetics': 'dental aesthetics clinic',
    other: 'aesthetic clinic',
  }
  return type ? labels[type] ?? 'aesthetic clinic' : 'aesthetic clinic'
}

/** Mirrors truncate() in the clinic page. */
function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trim()}...`
}

export type ContentDetail = {
  sourceId: number
  name: string
  path: string | null
  status: string
  indexMode: string | null
  indexed: boolean
  publishable: boolean
  indexedAt: string | null
  batchLabel: string | null
  uploadedAt: string | null
  publishedAt: string | null
  updatedAt: string | null
  importBatch: string | null
  readiness: boolean[]
  metaTitle: string
  metaDescription: string
  /** Whether meta is stored on the doc or generated per request. */
  metaSource: 'stored' | 'generated'
  schema: string
  sitemapChild: string
  robotsNow: string
  adminUrl: string
}

const SCHEMA_BY_TAB: Record<ContentTab, string> = {
  clinics: 'MedicalBusiness + LocalBusiness + OpeningHours',
  guides: 'MedicalWebPage + Article + FAQPage',
  news: 'Article',
}

const SITEMAP_BY_TAB: Record<ContentTab, string> = {
  clinics: 'clinics',
  guides: 'guides',
  news: 'news',
}

export async function fetchContentDetail(
  pool: any,
  tab: ContentTab,
  sourceId: number,
): Promise<ContentDetail | null> {
  const params: any[] = []
  const from = fromClause(tab, params)
  params.push(sourceId)

  const sql = `
    SELECT
      c.id AS "sourceId", c.slug, c.status::text AS status,
      ${identitySelect(tab)},
      ${tab === 'clinics'
        ? `c.description, NULL::text AS meta_title, NULL::text AS meta_description`
        : `NULL::text AS description, c.meta_title, c.meta_description`},
      pi.path, pi.index_mode::text AS "indexMode",
      COALESCE(pi.indexed, false) AS indexed,
      COALESCE(pi.publishable, false) AS publishable,
      pi.indexed_at AS "indexedAt", pi.batch_label AS "batchLabel",
      c.created_at AS "uploadedAt", c.published_at AS "publishedAt",
      c.updated_at AS "updatedAt", c.import_batch AS "importBatch",
      ${readinessSelect(tab)}
    ${from}
    WHERE c.id = $${params.length}
    LIMIT 1`

  const { rows } = await pool.query(sql, params)
  const r = rows[0]
  if (!r) return null

  // Clinic meta is not stored anywhere: the page builds it per request from the
  // name, city, state and description. Reproduce the same strings rather than
  // showing an empty field that would read as "no meta configured".
  let metaTitle: string
  let metaDescription: string
  let metaSource: 'stored' | 'generated'

  if (tab === 'clinics') {
    metaSource = 'generated'
    metaTitle = `${r.name} - ${r.city}, ${r.state}`
    metaDescription = r.description
      ? truncate(String(r.description), 155)
      : `${r.name} is a ${formatClinicType(r.subType)} in ${r.city}, ${r.state} with ${Number(r.reviewCount) || 0} patient reviews.`
  } else {
    metaSource = 'stored'
    metaTitle = r.meta_title || r.name
    metaDescription = r.meta_description || ''
  }

  return {
    sourceId: Number(r.sourceId),
    name: r.name,
    path: r.path ?? null,
    status: r.status,
    indexMode: r.indexMode ?? null,
    indexed: r.indexed === true,
    publishable: r.publishable === true,
    indexedAt: r.indexedAt ?? null,
    batchLabel: r.batchLabel ?? null,
    uploadedAt: r.uploadedAt ?? null,
    publishedAt: r.publishedAt ?? null,
    updatedAt: r.updatedAt ?? null,
    importBatch: r.importBatch ?? null,
    readiness: [r.r1, r.r2, r.r3, r.r4, r.r5].map(Boolean),
    metaTitle,
    metaDescription,
    metaSource,
    schema: SCHEMA_BY_TAB[tab],
    sitemapChild: SITEMAP_BY_TAB[tab],
    // Matches getEntityRobots(): indexed rows emit nothing (default index),
    // everything else emits noindex,follow so internal links stay crawlable.
    robotsNow: r.indexed === true ? 'index, follow' : 'noindex, follow',
    adminUrl: `/admin/collections/${TABLE[tab]}/${r.sourceId}`,
  }
}

// ─── Site pages ──────────────────────────────────────────────────────────────

/**
 * The hand-written routes (`/`, `/about`, `/how-we-verify`, the auth surfaces).
 * Only ~39 of them, so there is no paging, no filtering and no bulk tool: it is a
 * checklist.
 *
 * They live on the Content screen rather than with the auto-generated pages
 * because somebody wrote them, which is the line that separates the two screens.
 *
 * The `note` and the never-indexable flag come from lib/page-index/static-pages.ts,
 * the same list the scan and the sitemap read, so the reason a page is held back
 * is shown rather than being folklore.
 */

export type SitePageRow = {
  rowId: number | null
  path: string
  name: string
  indexMode: string | null
  indexed: boolean
  publishable: boolean
  indexedAt: string | null
  /** false when the route is pinned never-indexable in static-pages.ts. */
  indexable: boolean
  note?: string
}

/** '/how-we-verify' -> 'How we verify'. '/' -> 'Homepage'. */
function humanisePath(path: string): string {
  if (path === '/') return 'Homepage'
  const words = path.replace(/^\//, '').replace(/\//g, ' ').replace(/-/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export async function fetchSitePages(
  pool: any,
  staticPages: { path: string; indexable: boolean; note?: string }[],
): Promise<SitePageRow[]> {
  const { rows } = await pool.query(
    `SELECT id, path, index_mode::text AS "indexMode", indexed, publishable, indexed_at AS "indexedAt"
       FROM page_index
      WHERE page_type::text = 'static'`,
  )
  const byPath = new Map<string, any>(rows.map((r: any) => [r.path, r]))

  return staticPages.map((sp) => {
    const r = byPath.get(sp.path)
    return {
      rowId: r?.id ?? null,
      path: sp.path,
      name: humanisePath(sp.path),
      indexMode: r?.indexMode ?? null,
      indexed: r?.indexed === true,
      publishable: r?.publishable === true,
      indexedAt: r?.indexedAt ?? null,
      indexable: sp.indexable,
      note: sp.note,
    }
  })
}
