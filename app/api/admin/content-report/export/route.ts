import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { getLocationSlugMap, lookupSlugs } from '@/lib/location-slug-lookup'
import { serverError } from '@/lib/api-errors'

export const runtime = 'nodejs'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: { header: string; key: string; width?: number }[],
  rows: Record<string, unknown>[],
) {
  const sheet = workbook.addWorksheet(name)
  sheet.columns = columns
  sheet.getRow(1).font = { bold: true }
  sheet.addRows(rows)
  return sheet
}

/**
 * GET /api/admin/content-report/export
 * Downloads a multi-sheet .xlsx: live URLs for Clinics/Guides/News/Brands
 * (only the collection's actual live/approved rows -- see per-collection
 * gate comments), and the full FAQ content (question/answer, not a URL --
 * one FAQ can render on several pages depending on scope, so there's no
 * single URL to give it).
 * Auth: admin only.
 */
export async function GET() {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  const pool = (payload.db as any).pool
  if (!pool) {
    return NextResponse.json({ error: 'No Postgres pool available.' }, { status: 500 })
  }

  try {
    const [clinicsRes, guidesRes, newsRes, brandsRes, faqsRes, slugMap] = await Promise.all([
      // Only published clinics have a working URL -- draft/review 404
      // (getClinicBySlugUnsafe in lib/clinic-queries.ts filters on this).
      pool.query(`
        SELECT clinic_name, slug, city, state
        FROM clinics
        WHERE status = 'published'
        ORDER BY state, city, clinic_name
      `),
      // Gate is reviewStatus, not the admin "status" field -- see
      // lib/guide-queries.ts's APPROVED comment.
      pool.query(`
        SELECT title, slug, published_at
        FROM guides
        WHERE review_status = 'approved'
        ORDER BY title
      `),
      pool.query(`
        SELECT title, slug, category, published_at
        FROM news
        WHERE review_status = 'approved'
        ORDER BY published_at DESC NULLS LAST, title
      `),
      // No draft/live concept -- every brand is live once created.
      pool.query(`
        SELECT name, slug, category, manufacturer
        FROM brands
        ORDER BY name
      `),
      // FAQs export their content, not a URL: a single FAQ can render on
      // multiple pages depending on scope (see getBrandFaqs in
      // lib/brand-queries.ts), so there's no 1:1 FAQ-to-URL mapping.
      // All rows included (not just approved) since this is a content
      // audit list, not a public-page list.
      pool.query(`
        SELECT f.question, f.answer, f.scope, f.clinic_type, f.review_status,
               s.name AS service_name, b.name AS brand_name, l.name AS location_name
        FROM faqs f
        LEFT JOIN services s ON s.id = f.service_id
        LEFT JOIN brands b ON b.id = f.brand_id
        LEFT JOIN locations l ON l.id = f.location_id
        ORDER BY f.sort_rank, f.id
      `),
      getLocationSlugMap(),
    ])

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'injector.world admin'
    workbook.created = new Date()

    addSheet(
      workbook,
      'Clinics',
      [
        { header: 'Clinic Name', key: 'name', width: 32 },
        { header: 'URL', key: 'url', width: 60 },
        { header: 'City', key: 'city', width: 20 },
        { header: 'State', key: 'state', width: 10 },
      ],
      (clinicsRes.rows as any[]).map((c) => {
        const { citySlug, stateSlug } = lookupSlugs(c.city ?? '', c.state ?? '', slugMap)
        return {
          name: c.clinic_name,
          url: `${SITE_URL}/clinics/${stateSlug}/${citySlug}/${c.slug}`,
          city: c.city,
          state: c.state,
        }
      }),
    )

    addSheet(
      workbook,
      'Guides',
      [
        { header: 'Title', key: 'title', width: 40 },
        { header: 'URL', key: 'url', width: 55 },
        { header: 'Published At', key: 'publishedAt', width: 20 },
      ],
      (guidesRes.rows as any[]).map((g) => ({
        title: g.title,
        url: `${SITE_URL}/guides/${g.slug}`,
        publishedAt: g.published_at ? new Date(g.published_at).toISOString().slice(0, 10) : '',
      })),
    )

    addSheet(
      workbook,
      'News',
      [
        { header: 'Title', key: 'title', width: 40 },
        { header: 'URL', key: 'url', width: 55 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Published At', key: 'publishedAt', width: 20 },
      ],
      (newsRes.rows as any[]).map((n) => ({
        title: n.title,
        url: `${SITE_URL}/news/${n.slug}`,
        category: n.category ?? '',
        publishedAt: n.published_at ? new Date(n.published_at).toISOString().slice(0, 10) : '',
      })),
    )

    addSheet(
      workbook,
      'Brands',
      [
        { header: 'Name', key: 'name', width: 25 },
        { header: 'URL', key: 'url', width: 45 },
        { header: 'Category', key: 'category', width: 18 },
        { header: 'Manufacturer', key: 'manufacturer', width: 25 },
      ],
      (brandsRes.rows as any[]).map((b) => ({
        name: b.name,
        url: `${SITE_URL}/brands/${b.slug}`,
        category: b.category ?? '',
        manufacturer: b.manufacturer ?? '',
      })),
    )

    addSheet(
      workbook,
      'FAQs',
      [
        { header: 'Question', key: 'question', width: 45 },
        { header: 'Answer', key: 'answer', width: 60 },
        { header: 'Scope', key: 'scope', width: 14 },
        { header: 'Service', key: 'service', width: 20 },
        { header: 'Brand', key: 'brand', width: 20 },
        { header: 'Location', key: 'location', width: 20 },
        { header: 'Clinic Type', key: 'clinicType', width: 16 },
        { header: 'Review Status', key: 'reviewStatus', width: 16 },
      ],
      (faqsRes.rows as any[]).map((f) => ({
        question: f.question,
        answer: f.answer,
        scope: f.scope,
        service: f.service_name ?? '',
        brand: f.brand_name ?? '',
        location: f.location_name ?? '',
        clinicType: f.clinic_type ?? '',
        reviewStatus: f.review_status,
      })),
    )

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `content-report-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err: any) {
    payload.logger.error(`[content-report/export] ${err?.message ?? err}`)
    return serverError('admin/content-report/export', err, 'Export failed.')
  }
}
