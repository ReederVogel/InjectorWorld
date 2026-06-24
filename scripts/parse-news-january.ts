/**
 * One-shot parser: converts the January 2026 news alerts TXT file into the
 * ContentImportPayload JSON shape that /api/admin/content-import expects.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/parse-news-january.ts
 * Outputs: data/news-january-2026.json
 */

import fs from 'fs'
import path from 'path'

const INPUT = path.resolve('C:\\Users\\risha\\Downloads\\injector_world_news_alerts_01_january_2026 (2).txt')
const OUTPUT = path.resolve('data/news-january-2026.json')

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SEP = '================================================================================'

function extractLine(block: string, label: RegExp): string {
  const m = block.match(label)
  return m ? (m[1] ?? '').trim() : ''
}

function extractSection(block: string, startRe: RegExp, endRe: RegExp): string {
  const startM = block.search(startRe)
  if (startM === -1) return ''
  const afterStart = block.slice(startM)
  // Capture inline text on the label line (after the colon) + continuation lines
  const labelMatch = afterStart.match(startRe)
  const firstNL = afterStart.indexOf('\n')
  const inlinePart = labelMatch
    ? afterStart.slice(labelMatch[0].length, firstNL !== -1 ? firstNL : undefined).trim()
    : ''
  const rest = firstNL !== -1 ? afterStart.slice(firstNL + 1) : ''
  const combined = [inlinePart, rest].filter(Boolean).join('\n')
  const endM = combined.search(endRe)
  return endM !== -1 ? combined.slice(0, endM).trim() : combined.trim()
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function isHeading(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 80) return false
  // All-caps lines with only letters, spaces, punctuation like & / - are headings.
  return /^[A-Z][A-Z &/\-']+$/.test(t) && t.split(/\s+/).length <= 7
}

function parseBody(bodyText: string): {
  introParagraphs: string[]
  sections: Array<{ heading: string; paragraphs: string[] }>
} {
  const lines = bodyText.split('\n')
  const introParagraphs: string[] = []
  const sections: Array<{ heading: string; paragraphs: string[] }> = []
  let current: { heading: string; paragraphs: string[] } | null = null
  let buf: string[] = []

  function flushBuf() {
    if (!buf.length) return
    const text = buf.join('\n')
    const paras = paragraphs(text)
    if (current) current.paragraphs.push(...paras)
    else introParagraphs.push(...paras)
    buf = []
  }

  for (const line of lines) {
    if (isHeading(line)) {
      flushBuf()
      current = { heading: line.trim(), paragraphs: [] }
      sections.push(current)
    } else {
      buf.push(line)
    }
  }
  flushBuf()

  return { introParagraphs, sections }
}

function parseAtAGlance(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*[•\-]\s*/, '').trim())
    .filter(Boolean)
}

function parseFaq(text: string): Array<{ question: string; answer: string }> {
  const items: Array<{ question: string; answer: string }> = []
  const qPattern = /^Q:\s*(.+)/
  const aPattern = /^A:\s*([\s\S]+?)(?=\nQ:|\s*$)/g

  const lines = text.split('\n')
  let q = ''
  let aBuf: string[] = []

  function flush() {
    if (q && aBuf.length) {
      const answer = aBuf.join(' ').replace(/\s+/g, ' ').trim()
      if (answer) items.push({ question: q, answer })
    }
    q = ''
    aBuf = []
  }

  for (const line of lines) {
    const qm = line.match(qPattern)
    if (qm) {
      flush()
      q = qm[1].trim()
    } else if (q) {
      // Strip leading "A: " or "   A: " prefix from answer continuation lines
      const stripped = line.replace(/^\s*A:\s*/, '').replace(/^\s{3}/, '')
      if (stripped) aBuf.push(stripped)
    }
  }
  flush()

  return items
}

function parseSources(text: string): Array<{ title: string; publisher: string; url: string }> {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*[•\-]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      // Format: "Publisher — Title — https://..."  or "Publisher — https://..."
      const urlMatch = line.match(/https?:\/\/\S+/)
      const url = urlMatch ? urlMatch[0] : ''
      const withoutUrl = line.replace(url, '').replace(/—\s*$/, '').trim()
      const parts = withoutUrl.split(/\s+—\s+/)
      const publisher = parts[0]?.trim() ?? ''
      const title = parts.slice(1).join(' — ').trim() || publisher
      return { title: title || publisher, publisher, url }
    })
    .filter((s) => s.url || s.title)
}

function tierToSlug(headerLine: string): string {
  const h = headerLine.toUpperCase()
  if (h.includes('TIER 1') || h.includes('AESTHETIC INJECTABLES')) return 'tier_1_aesthetic_injectables'
  if (h.includes('TIER 2') || h.includes('GLP-1')) return 'tier_2_glp1_weight_loss'
  if (h.includes('TIER 3') || h.includes('PEPTIDE')) return 'tier_3_peptides_longevity'
  if (h.includes('CROSS-TIER') || h.includes('CROSS TIER')) return 'cross_tier'
  if (h.includes('REGULATORY') || h.includes('SAFETY')) return 'regulatory_safety'
  return 'tier_1_aesthetic_injectables'
}

