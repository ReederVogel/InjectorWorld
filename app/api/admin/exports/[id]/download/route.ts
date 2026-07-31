import fs from 'fs'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { exportFilePath } from '@/lib/exports/run-export'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/exports/:id/download
 *
 * Admin-only. An export carries every listed clinic's business email and phone,
 * so it is deliberately NOT served from a public bucket URL. Auth is checked on
 * every download, and the file is read by the job's stored name only, so the
 * caller can never point this at an arbitrary path.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  let job: any
  try {
    job = await payload.findByID({ collection: 'export-jobs', id, depth: 0, overrideAccess: true })
  } catch {
    return NextResponse.json({ error: 'Export job not found.' }, { status: 404 })
  }

  if (job.status !== 'done' || !job.fileName) {
    return NextResponse.json({ error: `Export is ${job.status}, nothing to download yet.` }, { status: 409 })
  }

  const filePath = exportFilePath(job.fileName)
  if (!fs.existsSync(filePath)) {
    // Expected after a redeploy: the instance disk is ephemeral. Say so plainly
    // rather than 500ing, so the admin knows to just run it again.
    return NextResponse.json(
      { error: 'This file expired when the server restarted. Run the export again.' },
      { status: 410 },
    )
  }

  const buf = fs.readFileSync(filePath)
  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${job.fileName}"`,
      'Content-Length': String(buf.length),
      'Cache-Control': 'no-store',
    },
  })
}
