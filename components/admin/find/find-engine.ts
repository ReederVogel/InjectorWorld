/**
 * Pure search logic for the admin "Find in this article" box.
 *
 * No DOM and no React here, so it can be unit-checked from a plain script.
 * The box (FindInDocument.tsx) searches the form's live values with these
 * functions, then uses find-dom.ts to locate and highlight the same matches
 * in the rendered fields.
 */

export type FindFieldKind = 'text' | 'textarea' | 'richText' | 'json'

/** One field the box searches. `path` is the Payload form path, e.g. `meta.title`. */
export type FindField = { path: string; label: string; kind: FindFieldKind }

export type FindOptions = { matchCase: boolean; wholeWord: boolean }

export type Span = { start: number; end: number }

/** A run of searchable text inside a field. Matches never cross units. */
export type TextUnit = {
  text: string
  /** Body: the nearest heading above. JSON: where the string sits, e.g. "#3 · Answer". */
  context?: string
  /** JSON only: path of the string inside the field value. */
  jsonPath?: (string | number)[]
}

export type Hit = {
  fieldIndex: number
  /** Position of this hit among the hits of its own field, in page order. */
  k: number
  unit: TextUnit
  start: number
  end: number
}

/*
 * Characters folded together before comparing, one char to one char so match
 * offsets stay valid in the original text. Guides are full of curly quotes and
 * dashes from the humanized PDFs, while editors type straight ones.
 */
const FOLD: Record<string, string> = Object.fromEntries([
  ...[0x2018, 0x2019, 0x201a, 0x201b, 0x2032].map((c) => [String.fromCharCode(c), "'"]), // curly single quotes, prime
  ...[0x201c, 0x201d, 0x201e, 0x201f, 0x2033].map((c) => [String.fromCharCode(c), '"']), // curly double quotes
  ...[0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2212].map((c) => [String.fromCharCode(c), '-']), // hyphens, dashes, minus
  ...[0x00a0, 0x2007, 0x2009, 0x202f].map((c) => [String.fromCharCode(c), ' ']), // non-breaking and thin spaces
])

export function foldText(s: string, matchCase: boolean): string {
  const out = new Array<string>(s.length)
  for (let i = 0; i < s.length; i++) {
    let c = FOLD[s[i]] ?? s[i]
    if (!matchCase) {
      const lower = c.toLowerCase()
      // A few characters lowercase to two code units; keep those as they are
      // so every offset still lines up with the original text.
      if (lower.length === 1) c = lower
    }
    out[i] = c
  }
  return out.join('')
}

const WORD_CHAR = /[\p{L}\p{N}_]/u

function isWordBoundary(text: string, i: number): boolean {
  return i < 0 || i >= text.length || !WORD_CHAR.test(text[i])
}

/** Non-overlapping matches of `query` in `text`, left to right. */
export function findSpans(text: string, query: string, opts: FindOptions, limit = Infinity): Span[] {
  if (!query || !text || limit <= 0) return []
  const hay = foldText(text, opts.matchCase)
  const needle = foldText(query, opts.matchCase)
  const out: Span[] = []
  let from = 0
  while (out.length < limit) {
    const i = hay.indexOf(needle, from)
    if (i === -1) break
    const end = i + needle.length
    if (!opts.wholeWord || (isWordBoundary(text, i - 1) && isWordBoundary(text, end))) {
      out.push({ start: i, end })
      from = end
    } else {
      from = i + 1
    }
  }
  return out
}

/* ── Field values to text units ─────────────────────────────────────────── */

const INLINE_TYPES = new Set(['text', 'link', 'autolink', 'linebreak', 'tab'])

function inlineText(node: any): string {
  if (!node || typeof node !== 'object') return ''
  if (node.type === 'text') return typeof node.text === 'string' ? node.text : ''
  if (node.type === 'linebreak') return '\n'
  if (node.type === 'tab') return '\t'
  if (Array.isArray(node.children)) return node.children.map(inlineText).join('')
  return ''
}

/**
 * One unit per text block of a Lexical editor state (paragraph, heading, list
 * item, quote), in document order. This mirrors how the rendered editor groups
 * text into block elements, so the k-th match here is the k-th match there.
 */
