/**
 * What each admin export contains, and how its rows are fetched.
 *
 * Every collection here is exported the same way: `countSql` gives the progress
 * denominator, then `pageSql` is called repeatedly with a keyset cursor until it
 * returns nothing. Keyset (`id > $lastId ORDER BY id`) rather than OFFSET, because
 * OFFSET degrades badly by the 37,000th clinic row.
 *
 * `hydrate` exists for the clinics export only: services and brands live in
 * `clinics_rels`, and pulling them with a correlated subquery per row would be
 * ~37,000 extra round trips. Instead each batch does ONE grouped query per
 * relation and joins in memory. Same lesson as the clinics import pipeline.
 */

export type ExportFilters = {
  state?: string
  city?: string
  brandSlug?: string
  serviceSlug?: string
}

export type ExportColumn = { header: string; key: string; width?: number }

export type ExportDefinition = {
  label: string
  /** Sheet name inside the workbook. */
  sheet: string
  columns: ExportColumn[]
  /** Whether state/city/brand/service filters apply to this collection at all. */
  supportsFilters: boolean
  buildCount: (f: ExportFilters) => { text: string; values: unknown[] }
  buildPage: (f: ExportFilters, lastId: number, limit: number) => { text: string; values: unknown[] }
  hydrate?: (pool: any, rows: any[]) => Promise<void>
  mapRow: (row: any, siteUrl: string) => Record<string, unknown>
}

/**
 * Filters only ever apply to clinics. Guides/News/FAQs/Brands/Services have no
 * state or city, so their definitions set supportsFilters:false and the API
 * rejects filters on them rather than silently ignoring them.
 */
function clinicWhere(f: ExportFilters, values: unknown[]): string {
  const parts = [`c.status = 'published'`]
  if (f.state) {
    values.push(f.state)
    parts.push(`c.state = $${values.length}`)
  }
  if (f.city) {
    values.push(f.city)
    parts.push(`LOWER(c.city) = LOWER($${values.length})`)
  }
  if (f.brandSlug) {
    values.push(f.brandSlug)
    parts.push(`EXISTS (SELECT 1 FROM clinics_rels r JOIN brands b ON b.id = r.brands_id
                        WHERE r.parent_id = c.id AND r.path = 'brandsOffered' AND b.slug = $${values.length})`)
  }
  if (f.serviceSlug) {
    values.push(f.serviceSlug)
    parts.push(`EXISTS (SELECT 1 FROM clinics_rels r JOIN services s ON s.id = r.services_id
                        WHERE r.parent_id = c.id AND r.path = 'servicesOffered' AND s.slug = $${values.length})`)
  }
  return parts.join(' AND ')
}

const CLINIC_SELECT = `
  c.id, c.clinic_id, c.updated_at, c.clinic_name, c.clinic_type,
  c.phone, c.email, c.booking_url, c.website_url,
  c.address_line1, c.city, c.state, c.zip,
  c.google_maps_url, c.google_place_id,
  c.aggregate_rating, c.aggregate_rating_count,
  c.facebook_url, c.instagram_url, c.tiktok_url,
  u.email AS owner_email
`

