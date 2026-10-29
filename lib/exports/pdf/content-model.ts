import { CELL_LINK, sitePath, tryParseTable, type TableCell } from '@/lib/render-lexical'
import { OFF_LABEL_TEXT, SAFETY_NOTICES } from '@/components/shared/FaqAccordionItem'
import type { AtAGlanceFact } from '@/components/shared/AtAGlanceList'
import type { GuideDetail } from '@/lib/guide-queries'
import type { NewsDetail } from '@/lib/news-queries'
import type { FaqBlock, FaqRow } from '@/lib/faqs/queries'

/**
 * A guide or news article flattened into plain data for the PDF worker
 * (render-worker.mjs). All parsing happens here, in the app's own TypeScript,
 * with the same helpers the pages use (tryParseTable, sitePath), so the worker
 * only lays out boxes and text and never re-implements content rules.
 *
 * Deliberately left out, per the export spec: images, the page url, published
 * and updated dates, author and reviewer bylines.
 */

export type Run = { text: string; bold?: boolean; italic?: boolean; href?: string }
export type TableBlock = {
  type: 'table'
  title?: string
  headers: string[]
  rows: { runs: Run[]; colSpan?: number }[][]
}
export type Block =
  | { type: 'heading'; level: 2 | 3 | 4; id?: string; runs: Run[] }
  | { type: 'paragraph'; runs: Run[] }
  | { type: 'list'; ordered: boolean; items: Block[][] }
  | { type: 'quote'; runs: Run[] }
  | { type: 'rule' }
  | TableBlock
export type GlanceItem = { type: 'fact'; text: string } | TableBlock
export type PdfFaq = {
  question: string
  answer: string
  detail?: string
  notes: { label: string; text: string; tone: 'error' | 'info' }[]
  link?: { label: string; href: string }
}
export type PdfDoc = {
  title: string
  intro?: string
  toc: { id: string; text: string; level: number }[]
  quickAnswer?: string
  atAGlance: GlanceItem[]
  body: Block[]
  faqSections: { id: string; heading: string; faqs: PdfFaq[]; seeAll?: { label: string; href: string } }[]
  sources: { title: string; href?: string; publisher?: string; date?: string }[]
}

type LexNode = {
  type: string
  text?: string
  format?: number
  tag?: string
  url?: string
  listType?: string
  fields?: { url?: string }
  children?: LexNode[]
}

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world').replace(/\/$/, '')
const BOLD = 1
const ITALIC = 2
const INLINE = new Set(['text', 'link', 'autolink', 'linebreak', 'tab'])

/** Site paths become absolute (a PDF has no host); only http(s) and mailto survive. */
function pdfHref(raw?: string): string | undefined {
  if (!raw) return undefined
  const href = sitePath(raw.trim())
  if (href.startsWith('/')) return SITE_URL + href
  return /^(https?:|mailto:)/i.test(href) ? href : undefined
}

function inlineRuns(nodes: LexNode[] | undefined, out: Run[], href?: string): Run[] {
  for (const n of nodes ?? []) {
    if (n.type === 'text') {
      const f = n.format ?? 0
      if (n.text) out.push({ text: n.text, bold: !!(f & BOLD) || undefined, italic: !!(f & ITALIC) || undefined, href })
    } else if (n.type === 'linebreak') {
      out.push({ text: '\n' })
    } else if (n.type === 'link' || n.type === 'autolink') {
      inlineRuns(n.children, out, pdfHref(n.fields?.url || n.url))
    } else if (n.children) {
      inlineRuns(n.children, out, href)
    }
  }
  return out
}

const runsText = (runs: Run[]) => runs.map((r) => r.text).join('').trim()

/** "[label](https://...)" inside a raw table cell, same rule as TableCellText. */
function cellRuns(text: string): Run[] {
  const runs: Run[] = []
  let last = 0
  for (const m of text.matchAll(CELL_LINK)) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) })
    runs.push({ text: m[1], href: pdfHref(m[2]) })
    last = m.index + m[0].length
  }
  if (last < text.length) runs.push({ text: text.slice(last) })
  return runs
}

function tableBlock(headers: string[], rows: TableCell[][], title?: string): TableBlock {
  return {
    type: 'table',
    title,
    headers,
    rows: rows.map((row) => row.map((c) => ({ runs: cellRuns(c.text), colSpan: c.colSpan }))),
  }
}

type Toc = PdfDoc['toc']

function listItem(item: LexNode, toc: Toc): Block[] {
  const blocks: Block[] = []
  let runs: Run[] = []
  const flush = () => {
    if (runsText(runs)) blocks.push({ type: 'paragraph', runs })
    runs = []
  }
  for (const c of item.children ?? []) {
    if (c.type === 'list') {
      flush()
      toBlocks([c], blocks, toc)
    } else {
      inlineRuns([c], runs)
    }
  }
  flush()
  return blocks
}

