import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { parseCsv } from '@/lib/import/csv'
import { runImport } from '@/lib/import/import-data'
import { getAuthUser } from '@/lib/auth-user'

/**
 * Admin-only CSV bulk import. Accepts multipart/form-data with any of:
 *   clinics, providers, reviews   (each a .csv File)
 * Auth: must be a logged-in admin or editor (Payload cookie).
 */
export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })

  // Authenticate via the Payload session cookie (read cookie → JWT internally).
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

  // Per-file size cap so an oversized upload can't exhaust server memory.
  const MAX_BYTES = 20 * 1024 * 1024 // 20 MB
  let tooBig: string | null = null
  async function textOf(field: string): Promise<string | undefined> {
    const f = form.get(field)
    if (f && typeof f === 'object' && 'text' in f) {
      if ((f as File).size > MAX_BYTES) { tooBig = field; return undefined }
      return (f as File).text()
    }
    return undefined
  }

  const clinicsText = await textOf('clinics')
  const providersText = await textOf('providers')
  const reviewsText = await textOf('reviews')

  if (tooBig) {
    return NextResponse.json(
      { error: `The ${tooBig} CSV exceeds the 20 MB limit. Split it into smaller files.` },
      { status: 413 },
    )
  }

  if (!clinicsText && !providersText && !reviewsText) {
    return NextResponse.json({ error: 'No CSV files provided. Attach clinics, providers, and/or reviews.' }, { status: 400 })
  }

  try {
    const report = await runImport(
      payload,
      {
        clinics: clinicsText ? parseCsv(clinicsText) : undefined,
        providers: providersText ? parseCsv(providersText) : undefined,
        reviews: reviewsText ? parseCsv(reviewsText) : undefined,
      },
      { source: 'import' },
    )
    return NextResponse.json({ success: true, report })
  } catch (err: any) {
    payload.logger.error(`[admin import] ${err?.message ?? err}`)
    return NextResponse.json({ error: `Import failed: ${err?.message ?? 'unknown error'}` }, { status: 500 })
  }
}
