/**
 * Search a text across every Guide or every News article (the admin list's
 * "Search inside content" box). Uses the same engine and the same field list
 * as the "Find in this article" box on the edit screen, so a count here is
 * the count the editor will see after opening the article.
 *
 * Reads with one raw query (not payload.find, which joins every relationship
 * whatever the depth): ~225 articles, a few MB of JSON, a few milliseconds of
 * matching. Column names come from our own field list, never from the request.
 */

import type { FindField, FindOptions } from '../components/admin/find/find-engine'
import { buildHits, snippet } from '../components/admin/find/find-engine'
import { GUIDE_FIND_FIELDS, NEWS_FIND_FIELDS } from '../components/admin/find/find-fields'

export const SEARCHABLE: Record<'guides' | 'news', FindField[]> = {
  guides: GUIDE_FIND_FIELDS,
  news: NEWS_FIND_FIELDS,
}

export type ContentSearchCollection = keyof typeof SEARCHABLE

/** Payload's postgres column for a form path: `meta.title` -> meta_title, `answerSnippet` -> answer_snippet. */
export const columnFor = (path: string) =>
  path.replace(/\./g, '_').replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

export type ContentSearchResult = {
  id: number
  title: string
  slug: string
  live: boolean
  matches: number
  fields: { label: string; count: number }[]
  snippets: { label: string; context?: string; before: string; match: string; after: string }[]
}

const MAX_PER_ARTICLE = 5000

export async function searchContent(
  pool: { query: (sql: string) => Promise<{ rows: any[] }> },
  collection: ContentSearchCollection,
  query: string,
  opts: FindOptions,
): Promise<{ articles: number; matches: number; results: ContentSearchResult[] }> {
  const fields = SEARCHABLE[collection]
  const cols = fields.map((f) => columnFor(f.path))
  const table = collection === 'guides' ? 'guides' : 'news'
  const { rows } = await pool.query(
    `SELECT id, title AS "_title", slug AS "_slug", review_status AS "_review", ${cols
      .map((c) => `"${c}"`)
      .join(', ')} FROM ${table} ORDER BY id`,
  )

  const results: ContentSearchResult[] = []
  for (const row of rows) {
    const values = cols.map((c) => row[c])
    const { hits } = buildHits(fields, values, query, opts, MAX_PER_ARTICLE)
    if (!hits.length) continue
    const perField = new Map<number, number>()
    for (const h of hits) perField.set(h.fieldIndex, (perField.get(h.fieldIndex) ?? 0) + 1)
    results.push({
      id: row.id,
      title: row._title ?? '',
      slug: row._slug ?? '',
      live: row._review === 'approved',
      matches: hits.length,
      fields: [...perField].map(([fi, count]) => ({ label: fields[fi].label, count })),
      snippets: hits.slice(0, 2).map((h) => ({
        label: fields[h.fieldIndex].label,
        context: h.unit.context,
        ...snippet(h.unit.text, h.start, h.end, 40),
      })),
    })
  }
  results.sort((a, b) => b.matches - a.matches || a.title.localeCompare(b.title))
  return {
    articles: results.length,
    matches: results.reduce((n, r) => n + r.matches, 0),
    results,
  }
}