export function lexicalUnits(state: unknown): TextUnit[] {
  const root = (state as any)?.root
  if (!root || !Array.isArray(root.children)) return []
  const units: TextUnit[] = []
  let section: string | undefined

  const visit = (node: any) => {
    if (!node || typeof node !== 'object' || !Array.isArray(node.children)) return
    const inline = node.children.filter((c: any) => c && INLINE_TYPES.has(c.type))
    if (inline.length) {
      const text = inline.map(inlineText).join('')
      if (node.type === 'heading') section = text.replace(/\s+/g, ' ').trim() || section
      if (text) units.push({ text, context: node.type === 'heading' ? undefined : section })
    }
    for (const child of node.children) {
      if (child && !INLINE_TYPES.has(child.type)) visit(child)
    }
  }
  for (const child of root.children) visit(child)
  return units
}

const WORD = /[\p{L}\p{N}]+(?:[',.\u2019\-][\p{L}\p{N}]+)*/gu

/** Words in a text: letters/digits, keeping "don't", "3.5", "self-care" and "1,000" as one word. */
export function countWords(text: string): number {
  return text.match(WORD)?.length ?? 0
}

/** Words in a Lexical editor state (text blocks only; uploads and blocks add nothing). */
export function lexicalWordCount(state: unknown): number {
  return lexicalUnits(state).reduce((n, unit) => n + countWords(unit.text), 0)
}

/** Reading speed behind the read-time suggestion, words per minute. */
export const READ_WPM = 225

export const readMinutes = (words: number) => (words > 0 ? Math.max(1, Math.round(words / READ_WPM)) : 0)

const KEY_LABELS: Record<string, string> = {
  question: 'Question',
  answer: 'Answer',
  detail: 'Detail',
  title: 'Title',
  publisher: 'Publisher',
  url: 'URL',
  publishedDate: 'Date',
  sourceType: 'Type',
  claimsSupported: 'Claims',
  offLabel: 'Off-label',
  safetyFlag: 'Safety',
  anchorText: 'Anchor text',
}

function jsonContext(path: (string | number)[]): string | undefined {
  const parts: string[] = []
  path.forEach((seg, i) => {
    if (typeof seg === 'number') {
      if (i === 0) parts.push(`#${seg + 1}`)
    } else {
      parts.push(KEY_LABELS[seg] ?? seg)
    }
  })
  return parts.length ? parts.join(' · ') : undefined
}

/** One unit per string value inside a JSON field (keys are never searched). */
export function jsonUnits(value: unknown): TextUnit[] {
  let v = value
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v)
    } catch {
      return v ? [{ text: v as string }] : []
    }
  }
  const units: TextUnit[] = []
  const walk = (node: unknown, path: (string | number)[]) => {
    if (typeof node === 'string') {
      if (node) units.push({ text: node, jsonPath: path, context: jsonContext(path) })
    } else if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, [...path, i]))
    } else if (node && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) walk(child, [...path, key])
    }
  }
  walk(v, [])
  return units
}

export function fieldUnits(field: FindField, value: unknown): TextUnit[] {
  switch (field.kind) {
    case 'richText':
      return lexicalUnits(value)
    case 'json':
      return jsonUnits(value)
    default:
      return typeof value === 'string' && value ? [{ text: value }] : []
  }
}

/** Every match across the given fields, in field order, capped at `cap`. */
export function buildHits(
  fields: FindField[],
  values: unknown[],
  query: string,
  opts: FindOptions,
  cap: number,
): { hits: Hit[]; truncated: boolean } {
  const hits: Hit[] = []
  if (!query.trim()) return { hits, truncated: false }
  for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
    let k = 0
    for (const unit of fieldUnits(fields[fieldIndex], values[fieldIndex])) {
      for (const span of findSpans(unit.text, query, opts, cap + 1 - hits.length)) {
        if (hits.length >= cap) return { hits, truncated: true }
        hits.push({ fieldIndex, k: k++, unit, start: span.start, end: span.end })
      }
    }
  }
  return { hits, truncated: false }
}

/** Text around a match for the results list, whitespace squashed. */
export function snippet(text: string, start: number, end: number, radius = 48) {
  const a = Math.max(0, start - radius)
  const b = Math.min(text.length, end + radius)
  const squash = (s: string) => s.replace(/\s+/g, ' ')
  return {
    before: (a > 0 ? '…' : '') + squash(text.slice(a, start)).trimStart(),
    match: squash(text.slice(start, end)),
    after: squash(text.slice(end, b)).trimEnd() + (b < text.length ? '…' : ''),
  }
}

