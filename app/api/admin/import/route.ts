import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { parseCsv, splitByRecordType } from '@/lib/import/csv'
import { runImport } from '@/lib/import/import-data'
import { getAuthUser } from '@/lib/auth-user'
import type { Row } from '@/lib/import/helpers'

export const runtime = 'nodejs'

/**
 * Admin-only CSV bulk import. Accepts multipart/form-data with EITHER:
 *   - separate files: clinics, providers, reviews, photos, qa  (each a .csv File)
 *   - one combined file: combined  (.csv with a `record_type` column)
 * Plus fields:
 *   - dryRun: "true" → validate + count, write nothing (preview)
 *   - batch:  optional label stamped on every imported row (importBatch)
 *
 * Auth: must be a logged-in admin or editor (Payload cookie).
 */
export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })

  const user = await getAuthUser(payload)
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: 'Unauthorized. Admin or editor login required.' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data with CSV files.' }, { status: 400 })
  }

  const MAX_BYTES = 20 * 1024 * 1024 // 20 MB per file
  let tooBig: string | null = null
  async function textOf(field: string): Promise<string | undefined> {
    const f = form.get(field)
    if (f && typeof f === 'object' && 'text' in f) {
      if ((f as File).size > MAX_BYTES) { tooBig = field; return undefined }
      return (f as File).text()
    }
    return undefined
  }

  const dryRun = String(form.get('dryRun') ?? '') === 'true'
  const batchInput = (form.get('batch') ?? '').toString().trim()
  const batch = batchInput || `import-${new Date().toISOString().slice(0, 19)}`

  const combinedText = await textOf('combined')
  const clinicsText = await textOf('clinics')
  const providersText = await textOf('providers')
  const reviewsText = await textOf('reviews')
  const photosText = await textOf('photos')
  const qaText = await textOf('qa')

  if (tooBig) {
    return NextResponse.json(
      { error: `The ${tooBig} CSV exceeds the 20 MB limit. Split it into smaller files.` },
      { status: 413 },
    )
  }

  let data: { clinics?: Row[]; providers?: Row[]; reviews?: Row[]; photos?: Row[]; qa?: Row[] }
  let unknownTypes: Record<string, number> | undefined

  if (combinedText) {
    const split = splitByRecordType(parseCsv(combinedText))
    unknownTypes = Object.keys(split.unknownTypes).length ? split.unknownTypes : undefined
    data = {
      clinics: split.clinics.length ? split.clinics : undefined,
      providers: split.providers.length ? split.providers : undefined,
      reviews: split.reviews.length ? split.reviews : undefined,
      photos: split.photos.length ? split.photos : undefined,
      qa: split.qa.length ? split.qa : undefined,
    }
    if (!data.clinics && !data.providers && !data.reviews && !data.photos && !data.qa) {
      return NextResponse.json(
        { error: 'The combined CSV had no recognized record_type rows (clinic / provider / review / photo / qa).' },
        { status: 400 },
      )
    }
  } else {
    if (!clinicsText && !providersText && !reviewsText && !photosText && !qaText) {
      return NextResponse.json(
        { error: 'No CSV provided. Attach a combined file, or clinics/providers/reviews/photos/qa files.' },
        { status: 400 },
      )
    }
    data = {
      clinics: clinicsText ? parseCsv(clinicsText) : undefined,
      providers: providersText ? parseCsv(providersText) : undefined,
      reviews: reviewsText ? parseCsv(reviewsText) : undefined,
      photos: photosText ? parseCsv(photosText) : undefined,
      qa: qaText ? parseCsv(qaText) : undefined,
    }
  }

  try {
    const report = await runImport(payload, data, { source: 'import', dryRun, batch })
    return NextResponse.json({ success: true, report, unknownTypes })
  } catch (err: any) {
    payload.logger.error(`[admin import] ${err?.message ?? err}`)
    return NextResponse.json({ error: `Import failed: ${err?.message ?? 'unknown error'}` }, { status: 500 })
  }
}
