import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Published / Updated dates for guides. See docs/GUIDE-DATES-2026-09-13.md.
 *
 * Payload's own `updatedAt` moves on every save: the link-discovery scan
 * stamping `linkDiscoveryScannedAt`, a bulk reviewStatus edit, an approval.
 * None of those change what a reader sees, so `updatedAt` is not an honest
 * "last updated" date. `contentUpdatedAt` moves only when one of the fields
 * below actually changes, which includes an internal link being inserted into
 * or removed from `body` by the internal-linking system.
 */
export const GUIDE_CONTENT_FIELDS = [
  'title',
  'lede',
  'body',
  'answerSnippet',
  'atAGlance',
  'faq',
  'sources',
  'internalLinks',
  'coverImage',
  'coverImageUrl',
  'author',
  'medicalReviewer',
  'faqs',
] as const

// Lexical bookkeeping keys, dropped whatever their value. The editor adds or
// rewrites these on open, so they say nothing about the content.
const DROP_KEYS = new Set(['direction', 'version', 'textFormat', 'textStyle', '$'])

// Keys dropped only when they hold the Lexical default. A text node imported
// without `format` and the same node after an open-and-save with `format: 0`
// must fingerprint the same; `format: 1` (bold) must not.
const DEFAULTS: Record<string, unknown> = { detail: 0, format: 0, mode: 'normal', style: '', indent: 0 }

// Relationship / upload fields. Each arrives as an id (number or string) or as a
// populated doc depending on depth, so they are compared by id only.
const RELATION_FIELDS = new Set(['author', 'medicalReviewer', 'coverImage', 'faqs'])

function relationId(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return null
  if (Array.isArray(value)) {
    const ids = value.map(relationId).filter((v) => v !== null)
    return ids.length ? ids : null
  }
  if (typeof value === 'object') {
    const id = (value as Record<string, unknown>).id
    return id === undefined || id === null ? null : String(id)
  }
  return String(value)
}

function normalize(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return null
  if (Array.isArray(value)) {
    const items = value.map(normalize)
    return items.length ? items : null
  }
  if (typeof value !== 'object') return value

  const obj = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    if (DROP_KEYS.has(key)) continue
    if (key in DEFAULTS && (obj[key] === DEFAULTS[key] || obj[key] === '' || obj[key] == null)) continue
    // Lexical upload / relationship nodes carry the related doc in `value`,
    // as an id or populated depending on depth.
    const v = key === 'value' && obj.relationTo !== undefined ? relationId(obj[key]) : normalize(obj[key])
    if (v === null) continue
    out[key] = v
  }
  return Object.keys(out).length ? out : null
}

/** Stable, editor-noise-free representation of one guide field's value. */
export function contentFingerprint(field: string, value: unknown): string {
  return JSON.stringify(RELATION_FIELDS.has(field) ? relationId(value) : normalize(value))
}

export const guideDatesBeforeChange: CollectionBeforeChangeHook = ({ data, originalDoc, operation }) => {
  if (!data) return data
  const now = new Date().toISOString()

  const approved = (data.reviewStatus ?? originalDoc?.reviewStatus) === 'approved'
  const publishedAt = data.publishedAt !== undefined ? data.publishedAt : originalDoc?.publishedAt
  if (approved && !publishedAt) data.publishedAt = now

  // A create is the first version, not an update. Published covers it.
  if (operation !== 'update' || !originalDoc) return data

  // The date is hook-owned. Ignore any value sent in (e.g. the admin form
  // echoing the stored one back) and decide from the content alone.
  delete data.contentUpdatedAt

  const changed = GUIDE_CONTENT_FIELDS.some(
    (field) =>
      field in data && contentFingerprint(field, data[field]) !== contentFingerprint(field, originalDoc[field]),
  )
  if (changed) data.contentUpdatedAt = now

  return data
}

export type GuideDates = {
  /** ISO. Undefined only for a guide that has never been approved. */
  published?: string
  /** ISO. Never earlier than `published`. Equals `published` when there has been no content update. */
  modified?: string
  /** True when the updated calendar day (UTC) is after the published day. Controls the visible "Updated" label. */
  showUpdated: boolean
}

const utcDay = (iso: string) => new Date(iso).toISOString().slice(0, 10)

export function resolveGuideDates(publishedAt?: string | null, contentUpdatedAt?: string | null): GuideDates {
  const published = publishedAt ? new Date(publishedAt).toISOString() : undefined
  const updated = contentUpdatedAt ? new Date(contentUpdatedAt).toISOString() : undefined

  if (!published) return { published: undefined, modified: updated, showUpdated: false }
  if (!updated || updated <= published) return { published, modified: published, showUpdated: false }
  return { published, modified: updated, showUpdated: utcDay(updated) > utcDay(published) }
}

export function formatGuideDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
