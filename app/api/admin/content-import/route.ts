import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { checkOrigin } from '@/lib/rate-limit'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { runContentImport, type ContentImportPayload } from '@/lib/import/content-import'

export const runtime = 'nodejs'

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

/**
 * Admin-only JSON content import (news articles / guides).
 * Accepts multipart/form-data with a `file` (.json) field, OR a raw JSON body.
 * Fields:
 *   - dryRun: "true" (default) → validate + count, write nothing
 *   - batch:  optional label stamped on every imported item
 *   - file:   .json File (multipart) OR omit and send raw JSON body
 */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const payload = await getPayload({ config })

  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  let parsed: ContentImportPayload
  let dryRun = true
  let batch = ''

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 })
    }

    dryRun = String(form.get('dryRun') ?? 'true') === 'true'
    batch = (form.get('batch') ?? '').toString().trim()
    const collectionOverride = (form.get('collection') ?? '').toString().trim() as 'news' | 'guides' | ''

    const file = form.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No JSON file attached. Attach a .json file as the "file" field.' }, { status: 400 })
    }
    if ((file as File).size > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds the 20 MB limit.' }, { status: 413 })
    }

    const text = await (file as File).text()
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Could not parse JSON file.' }, { status: 400 })
    }

    // Allow the panel to force the target collection regardless of contentKind in file
    if (collectionOverride === 'news' || collectionOverride === 'guides') {
      parsed.contentKind = collectionOverride === 'guides' ? 'guide' : 'news'
    }
  } else {
    // Raw JSON body
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Could not parse JSON body.' }, { status: 400 })
    }
    // Body may contain the import payload directly, or wrapped with dryRun/batch meta
    if (body?.items !== undefined || body?.contentKind !== undefined) {
      parsed = body
      dryRun = true
      batch = ''
    } else {
      parsed = body?.payload ?? body
      dryRun = body?.dryRun !== false
      batch = body?.batch?.toString().trim() ?? ''
    }
  }

  if (!batch) {
    batch = `content-import-${new Date().toISOString().slice(0, 19)}`
  }

  try {
    const report = await runContentImport(payload, parsed, { dryRun, batch })
    return NextResponse.json({ success: true, report })
  } catch (err: any) {
    payload.logger.error(`[content-import] ${err?.message ?? err}`)
    return NextResponse.json(
      { error: `Import failed: ${err?.message ?? 'unknown error'}` },
      { status: 500 },
    )
  }
}
