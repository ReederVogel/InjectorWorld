import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { serverError } from '@/lib/api-errors'
import { assignMissingFaqFields } from '@/lib/faqs/assign'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * "Assign missing" on the Categories panel: gives every FAQ without a category
 * or section one, creating categories as needed. `apply: false` is a preview.
 * Same code as scripts/assign-faq-categories.ts. Never touches an FAQ that
 * already has both, so it cannot undo an admin's choice.
 */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const payload = await getPayload({ config })
  const guard = requireAdminOrEditor(await getAuthUser(payload))
  if (guard) return guard

  const body = await req.json().catch(() => ({}))
  const apply = body?.apply === true

  try {
    const report = await assignMissingFaqFields(payload, { apply })
    if (apply && report.changed > 0) {
      try { revalidatePath('/', 'layout') } catch { /* pages still refresh on their timer */ }
    }
    const categories = new Map<string, { name: string; count: number; isNew: boolean }>()
    for (const r of report.rows) {
      if (!r.categorySlug) continue
      const e = categories.get(r.categorySlug) ?? {
        name: r.categoryName,
        count: 0,
        isNew: r.action === 'created' || r.action === 'would-create',
      }
      e.count++
      categories.set(r.categorySlug, e)
    }
    return NextResponse.json({
      apply,
      scanned: report.scanned,
      changed: report.changed,
      sectionsGuessed: report.rows.filter((r) => r.sectionAction === 'guessed').length,
      categories: [...categories.entries()].map(([slug, e]) => ({ slug, ...e })).sort((a, b) => b.count - a.count),
      errors: report.errors.slice(0, 20),
    })
  } catch (err) {
    return serverError('admin/faqs/assign', err, 'Could not assign categories.')
  }
}