/** Mirrors renderNode() in lib/render-lexical.tsx, minus images. */
function toBlocks(nodes: LexNode[] | undefined, out: Block[], toc: Toc): Block[] {
  for (const n of nodes ?? []) {
    switch (n.type) {
      case 'paragraph': {
        const sole = n.children?.length === 1 && n.children[0].type === 'text' ? n.children[0].text ?? '' : null
        const table = sole ? tryParseTable(sole) : null
        if (table) {
          out.push(tableBlock(table.headers, table.rows))
        } else {
          const runs = inlineRuns(n.children, [])
          if (runsText(runs)) out.push({ type: 'paragraph', runs })
        }
        break
      }
      case 'heading': {
        const n2 = Number((n.tag || 'h2').slice(1)) || 2
        const level = n2 <= 2 ? 2 : n2 === 3 ? 3 : 4
        const runs = inlineRuns(n.children, [])
        const text = runsText(runs)
        if (!text) break
        // The site TOC lists h2/h3 only. Ids are positional, so two headings
        // with the same text still get their own jump target.
        const id = level < 4 ? `h${toc.length + 1}` : undefined
        if (id) toc.push({ id, text, level })
        out.push({ type: 'heading', level, id, runs })
        break
      }
      case 'list':
        out.push({ type: 'list', ordered: n.listType === 'number', items: (n.children ?? []).map((c) => listItem(c, toc)) })
        break
      case 'quote': {
        const runs = inlineRuns(n.children, [])
        if (runsText(runs)) out.push({ type: 'quote', runs })
        break
      }
      case 'horizontalrule':
        out.push({ type: 'rule' })
        break
      case 'upload':
        break // no images in the PDF
      default:
        if (n.children?.some((c) => INLINE.has(c.type))) {
          const runs = inlineRuns(n.children, [])
          if (runsText(runs)) out.push({ type: 'paragraph', runs })
        } else if (n.children) {
          toBlocks(n.children, out, toc)
        }
    }
  }
  return out
}

function glance(facts: AtAGlanceFact[] | undefined): GlanceItem[] {
  const items: GlanceItem[] = []
  for (const f of facts ?? []) {
    if (typeof f === 'string') {
      const t = f.startsWith('(table)') ? tryParseTable(f) : null
      if (t) items.push(tableBlock(t.headers, t.rows))
      else if (f.trim()) items.push({ type: 'fact', text: f })
    } else if (f && f.type === 'table' && Array.isArray(f.columns) && Array.isArray(f.rows)) {
      items.push(tableBlock(f.columns, f.rows.map((r) => r.map((text) => ({ text: String(text ?? '') }))), f.title))
    }
  }
  return items
}

type FaqLike = Partial<Pick<FaqRow, 'detail' | 'offLabel' | 'safetyFlag' | 'relatedGuideSlug' | 'relatedGuideTitle'>> & {
  question: string
  answer: string
}

function pdfFaq(f: FaqLike): PdfFaq {
  const notes: PdfFaq['notes'] = []
  if (f.offLabel) notes.push({ label: 'Off-label use.', text: OFF_LABEL_TEXT, tone: 'info' })
  const s = f.safetyFlag && f.safetyFlag !== 'none' ? SAFETY_NOTICES[f.safetyFlag] : undefined
  if (s) notes.push({ label: `${s.label}.`, text: s.text, tone: s.tone })
  return {
    question: f.question,
    answer: f.answer,
    detail: f.detail || undefined,
    notes,
    link: f.relatedGuideSlug
      ? {
          label: `Read the full guide${f.relatedGuideTitle ? `: ${f.relatedGuideTitle}` : ''}`,
          href: `${SITE_URL}/guides/${f.relatedGuideSlug}`,
        }
      : undefined,
  }
}

function build(opts: {
  title: string
  intro?: string
  body: any
  quickAnswer?: string
  atAGlance?: AtAGlanceFact[]
  ownFaqs?: FaqLike[]
  preview?: FaqBlock
  sources?: GuideDetail['sources']
}): PdfDoc {
  const toc: Toc = []
  const root = opts.body?.root ?? opts.body
  const body = toBlocks(Array.isArray(root?.children) ? root.children : [], [], toc)

  // Same two blocks and headings as the guide page: the article's own FAQs,
  // then the preview from the linked FAQ categories.
  const faqSections: PdfDoc['faqSections'] = []
  const own = (opts.ownFaqs ?? []).filter((f) => f?.question)
  if (own.length) faqSections.push({ id: 'faq', heading: 'Frequently asked questions', faqs: own.map(pdfFaq) })
  if (opts.preview?.faqs.length) {
    faqSections.push({
      id: 'faq-more',
      heading: own.length ? 'More common questions' : 'Frequently asked questions',
      faqs: opts.preview.faqs.map(pdfFaq),
      seeAll: opts.preview.seeAll
        ? { label: opts.preview.seeAll.label, href: `${SITE_URL}${opts.preview.seeAll.href}` }
        : undefined,
    })
  }
  for (const s of faqSections) toc.push({ id: s.id, text: s.heading, level: 2 })

  const sources = (opts.sources ?? [])
    .filter((s) => s?.title)
    .map((s) => ({
      title: s.title,
      href: pdfHref(s.url),
      publisher: s.publisher || undefined,
      date: s.publishedDate || undefined,
    }))
  if (sources.length) toc.push({ id: 'sources', text: 'Sources', level: 2 })

  return {
    title: opts.title,
    intro: opts.intro?.trim() || undefined,
    toc,
    quickAnswer: opts.quickAnswer?.trim() || undefined,
    atAGlance: glance(opts.atAGlance),
    body,
    faqSections,
    sources,
  }
}

export function guidePdfDoc(g: GuideDetail, preview: FaqBlock): PdfDoc {
  return build({
    title: g.title,
    intro: g.lede,
    body: g.body,
    quickAnswer: g.answerSnippet,
    atAGlance: g.atAGlance,
    ownFaqs: g.faq,
    preview,
    sources: g.sources,
  })
}

export function newsPdfDoc(n: NewsDetail): PdfDoc {
  return build({
    title: n.title,
    intro: n.excerpt,
    body: n.body,
    quickAnswer: n.answerSnippet,
    atAGlance: n.atAGlance,
    ownFaqs: n.faq,
    sources: n.sources,
  })
}
