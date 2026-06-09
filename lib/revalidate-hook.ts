import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidatePath } from 'next/cache'

/**
 * On-demand ISR revalidation hooks (P0 fix).
 *
 * Every public page uses `export const revalidate = 300`, so without this an
 * admin edit (e.g. toggling a market live) would not show on the production
 * site for up to 5 minutes — and only then if traffic triggers regeneration.
 * These hooks revalidate the whole public tree on any content change so admin
 * edits reflect immediately.
 *
 * Attach alongside the audit hooks:
 *   hooks: {
 *     afterChange: [auditAfterChange, revalidateAfterChange],
 *     afterDelete: [auditAfterDelete, revalidateAfterDelete],
 *   }
 *
 * `revalidatePath('/', 'layout')` revalidates the entire site under the root
 * layout. It is a broad invalidation; acceptable pre-launch / at this scale.
 * Phase 12 (hardening) can make this path-targeted if regeneration cost grows.
 *
 * Wrapped in try/catch: `revalidatePath` throws when called outside a Next.js
 * request scope (the CLI import / seed / set-live scripts run these same hooks).
 * Outside a request it is a harmless no-op.
 */
function revalidateSite(): void {
  try {
    revalidatePath('/', 'layout')
  } catch {
    // Not inside a Next request (CLI script). Safe to ignore.
  }
}

export const revalidateAfterChange: CollectionAfterChangeHook = ({ doc }) => {
  revalidateSite()
  return doc
}

export const revalidateAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  revalidateSite()
  return doc
}
