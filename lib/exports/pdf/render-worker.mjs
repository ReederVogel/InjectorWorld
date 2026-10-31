// PDF layout for the Guides & News export. Runs in a worker thread (see
// lib/exports/run-pdf-export.ts) so PDF layout never blocks the web server's
// event loop. Plain JS on purpose: Node runs this file directly, it is never
// bundled by Next. Input is a PdfDoc (lib/exports/pdf/content-model.ts),
// already parsed; this file only draws it.
import { parentPort } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import React from 'react'
import { Document, Font, Link, Page, Polyline, Svg, Text, View, renderToBuffer } from '@react-pdf/renderer'

// Linux keeps a nice value per thread, so this lowers only this worker:
// live page requests on the main thread win the CPU. On Windows it would
// reprioritise the whole process, so dev skips it.
if (process.platform === 'linux') {
  try {
    os.setPriority(19)
  } catch {}
}

const font = (file) => fileURLToPath(new URL(`./fonts/${file}`, import.meta.url))

// Called before EVERY document. Fonts reused across renders in one process
// corrupt the next PDFs: lines break one letter late, mid-word, and copied
// text comes out wrong ("crow8s"). Font.reset() does not help (it nulls the
// data but never reloads it), so the store is cleared and rebuilt instead.
function registerFonts() {
  Font.clear()
  // clear() also drops react-pdf's built-in default family, which it still looks up.
  Font.register({
    family: 'Helvetica',
    fonts: [{ src: 'Helvetica' }, { src: 'Helvetica-Bold', fontWeight: 700 }],
  })
  Font.register({
    family: 'Inter',
    fonts: [
      { src: font('Inter-400.ttf') },
      { src: font('Inter-400-italic.ttf'), fontStyle: 'italic' },
      { src: font('Inter-600.ttf'), fontWeight: 600 },
      { src: font('Inter-600-italic.ttf'), fontWeight: 600, fontStyle: 'italic' },
    ],
  })
  Font.register({ family: 'Playfair', src: font('PlayfairDisplay-500.ttf'), fontWeight: 500 })
  // Default hyphenation splits words across lines ("treat-/ment"); keep them whole, like the site.
  Font.registerHyphenationCallback((word) => [word])
  // Load every face now. react-pdf only preloads the faces it spots in the
  // tree, and a fresh store has nothing cached to fall back on.
  return Promise.all(
    [
      ['Helvetica', 400],
      ['Helvetica', 700],
      ['Inter', 400],
      ['Inter', 400, 'italic'],
      ['Inter', 600],
      ['Inter', 600, 'italic'],
      ['Playfair', 500],
    ].map(([fontFamily, fontWeight, fontStyle = 'normal']) => Font.load({ fontFamily, fontWeight, fontStyle })),
  )
}

// Site tokens (CLAUDE.md design system).
const C = {
  navy: '#0B1B34',
  ink2: '#475569',
  ink3: '#5F6E84',
  accent: '#2A7560',
  accentSoft: '#E6F2EE',
  accentTint: '#F5FAF8',
  border: '#E2E8F0',
  borderSubtle: '#EEF1F5',
  surface: '#F7F8FA',
  warm: '#FAF7F2',
  error: '#B91C1C',
  info: '#1E40AF',
}

const h = React.createElement
const serif = { fontFamily: 'Playfair', fontWeight: 500, color: C.navy }
const box = { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: '12 14' }
const overline = { fontSize: 7.5, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }
const linkStyle = { color: C.accent, textDecoration: 'underline' }

// A row that pairs a marker (tick, bullet, number) with text moves to the next
// page whole: left to split, react-pdf keeps the marker on one page and sends
// the text to the next (41 of 225 PDFs, 2026-11-01). Short rows only: a
// non-breaking row taller than the page has its end cut off.
const KEEP_WHOLE_CHARS = 1200
const runsChars = (list) => (list ?? []).reduce((n, r) => n + r.text.length, 0)
const blocksChars = (blocks) =>
  blocks.reduce(
    (n, b) => n + (b.type === 'table' ? Infinity : b.items ? b.items.reduce((m, it) => m + blocksChars(it), 0) : runsChars(b.runs)),
    0,
  )
const canSplit = (chars) => chars > KEEP_WHOLE_CHARS
// For a box of rows, each row costs at least a full line (~90 characters), so
// many short rows count as tall: a 19-entry contents box kept whole once left
// page 1 empty.
const rowsChars = (lengths) => lengths.reduce((n, len) => n + Math.max(len, 90), 0)

// Space below a box lives in a separate spacer, and a box's bottom padding on
// its last row. When only trailing space misses the page, react-pdf otherwise
// throws the whole box to the next page or leaves an empty slice of it there
// (tested 2026-11-01: 4 of 8 break positions went wrong, 0 of 8 with this).
const gap = (height) => h(View, { style: { height } })

