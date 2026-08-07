import { NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Standard 500 response for route handlers.
 *
 * WHAT THIS REPLACED, AND WHY IT MATTERED.
 *
 * Thirty admin routes ended their catch block like this:
 *
 *     return NextResponse.json({ error: err?.message ?? 'Update failed.' }, { status: 500 })
 *
 * `err.message` from the `pg` driver is not a friendly summary. It carries the
 * failing constraint, the column, the table, sometimes the SQL text and the
 * offending value. Handing that to the caller turns any 500 into a free read of
 * the database schema, one error at a time. These routes are admin-gated, which
 * caps who can reach them today, but "the auth check in front of it is correct"
 * is the wrong thing for a disclosure control to depend on.
 *
 * THE DEBUGGABILITY PROBLEM THIS SOLVES RATHER THAN CREATES.
 *
 * The obvious fix — return a fixed string — makes every failure look identical
 * and leaves whoever is debugging with nothing to search for. So each response
 * carries a short random `ref`, and the same `ref` is logged next to the full
 * error and stack. The admin reports the ref, you grep the logs for it, and you
 * have the complete error. Strictly more useful than the old behaviour, because
 * the log line has the stack too and the response never did.
 *
 * The ref is random per occurrence, not derived from the error, so it reveals
 * nothing by itself.
 */
export function serverError(
  scope: string,
  err: unknown,
  publicMessage = 'Something went wrong. Please try again.',
): NextResponse {
  const ref = crypto.randomBytes(4).toString('hex')

  const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  console.error(`[${scope}] ref=${ref} ${detail}`)

  return NextResponse.json(
    { error: publicMessage, ref },
    { status: 500, headers: { 'Cache-Control': 'no-store' } },
  )
}