/* ── Replace ───────────────────────────────────────────────────────────── */

/** `text` with every span replaced. Spans must not overlap; any order. */
export function replaceSpans(text: string, spans: Span[], replacement: string): string {
  let out = text
  for (const s of [...spans].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, s.start) + replacement + out.slice(s.end)
  }
  return out
}

/**
 * A copy of a JSON field value with replacements made inside its string
 * values. `edits` name a string by its path (as jsonUnits() reports it) and
 * the spans to replace in it. Everything else is copied as is, key order
 * included. A value stored as a JSON string comes back parsed.
 */
export function replaceInJson(
  value: unknown,
  edits: { jsonPath: (string | number)[]; spans: Span[] }[],
  replacement: string,
): unknown {
  let root: unknown = value
  if (typeof root === 'string') {
    try {
      root = JSON.parse(root)
    } catch {
      // A plain string value: the only path is [].
      const edit = edits.find((e) => e.jsonPath.length === 0)
      return edit ? replaceSpans(root as string, edit.spans, replacement) : root
    }
  }
  const copy = structuredClone(root)
  for (const { jsonPath, spans } of edits) {
    if (!jsonPath.length) continue
    let parent: any = copy
    for (const seg of jsonPath.slice(0, -1)) parent = parent?.[seg as any]
    const last = jsonPath[jsonPath.length - 1]
    if (parent && typeof parent[last as any] === 'string') {
      parent[last as any] = replaceSpans(parent[last as any], spans, replacement)
    }
  }
  return copy
}

/* ── JSON source positions (for highlighting inside the JSON code editor) ── */

export type JsonStringPos = { start: number; end: number }

export const jsonPathKey = (path: (string | number)[]) => JSON.stringify(path)

/**
 * Where every string VALUE sits in a JSON source text, keyed by its path.
 * start/end bound the raw characters between the quotes. Returns null when
 * the text is not valid JSON (for example while it is being typed).
 */
export function jsonStringPositions(src: string): Map<string, JsonStringPos> | null {
  const out = new Map<string, JsonStringPos>()
  let i = 0
  const LITERAL = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y
  const fail = (): never => {
    throw new Error('bad json')
  }
  const ws = () => {
    while (i < src.length && (src[i] === ' ' || src[i] === '\t' || src[i] === '\n' || src[i] === '\r')) i++
  }
  const str = (): JsonStringPos => {
    if (src[i] !== '"') fail()
    const start = ++i
    while (i < src.length && src[i] !== '"') i += src[i] === '\\' ? 2 : 1
    if (i >= src.length) fail()
    return { start, end: i++ }
  }
  const value = (path: (string | number)[]): void => {
    ws()
    const c = src[i]
    if (c === '"') {
      out.set(jsonPathKey(path), str())
    } else if (c === '{') {
      i++
      ws()
      if (src[i] === '}') {
        i++
        return
      }
      for (;;) {
        ws()
        const k = str()
        const key = JSON.parse(src.slice(k.start - 1, k.end + 1)) as string
        ws()
        if (src[i++] !== ':') fail()
        value([...path, key])
        ws()
        const d = src[i++]
        if (d === '}') return
        if (d !== ',') fail()
      }
    } else if (c === '[') {
      i++
      ws()
      if (src[i] === ']') {
        i++
        return
      }
      for (let n = 0; ; n++) {
        value([...path, n])
        ws()
        const d = src[i++]
        if (d === ']') return
        if (d !== ',') fail()
      }
    } else {
      LITERAL.lastIndex = i
      const m = LITERAL.exec(src)
      if (!m) fail()
      i += m![0].length
    }
  }
  try {
    value([])
    ws()
    return i === src.length ? out : null
  } catch {
    return null
  }
}

/**
 * For the raw characters of a JSON string literal (without quotes), the raw
 * index of every decoded character, plus one entry for the end. So a match at
 * decoded [s, e) sits at raw [map[s], map[e]).
 */
export function rawOffsets(raw: string): number[] {
  const map: number[] = []
  let r = 0
  while (r < raw.length) {
    map.push(r)
    r += raw[r] === '\\' ? (raw[r + 1] === 'u' ? 6 : 2) : 1
  }
  map.push(r)
  return map
}