function runs(list, key = 'r') {
  return (list ?? []).map((r, i) => {
    const style = {}
    if (r.bold) Object.assign(style, { fontWeight: 600, color: C.navy })
    if (r.italic) style.fontStyle = 'italic'
    if (r.href) return h(Link, { key: `${key}${i}`, src: r.href, style: { ...style, ...linkStyle } }, r.text)
    return h(Text, { key: `${key}${i}`, style }, r.text)
  })
}

function Table({ t, after = 12 }) {
  const cols = Math.max(t.headers.length, 1)
  const cell = (i, span) => ({
    flex: span || 1,
    padding: '4 6',
    borderLeftWidth: i ? 1 : 0,
    borderLeftColor: C.borderSubtle,
  })
  return h(
    React.Fragment,
    null,
    t.title ? h(Text, { style: { fontSize: 9, fontWeight: 600, color: C.navy, marginBottom: 4 } }, t.title) : null,
    h(
      View,
      { style: { borderWidth: 1, borderColor: C.border, borderRadius: 6, fontSize: 8.5, lineHeight: 1.45 } },
      h(
        View,
        { style: { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }, wrap: false },
        t.headers.map((text, i) => h(Text, { key: i, style: { ...cell(i), fontWeight: 600, color: C.navy } }, text)),
      ),
      t.rows.map((row, ri) =>
        h(
          View,
          {
            key: ri,
            wrap: false,
            style: { flexDirection: 'row', borderTopWidth: ri ? 1 : 0, borderTopColor: C.borderSubtle },
          },
          row.slice(0, cols).map((c, ci) => h(Text, { key: ci, style: cell(ci, c.colSpan) }, runs(c.runs))),
        ),
      ),
    ),
    gap(after),
  )
}

// Headings stay with the block after them (a run of headings counts as one),
// so no page ends on a lone heading. react-pdf's minPresenceAhead alone missed
// this on 3 of 225 PDFs.
function Blocks({ blocks, tight }) {
  const out = []
  for (let i = 0; i < blocks.length; i++) {
    let j = i
    while (blocks[j]?.type === 'heading') j++
    const group = blocks.slice(i, j + 1)
    if (j > i && j < blocks.length && !canSplit(blocksChars(group))) {
      out.push(h(View, { key: i, wrap: false }, group.map((b, k) => block(b, k, tight))))
      i = j
    } else {
      out.push(block(blocks[i], i, tight))
    }
  }
  return out
}

function block(b, i, tight) {
    switch (b.type) {
      case 'heading': {
        const style =
          b.level === 2
            ? { ...serif, fontSize: 15.5, lineHeight: 1.3, marginTop: 14, marginBottom: 7 }
            : b.level === 3
              ? { ...serif, fontSize: 12.5, lineHeight: 1.3, marginTop: 10, marginBottom: 5 }
              : { fontSize: 10.5, fontWeight: 600, color: C.navy, marginTop: 8, marginBottom: 4 }
        return h(Text, { key: i, id: b.id, style, minPresenceAhead: 40 }, runs(b.runs))
      }
      case 'paragraph':
        return h(Text, { key: i, style: { marginBottom: tight ? 2 : 9 } }, runs(b.runs))
      case 'list':
        return h(
          View,
          { key: i, style: { marginBottom: tight ? 2 : 9 } },
          b.items.map((item, ii) =>
            item[0]?.type === 'list'
              ? h(View, { key: ii, style: { paddingLeft: 14 } }, h(Blocks, { blocks: item, tight: true }))
              : h(
                  View,
                  { key: ii, wrap: canSplit(blocksChars(item)), style: { flexDirection: 'row', marginBottom: 2 } },
                  h(Text, { style: { width: 14, color: C.ink3 } }, b.ordered ? `${ii + 1}.` : '•'),
                  h(View, { style: { flex: 1 } }, h(Blocks, { blocks: item, tight: true })),
                ),
          ),
        )
      case 'quote':
        return h(
          View,
          { key: i, style: { borderLeftWidth: 3, borderLeftColor: C.accent, padding: '4 0 4 12', margin: '6 0 12' } },
          h(Text, null, runs(b.runs)),
        )
      case 'rule':
        return h(View, { key: i, style: { borderTopWidth: 1, borderTopColor: C.border, margin: '14 0' } })
      case 'table':
        return h(Table, { key: i, t: b })
      default:
        return null
    }
}

function Check() {
  return h(
    Svg,
    { width: 9, height: 9, viewBox: '0 0 24 24', style: { marginTop: 2.5, marginRight: 7 } },
    h(Polyline, { points: '20 6 9 17 4 12', fill: 'none', stroke: C.accent, strokeWidth: 2.5 }),
  )
}