function tierToCategory(headerLine: string, subType: string): string {
  const h = (headerLine + ' ' + subType).toUpperCase()
  if (h.includes('REGULATION') || h.includes('REGULATORY') || h.includes('SAFETY')) return 'regulation'
  if (h.includes('COMPANY') || h.includes('ACQUISITION') || h.includes('MERGER')) return 'company'
  if (h.includes('LAUNCH') || h.includes('APPROVED') || h.includes('CLEARED')) return 'product-launch'
  if (h.includes('RESEARCH') || h.includes('STUDY') || h.includes('CLINICAL') || h.includes('TRIAL') || h.includes('DATA')) return 'research'
  if (h.includes('MARKET') || h.includes('INDUSTRY') || h.includes('CROSS-TIER') || h.includes('CONVERGENT')) return 'industry'
  return 'treatment-update'
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const text = fs.readFileSync(INPUT, 'utf8')

// Each REPORT has its header line between two === separators, then its body between the next two.
// Split all chunks and pair them: [header, body, header, body, ...]
const allChunks = text.split(SEP).map((b) => b.trim())

// Find pairs: header = chunk that starts with REPORT, body = next chunk
const reportPairs: Array<{ header: string; body: string }> = []
for (let i = 0; i < allChunks.length - 1; i++) {
  if (allChunks[i].startsWith('REPORT')) {
    reportPairs.push({ header: allChunks[i], body: allChunks[i + 1] ?? '' })
  }
}

const items: object[] = []

for (const { header, body: block } of reportPairs) {
  const firstLine = header.split('\n')[0] ?? ''
  const parts = firstLine.split('|').map((p) => p.trim())
  const tierPart = parts[1] ?? ''
  const subType = parts[2] ?? ''

  const title = extractLine(block, /^SEO TITLE:\s*(.+)/m)
  const slugRaw = extractLine(block, /^SLUG:\s*(.+)/m)
  const slug = slugRaw.replace(/^\/news(?:-alerts)?\//, '').replace(/^\//, '')
  const meta = extractLine(block, /^META:\s*(.+)/m)
  const excerpt = extractLine(block, /^EXCERPT:\s*(.+)/m)

  const kwLine = extractLine(block, /^KEYWORDS \(focus\):\s*(.+)/m)
  const focusMatch = kwLine.match(/^([^|]+)/)
  const secondaryMatch = kwLine.match(/\(secondary\):\s*(.+)/)
  const focusKeyword = focusMatch ? focusMatch[1].trim() : ''
  const secondaryKeywords = secondaryMatch
    ? secondaryMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const dateLine = extractLine(block, /^PUBLISH DATE:\s*(.+)/m)
  const pubMatch = dateLine.match(/PUBLISH DATE:\s*(\d{4}-\d{2}-\d{2})/i) ??
    block.match(/PUBLISH DATE:\s*(\d{4}-\d{2}-\d{2})/i)
  const updMatch = block.match(/LAST UPDATED:\s*(\d{4}-\d{2}-\d{2})/i)
  const publishedAt = pubMatch ? `${pubMatch[1]}T09:00:00.000Z` : '2026-01-31T09:00:00.000Z'
  const lastUpdatedAt = updMatch ? `${updMatch[1]}T09:00:00.000Z` : publishedAt

  const answerRaw = extractSection(block, /^ANSWER \(AEO snippet\):/m, /^BODY:/m)
  const answerSnippet = answerRaw.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

  const bodyRaw = extractSection(block, /^BODY:/m, /^AT A GLANCE/m)
  const { introParagraphs, sections } = parseBody(bodyRaw)

  const atAGlanceRaw = extractSection(block, /^AT A GLANCE/m, /^FAQ/m)
  const atAGlance = parseAtAGlance(atAGlanceRaw)

  const faqRaw = extractSection(block, /^FAQ/m, /^-+\s*JSON-LD/m)
  const faq = parseFaq(faqRaw)

  const sourcesRaw = extractSection(block, /^SOURCES:/m, /^DISCLAIMER:/m)
  const sources = parseSources(sourcesRaw)

  const tier = tierToSlug(tierPart)
  const category = tierToCategory(tierPart, subType)

  if (!title || !slug) {
    console.warn(`Skipping block (missing title or slug): ${firstLine}`)
    continue
  }

  items.push({
    status: 'draft',
    featured: false,
    tier,
    category,
    title,
    slug,
    excerpt,
    authorName: 'injector.world Editorial Team',
    medicalReviewer: { required: true, name: '', credentials: '', reviewedAt: '' },
    publishedAt,
    lastUpdatedAt,
    seo: {
      metaDescription: meta,
      canonicalPath: `/news/${slug}`,
      focusKeyword,
      secondaryKeywords,
    },
    body: {
      answerSnippet,
      introParagraphs,
      sections,
      atAGlance,
      faq,
      sources,
    },
  })
}

const output = {
  templateVersion: 'injector-world-news-prepared-v1',
  site: 'injector.world',
  contentKind: 'news',
  generationDate: '2026-01-31',
  contentMonth: '2026-01',
  defaultStatus: 'draft',
  items,
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf8')
console.log(`Parsed ${items.length} reports → ${OUTPUT}`)
