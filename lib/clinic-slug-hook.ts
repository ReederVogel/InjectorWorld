import type { CollectionBeforeValidateHook } from 'payload'
import { clinicSlug } from './import/helpers'

/**
 * Auto-fill a clinic's slug as `clinic-name-city-state-zip` when none is
 * provided.
 *
 * Runs in beforeValidate so the required `slug` field is populated before
 * Payload's required-check. An explicitly supplied slug is preserved as-is.
 * Uniqueness is enforced by appending -2, -3, … if the base is taken (the
 * directory has same-name clinics at the same address). The bulk importer sets
 * the slug itself (lib/import/import-data.ts); this covers admin/dashboard
 * creates and any update that clears the slug.
 *
 * City and state joined the key on 2026-08-04, when an audit found the DB
 * running three slug conventions at once and 22,916 rows were migrated onto
 * this one. Keep this in step with lib/import/import-data.ts and any one-off
 * batch import script, or the next import reintroduces the drift.
 */
export const ensureClinicSlug: CollectionBeforeValidateHook = async ({ data, req, originalDoc }) => {
  if (!data) return data

  const hasSlug = typeof data.slug === 'string' && data.slug.trim().length > 0
  if (hasSlug) return data

  const name = (data.clinicName ?? originalDoc?.clinicName) as string | undefined
  const zip = (data.zip ?? originalDoc?.zip) as string | undefined
  const city = (data.city ?? originalDoc?.city) as string | undefined
  const state = (data.state ?? originalDoc?.state) as string | undefined
  const base = name ? clinicSlug(name, zip, city, state) : ''
  if (!base) return data

  const selfId = String(originalDoc?.id ?? (data as any).id ?? '')
  let candidate = base
  let n = 1
  while (n < 50) {
    const existing = await req.payload.find({
      collection: 'clinics',
      where: { slug: { equals: candidate } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const taken = existing.docs.length > 0 && String(existing.docs[0].id) !== selfId
    if (!taken) break
    n += 1
    candidate = `${base}-${n}`
  }

  data.slug = candidate
  return data
}
