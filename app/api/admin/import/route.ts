import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { parseCsv } from '@/lib/import/csv'
import { runImport } from '@/lib/import/import-data'

/**
 * Admin-only CSV bulk import. Accepts multipart/form-data with any of:
 *   clinics, providers, reviews   (each a .csv File)
 * Auth: must be a logged-in admin or editor (Payload cookie).
 */
export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })

  // Authenticate via the Payload session cookie.
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: 'Unauthorized. Admin or editor login required.' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data with CSV files.' }, { status: 400 })
  }

  async function textOf(field: string): Promise<string | undefined> {
    const f = form.get(field)
    if (f && typeof f === 'object' && 'text' in f) return (f as File).text()
    return undefined
  }

  const clinicsText = await textOf('clinics')
  const providersText = await textOf('providers')
  const reviewsText = await textOf('reviews')

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