export const EXPORT_DEFINITIONS: Record<string, ExportDefinition> = {
  clinics: {
    label: 'Clinics',
    sheet: 'Clinics',
    supportsFilters: true,
    // Column order and headers are Santosh's template verbatim
    // ("iw clinicdata export excel file template.xlsx", 31 columns). Nine of them
    // have no source field in the DB and are exported empty on purpose, so the
    // file still lines up 1:1 with the template he is working against.
    columns: [
      { header: 'IW-Clinic-ID', key: 'iwClinicId', width: 26 },
      { header: 'Last Update Date', key: 'lastUpdate', width: 18 },
      { header: 'Clinic Name', key: 'name', width: 34 },
      { header: 'Clinic Type', key: 'type', width: 18 },
      { header: 'Treatments/Services', key: 'services', width: 50 },
      { header: 'Brands', key: 'brands', width: 40 },
      { header: 'Business Phone #', key: 'phone', width: 18 },
      { header: 'Business Email', key: 'email', width: 28 },
      { header: 'Book Consult url', key: 'bookingUrl', width: 40 },
      { header: 'Website url', key: 'websiteUrl', width: 40 },
      { header: 'Street Address', key: 'street', width: 34 },
      { header: 'City', key: 'city', width: 20 },
      { header: 'State', key: 'state', width: 8 },
      { header: 'Zipcode', key: 'zip', width: 10 },
      { header: 'GBP Profile Link', key: 'gbpLink', width: 44 },
      { header: 'Google Review Count', key: 'reviewCount', width: 18 },
      { header: 'Google Review Rating', key: 'reviewRating', width: 18 },
      { header: 'Date Google Review Updated', key: 'reviewUpdated', width: 22 }, // no source field
      { header: '# of Pics', key: 'picCount', width: 10 },
      { header: 'YT Url', key: 'ytUrl', width: 30 }, // no source field
      { header: 'LI url', key: 'liUrl', width: 30 }, // no source field
      { header: 'FB url', key: 'fbUrl', width: 30 },
      { header: 'IG url', key: 'igUrl', width: 30 },
      { header: 'TT url', key: 'ttUrl', width: 30 },
      { header: 'X url', key: 'xUrl', width: 30 }, // no source field
      { header: 'Owner Email', key: 'ownerEmail', width: 28 },
      { header: 'Owner Mobile', key: 'ownerMobile', width: 18 }, // no source field
      { header: 'Owner LI', key: 'ownerLi', width: 24 }, // no source field
      { header: 'Owner FB', key: 'ownerFb', width: 24 }, // no source field
      { header: 'Owner IH', key: 'ownerIh', width: 24 }, // no source field
      { header: 'Owner TK', key: 'ownerTk', width: 24 }, // no source field
    ],
    buildCount: (f) => {
      const values: unknown[] = []
      return { text: `SELECT COUNT(*)::int AS n FROM clinics c WHERE ${clinicWhere(f, values)}`, values }
    },
    buildPage: (f, lastId, limit) => {
      const values: unknown[] = []
      const where = clinicWhere(f, values)
      values.push(lastId)
      const idParam = values.length
      values.push(limit)
      return {
        text: `SELECT ${CLINIC_SELECT}
               FROM clinics c
               LEFT JOIN users u ON u.id = c.claimed_by_id
               WHERE ${where} AND c.id > $${idParam}
               ORDER BY c.id
               LIMIT $${values.length}`,
        values,
      }
    },
    hydrate: async (pool, rows) => {
      if (!rows.length) return
      const ids = rows.map((r) => r.id)
      const [svc, brd, pics] = await Promise.all([
        pool.query(
          `SELECT r.parent_id, string_agg(DISTINCT s.name, '; ' ORDER BY s.name) AS names
           FROM clinics_rels r JOIN services s ON s.id = r.services_id
           WHERE r.path = 'servicesOffered' AND r.parent_id = ANY($1) GROUP BY r.parent_id`,
          [ids],
        ),
        pool.query(
          `SELECT r.parent_id, string_agg(DISTINCT b.name, '; ' ORDER BY b.name) AS names
           FROM clinics_rels r JOIN brands b ON b.id = r.brands_id
           WHERE r.path = 'brandsOffered' AND r.parent_id = ANY($1) GROUP BY r.parent_id`,
          [ids],
        ),
        pool.query(
          `SELECT _parent_id AS parent_id, COUNT(*)::int AS n
           FROM clinics_clinic_photo_urls WHERE _parent_id = ANY($1) GROUP BY _parent_id`,
          [ids],
        ),
      ])
      const svcMap = new Map(svc.rows.map((r: any) => [r.parent_id, r.names]))
      const brdMap = new Map(brd.rows.map((r: any) => [r.parent_id, r.names]))
      const picMap = new Map(pics.rows.map((r: any) => [r.parent_id, r.n]))
      for (const r of rows) {
        r._services = svcMap.get(r.id) ?? ''
        r._brands = brdMap.get(r.id) ?? ''
        r._pics = picMap.get(r.id) ?? 0
      }
    },
    mapRow: (r) => ({
      iwClinicId: r.clinic_id ?? '',
      lastUpdate: r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : '',
      name: r.clinic_name ?? '',
      type: r.clinic_type ?? '',
      services: r._services ?? '',
      brands: r._brands ?? '',
      phone: r.phone ?? '',
      email: r.email ?? '',
      bookingUrl: r.booking_url ?? '',
      websiteUrl: r.website_url ?? '',
      street: r.address_line1 ?? '',
      city: r.city ?? '',
      state: r.state ?? '',
      zip: r.zip ?? '',
      // Prefer the stored maps URL; fall back to the canonical place-id link.
      gbpLink: r.google_maps_url || (r.google_place_id ? `https://www.google.com/maps/place/?q=place_id:${r.google_place_id}` : ''),
      reviewCount: r.aggregate_rating_count ?? '',
      reviewRating: r.aggregate_rating ?? '',
      reviewUpdated: '',
      picCount: r._pics ?? 0,
      ytUrl: '',
      liUrl: '',
      fbUrl: r.facebook_url ?? '',
      igUrl: r.instagram_url ?? '',
      ttUrl: r.tiktok_url ?? '',
      xUrl: '',
      ownerEmail: r.owner_email ?? '',
      ownerMobile: '',
      ownerLi: '',
      ownerFb: '',
      ownerIh: '',
      ownerTk: '',
    }),
  },

  services: {
    label: 'Services',
    sheet: 'Services',
    supportsFilters: false,
    columns: [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Slug', key: 'slug', width: 30 },
      { header: 'URL', key: 'url', width: 50 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Tagline', key: 'tagline', width: 50 },
      { header: 'Clinics Offering', key: 'clinicCount', width: 16 },
    ],
    buildCount: () => ({ text: 'SELECT COUNT(*)::int AS n FROM services', values: [] }),
    buildPage: (_f, lastId, limit) => ({
      text: `SELECT s.id, s.name, s.slug, s.category, s.tagline,
                    (SELECT COUNT(*)::int FROM clinics_rels r
                      WHERE r.path = 'servicesOffered' AND r.services_id = s.id) AS clinic_count
             FROM services s WHERE s.id > $1 ORDER BY s.id LIMIT $2`,
      values: [lastId, limit],
    }),
    mapRow: (r, siteUrl) => ({
      name: r.name ?? '',
      slug: r.slug ?? '',
      url: `${siteUrl}/services/${r.slug}`,
      category: r.category ?? '',
      tagline: r.tagline ?? '',
      clinicCount: r.clinic_count ?? 0,
    }),
  },

  brands: {
    label: 'Brands',
    sheet: 'Brands',
    supportsFilters: false,
    columns: [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Slug', key: 'slug', width: 25 },
      { header: 'URL', key: 'url', width: 45 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Manufacturer', key: 'manufacturer', width: 25 },
      { header: 'Clinics Offering', key: 'clinicCount', width: 16 },
    ],
    buildCount: () => ({ text: 'SELECT COUNT(*)::int AS n FROM brands', values: [] }),
    buildPage: (_f, lastId, limit) => ({
      text: `SELECT b.id, b.name, b.slug, b.category, b.manufacturer,
                    (SELECT COUNT(*)::int FROM clinics_rels r
                      WHERE r.path = 'brandsOffered' AND r.brands_id = b.id) AS clinic_count
             FROM brands b WHERE b.id > $1 ORDER BY b.id LIMIT $2`,
      values: [lastId, limit],
    }),
    mapRow: (r, siteUrl) => ({
      name: r.name ?? '',
      slug: r.slug ?? '',
      url: `${siteUrl}/brands/${r.slug}`,
      category: r.category ?? '',
      manufacturer: r.manufacturer ?? '',
      clinicCount: r.clinic_count ?? 0,
    }),
  },

  guides: {
    label: 'Guides',
    sheet: 'Guides',
    supportsFilters: false,
    columns: [
      { header: 'Title', key: 'title', width: 45 },
      { header: 'URL', key: 'url', width: 55 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Published At', key: 'publishedAt', width: 16 },
    ],
    // Gate is reviewStatus, not the admin "status" field — see lib/guide-queries.ts.
    buildCount: () => ({ text: `SELECT COUNT(*)::int AS n FROM guides WHERE review_status = 'approved'`, values: [] }),
    buildPage: (_f, lastId, limit) => ({
      text: `SELECT id, title, slug, category, published_at FROM guides
             WHERE review_status = 'approved' AND id > $1 ORDER BY id LIMIT $2`,
      values: [lastId, limit],
    }),
    mapRow: (r, siteUrl) => ({
      title: r.title ?? '',
      url: `${siteUrl}/guides/${r.slug}`,
      category: r.category ?? '',
      publishedAt: r.published_at ? new Date(r.published_at).toISOString().slice(0, 10) : '',
    }),
  },

  news: {
    label: 'News',
    sheet: 'News',
    supportsFilters: false,
    columns: [
      { header: 'Title', key: 'title', width: 45 },
      { header: 'URL', key: 'url', width: 55 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Published At', key: 'publishedAt', width: 16 },
    ],
    buildCount: () => ({ text: `SELECT COUNT(*)::int AS n FROM news WHERE review_status = 'approved'`, values: [] }),
    buildPage: (_f, lastId, limit) => ({
      text: `SELECT id, title, slug, category, published_at FROM news
             WHERE review_status = 'approved' AND id > $1 ORDER BY id LIMIT $2`,
      values: [lastId, limit],
    }),
    mapRow: (r, siteUrl) => ({
      title: r.title ?? '',
      url: `${siteUrl}/news/${r.slug}`,
      category: r.category ?? '',
      publishedAt: r.published_at ? new Date(r.published_at).toISOString().slice(0, 10) : '',
    }),
  },

  faqs: {
    label: 'FAQs',
    sheet: 'FAQs',
    supportsFilters: false,
    columns: [
      { header: 'Question', key: 'question', width: 50 },
      { header: 'Answer', key: 'answer', width: 70 },
      { header: 'Scope', key: 'scope', width: 14 },
      { header: 'Service', key: 'service', width: 22 },
      { header: 'Brand', key: 'brand', width: 22 },
      { header: 'Location', key: 'location', width: 22 },
      { header: 'Clinic Type', key: 'clinicType', width: 16 },
      { header: 'Review Status', key: 'reviewStatus', width: 16 },
    ],
    // All rows, not just approved: this is a content audit list, not a page list.
    buildCount: () => ({ text: 'SELECT COUNT(*)::int AS n FROM faqs', values: [] }),
    buildPage: (_f, lastId, limit) => ({
      text: `SELECT f.id, f.question, f.answer, f.scope, f.clinic_type, f.review_status,
                    s.name AS service_name, b.name AS brand_name, l.name AS location_name
             FROM faqs f
             LEFT JOIN services s ON s.id = f.service_id
             LEFT JOIN brands b ON b.id = f.brand_id
             LEFT JOIN locations l ON l.id = f.location_id
             WHERE f.id > $1 ORDER BY f.id LIMIT $2`,
      values: [lastId, limit],
    }),
    mapRow: (r) => ({
      question: r.question ?? '',
      answer: r.answer ?? '',
      scope: r.scope ?? '',
      service: r.service_name ?? '',
      brand: r.brand_name ?? '',
      location: r.location_name ?? '',
      clinicType: r.clinic_type ?? '',
      reviewStatus: r.review_status ?? '',
    }),
  },
}

/** Slugs this module can export. Matches the ExportJobs `collectionSlug` options. */
export type ExportableSlug = 'clinics' | 'services' | 'brands' | 'guides' | 'news' | 'faqs'

export const EXPORTABLE = Object.keys(EXPORT_DEFINITIONS) as ExportableSlug[]

/** Narrows an untrusted string to a slug we actually have a definition for. */
export function isExportableSlug(v: unknown): v is ExportableSlug {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(EXPORT_DEFINITIONS, v)
}