// The last row of a box carries the box's bottom padding (see gap()).
function tocLink(t, i, last) {
  return h(
    Link,
    {
      key: i,
      src: `#${t.id}`,
      style: {
        textDecoration: 'none',
        fontSize: t.level === 3 ? 8.5 : 9.5,
        color: t.level === 3 ? C.ink3 : C.ink2,
        paddingLeft: t.level === 3 ? 12 : 0,
        marginBottom: last ? 12 : 3,
      },
    },
    t.text,
  )
}

const glanceChars = (g) => (g.type === 'fact' ? g.text.length : Infinity)

function glanceRow(g, i, last) {
  if (g.type !== 'fact') return h(Table, { key: i, t: g, after: last ? 24 : 12 })
  return h(
    View,
    { key: i, wrap: canSplit(g.text.length), style: { flexDirection: 'row', marginBottom: last ? 16 : 4, fontSize: 9 } },
    h(Check),
    h(Text, { style: { flex: 1 } }, g.text),
  )
}

const sourceChars = (s) => s.title.length + (s.publisher?.length ?? 0)

function sourceRow(s, i, last) {
  return h(
    View,
    {
      key: i,
      wrap: canSplit(sourceChars(s)),
      style: { flexDirection: 'row', marginBottom: last ? 16 : 4, fontSize: 8.5, lineHeight: 1.5 },
    },
    h(Text, { style: { width: 16, fontWeight: 600, color: C.ink3 } }, `${i + 1}.`),
    h(
      Text,
      { style: { flex: 1 } },
      s.href
        ? h(Link, { src: s.href, style: { color: C.accent, fontWeight: 600, textDecoration: 'none' } }, s.title)
        : h(Text, { style: { color: C.navy, fontWeight: 600 } }, s.title),
      s.publisher ? h(Text, { style: { color: C.ink3 } }, `, ${s.publisher}`) : null,
      s.date ? h(Text, { style: { color: C.ink3 } }, ` (${s.date})`) : null,
    ),
  )
}

const faqChars = (f) =>
  f.question.length + f.answer.length + (f.detail?.length ?? 0) + f.notes.reduce((n, x) => n + x.text.length, 0)

function Faq({ f }) {
  // Each part takes extra style, so the last one can carry the bottom padding.
  const parts = [
    (x) => h(Text, { style: { fontSize: 9.5, ...x } }, f.answer),
    f.detail ? (x) => h(Text, { style: { fontSize: 9.5, marginTop: 4, ...x } }, f.detail) : null,
    ...f.notes.map((n) => (x) =>
      h(
        View,
        {
          style: {
            marginTop: 6,
            padding: '5 8',
            borderRadius: 6,
            borderWidth: 1,
            borderColor: n.tone === 'error' ? '#F1D2D2' : '#D2D9F0',
            backgroundColor: n.tone === 'error' ? '#FDF5F5' : '#F5F7FD',
            ...x,
          },
        },
        h(
          Text,
          { style: { fontSize: 8.5 } },
          h(Text, { style: { fontWeight: 600, color: n.tone === 'error' ? C.error : C.info } }, `${n.label} `),
          n.text,
        ),
      ),
    ),
    f.link ? (x) => h(Link, { src: f.link.href, style: { ...linkStyle, fontSize: 9, marginTop: 6, ...x } }, f.link.label) : null,
  ].filter(Boolean)
  return h(
    React.Fragment,
    null,
    h(
      View,
      { wrap: canSplit(faqChars(f)), style: { ...box, padding: '10 12 0' } },
      h(Text, { style: { fontSize: 10, fontWeight: 600, color: C.navy, marginBottom: 4 }, minPresenceAhead: 24 }, f.question),
      parts.map((part, i) => h(React.Fragment, { key: i }, part(i === parts.length - 1 ? { marginBottom: 10 } : {}))),
    ),
    gap(6),
  )
}

