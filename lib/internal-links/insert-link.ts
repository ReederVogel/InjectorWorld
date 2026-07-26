/**
 * Inserts a real inline link into a Guide/News body (our simplified Lexical
 * JSON shape -- see lib/import/content-import.ts's buildLexicalBody and
 * lib/render-lexical.tsx, which this must stay byte-compatible with).
 *
 * Text-match based, not index-based: the LLM is asked for exact verbatim
 * anchor text from the article, and this function finds it by substring
 * search across paragraphs rather than trusting a paragraph-index count
 * (which is easy for a model to get off-by-one on, especially with headings
 * interspersed between paragraphs).
 */

export type LinkInsertion = {
  anchorText: string
  url: string
  previewTitle: string
  previewExcerpt?: string
  previewType?: string
}

export type InsertResult = { body?: any; reason?: string; success: boolean }

// Matches lib/render-lexical.tsx's table detection. A paragraph whose text is
// actually a baked-in Markdown table must never receive an inline link: doing
// so would split it into 3 children, and the renderer's table parser only
// fires on a paragraph with a single plain-text child -- so the link would
// silently break that table back into raw pipe text.
const MD_TABLE_SEPARATOR_ROW = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/
function looksLikeTable(text: string): boolean {
  if (text.startsWith('(table)')) return true
  if (text.includes('\n') && text.includes('|')) {
    return text.split('\n').some((line) => MD_TABLE_SEPARATOR_ROW.test(line.trim()))
  }
  return false
}

function findParagraphNodes(body: any): any[] {
  const root = body?.root
  if (!root || !Array.isArray(root.children)) return []
  return root.children.filter((n: any) => n?.type === 'paragraph')
}

function makeTextNode(text: string) {
  return { type: 'text', format: 0, mode: 'normal', style: '', text, version: 1 }
}

function makeLinkNode(anchorText: string, opts: LinkInsertion) {
  return {
    type: 'link',
    format: '',
    indent: 0,
    version: 1,
    fields: {
      url: opts.url,
      newTab: false,
      previewTitle: opts.previewTitle,
      previewExcerpt: opts.previewExcerpt,
      previewType: opts.previewType,
    },
    children: [makeTextNode(anchorText)],
  }
}

/** True if this exact URL is already linked anywhere in the body -- idempotency guard, so re-approving or re-running a suggestion never double-inserts. */
export function bodyAlreadyLinksTo(body: any, url: string): boolean {
  return findParagraphNodes(body).some((p) =>
    (p.children ?? []).some((c: any) => c?.type === 'link' && c.fields?.url === url),
  )
}

/**
 * Returns the plain text of every paragraph in document order, for handing
 * to the LLM so it can quote back exact substrings that actually exist in
 * the article (never invents anchor text it then can't find).
 */
export function listParagraphTexts(body: any): string[] {
  return findParagraphNodes(body)
    .filter((p) => Array.isArray(p.children) && p.children.length === 1 && p.children[0]?.type === 'text')
    .map((p) => p.children[0].text as string)
    .filter((text) => !looksLikeTable(text))
}

/**
 * Inserts `insertion.anchorText` as a real inline link inside the first
 * plain paragraph (single text child, no existing link) whose text contains
 * that exact substring. Never mutates the input -- returns a deep-cloned,
 * modified body on success.
 */
export function insertInlineLink(body: any, insertion: LinkInsertion): InsertResult {
  if (bodyAlreadyLinksTo(body, insertion.url)) {
    return { success: false, reason: 'Already linked in this document.' }
  }
  if (!insertion.anchorText?.trim()) {
    return { success: false, reason: 'Empty anchor text.' }
  }

  const cloned = JSON.parse(JSON.stringify(body))
  const paragraphs = findParagraphNodes(cloned)

  for (const p of paragraphs) {
    if (!Array.isArray(p.children) || p.children.length !== 1 || p.children[0]?.type !== 'text') continue
    const textNode = p.children[0]
    const haystack = (textNode.text as string) ?? ''
    if (looksLikeTable(haystack)) continue
    const idx = haystack.indexOf(insertion.anchorText)
    if (idx === -1) continue

    const before = haystack.slice(0, idx)
    const after = haystack.slice(idx + insertion.anchorText.length)
    p.children = [
      ...(before ? [makeTextNode(before)] : []),
      makeLinkNode(insertion.anchorText, insertion),
      ...(after ? [makeTextNode(after)] : []),
    ]
    return { success: true, body: cloned }
  }

  return {
    success: false,
    reason: `Anchor text "${insertion.anchorText}" not found verbatim in any unlinked paragraph.`,
  }
}
