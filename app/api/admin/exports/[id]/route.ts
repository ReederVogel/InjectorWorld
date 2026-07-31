import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { reapAbandonedJobs } from '@/lib/exports/run-export'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/exports/:id
 * Progress poll for one job. Reaps first so a job whose process died reports
 * "abandoned" instead of sitting at "running" forever.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  await reapAbandonedJobs(payload)

  try {
    const job: any = await payload.findByID({
      collection: 'export-jobs',
      id,
      depth: 0,
      overrideAccess: true,
    })
    return NextResponse.json({
      id: job.id,
      collectionSlug: job.collectionSlug,
      status: job.status,
      filterSummary: job.filterSummary,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      fileName: job.fileName,
      fileUrl: job.fileUrl,
      fileSizeBytes: job.fileSizeBytes,
      error: job.error,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
    })
  } catch {
    return NextResponse.json({ error: 'Export job not found.' }, { status: 404 })
  }
}
