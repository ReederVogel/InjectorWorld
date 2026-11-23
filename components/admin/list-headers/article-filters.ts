import type { WhereClause } from './useCounts'

/** Shared list filters for Guides and News (chip counts + chip links). */

/** On the site: the public pages gate on reviewStatus, not the legacy status field. */
export const WHERE_LIVE: WhereClause = { reviewStatus: { equals: 'approved' } }

/** Neither an uploaded cover nor a legacy cover url. */
export const WHERE_NO_COVER: WhereClause = {
  and: [
    { coverImage: { exists: false } },
    { or: [{ coverImageUrl: { exists: false } }, { coverImageUrl: { equals: '' } }] },
  ],
}

/** No SEO description of its own (the page then falls back to the excerpt). */
export const WHERE_NO_SEO_DESCRIPTION: WhereClause = {
  or: [{ 'meta.description': { exists: false } }, { 'meta.description': { equals: '' } }],
}