function ContentPdf({ doc }) {
  return h(
    Document,
    { title: doc.title, creator: 'injector.world', producer: 'injector.world' },
    h(
      Page,
      {
        size: 'LETTER',
        style: { padding: '50 58 58', fontFamily: 'Inter', fontSize: 10, color: C.ink2 },
      },
      h(Text, {
        fixed: true,
        style: { position: 'absolute', bottom: 26, left: 0, right: 0, textAlign: 'center', fontSize: 8, color: C.ink3 },
        render: ({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`,
      }),
      // lineHeight lives on this wrapper, not on Page: on Page, react-pdf
      // silently drops the page-number text above. fontSize must sit beside
      // it, or the ratio is taken against react-pdf's 18pt default.
      h(
        View,
        { style: { fontSize: 10, lineHeight: 1.6 } },
      // Title band, like the warm hero on the site.
      h(
        View,
        { style: { backgroundColor: C.warm, borderRadius: 8, padding: '24 28', marginBottom: 18, alignItems: 'center' } },
        h(Link, { src: doc.url, style: { fontSize: 8.5, color: C.accent, textDecoration: 'none', marginBottom: 10 } }, doc.url),
        h(Text, { style: { ...serif, fontSize: 22, lineHeight: 1.25, textAlign: 'center' } }, doc.title),
        doc.intro
          ? h(Text, { style: { fontFamily: 'Playfair', fontSize: 11.5, lineHeight: 1.55, textAlign: 'center', marginTop: 10 } }, doc.intro)
          : null,
      ),
      // Short boxes never split; a split box can leave an empty slice of itself
      // at a page edge. Long boxes split, with their label kept on the first row.
      // The contents box always may split: it sits right under the title, and
      // moving it whole can leave page 1 nearly empty.
      doc.toc.length
        ? h(
            View,
            { style: { ...box, paddingBottom: 0 } },
            h(
              View,
              { wrap: false },
              h(Text, { style: { fontSize: 10.5, fontWeight: 600, color: C.navy, marginBottom: 6 } }, 'On this page'),
              tocLink(doc.toc[0], 0, doc.toc.length === 1),
            ),
            doc.toc.slice(1).map((t, i) => tocLink(t, i + 1, i + 2 === doc.toc.length)),
          )
        : null,
      doc.toc.length ? gap(18) : null,
      doc.quickAnswer
        ? h(
            View,
            {
              wrap: canSplit(doc.quickAnswer.length),
              style: { backgroundColor: C.accentTint, borderWidth: 1, borderColor: C.accentSoft, borderRadius: 8, padding: '12 14 0' },
            },
            h(Text, { style: { ...overline, color: C.accent } }, 'Quick answer'),
            h(Text, { style: { color: C.navy, marginBottom: 12 } }, doc.quickAnswer),
          )
        : null,
      doc.quickAnswer ? gap(16) : null,
      doc.atAGlance.length
        ? h(
            View,
            { wrap: canSplit(rowsChars(doc.atAGlance.map(glanceChars))), style: { ...box, paddingBottom: 0 } },
            h(
              View,
              { wrap: canSplit(glanceChars(doc.atAGlance[0])) },
              h(Text, { style: { ...overline, color: C.ink2 } }, 'At a glance'),
              glanceRow(doc.atAGlance[0], 0, doc.atAGlance.length === 1),
            ),
            doc.atAGlance.slice(1).map((g, i) => glanceRow(g, i + 1, i + 2 === doc.atAGlance.length)),
          )
        : null,
      doc.atAGlance.length ? gap(16) : null,
      h(Blocks, { blocks: doc.body }),
      doc.faqSections.map((s) =>
        h(
          View,
          { key: s.id, style: { marginTop: 14 } },
          // The heading travels with the first question, same rule as body headings.
          h(
            View,
            { wrap: canSplit(s.heading.length + faqChars(s.faqs[0])) },
            h(Text, { id: s.id, style: { ...serif, fontSize: 15.5, marginBottom: 8 }, minPresenceAhead: 60 }, s.heading),
            h(Faq, { f: s.faqs[0] }),
          ),
          s.faqs.slice(1).map((f, i) => h(Faq, { key: i, f })),
          s.seeAll
            ? h(Link, { src: s.seeAll.href, style: { fontSize: 9, fontWeight: 600, color: C.navy, marginTop: 4 } }, s.seeAll.label)
            : null,
        ),
      ),
      doc.sources.length
        ? h(
            View,
            { wrap: canSplit(rowsChars(doc.sources.map(sourceChars))), style: { ...box, paddingBottom: 0, marginTop: 16 } },
            h(
              View,
              { wrap: canSplit(sourceChars(doc.sources[0])) },
              h(Text, { id: 'sources', style: { fontSize: 10, fontWeight: 600, color: C.navy, marginBottom: 6 } }, `Sources (${doc.sources.length})`),
              sourceRow(doc.sources[0], 0, doc.sources.length === 1),
            ),
            doc.sources.slice(1).map((s, i) => sourceRow(s, i + 1, i + 2 === doc.sources.length)),
          )
        : null,
      ),
    ),
  )
}

parentPort.on('message', async (doc) => {
  try {
    await registerFonts()
    const pdf = await renderToBuffer(h(ContentPdf, { doc }))
    parentPort.postMessage({ ok: true, pdf })
  } catch (err) {
    parentPort.postMessage({ ok: false, error: String(err?.message ?? err) })
  }
})
