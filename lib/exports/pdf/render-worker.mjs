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

function runs(list, key = 'r') {
  return (list ?? []).map((r, i) => {
    const style = {}
    if (r.bold) Object.assign(style, { fontWeight: 600, color: C.navy })
    if (r.italic) style.fontStyle = 'italic'
    if (r.href) return h(Link, { key: `${key}${i}`, src: r.href, style: { ...style, ...linkStyle } }, r.text)
    return h(Text, { key: `${key}${i}`, style }, r.text)
  })
}

function Table({ t }) {
  const cols = Math.max(t.headers.length, 1)
  const cell = (i, span) => ({
    flex: span || 1,
    padding: '4 6',
    borderLeftWidth: i ? 1 : 0,
    borderLeftColor: C.borderSubtle,
  })
  return h(
    View,
    { style: { marginBottom: 12 } },
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
  )
}

function Blocks({ blocks, tight }) {
  return blocks.map((b, i) => {
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
                  { key: ii, style: { flexDirection: 'row', marginBottom: 2 } },
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
  })
}

function Check() {
  return h(
    Svg,
    { width: 9, height: 9, viewBox: '0 0 24 24', style: { marginTop: 2.5, marginRight: 7 } },
    h(Polyline, { points: '20 6 9 17 4 12', fill: 'none', stroke: C.accent, strokeWidth: 2.5 }),
  )
}

function Faq({ f }) {
  return h(
    View,
    { style: { ...box, padding: '10 12', marginBottom: 6 } },
    h(Text, { style: { fontSize: 10, fontWeight: 600, color: C.navy, marginBottom: 4 }, minPresenceAhead: 24 }, f.question),
    h(Text, { style: { fontSize: 9.5 } }, f.answer),
    f.detail ? h(Text, { style: { fontSize: 9.5, marginTop: 4 } }, f.detail) : null,
    f.notes.map((n, i) =>
      h(
        View,
        {
          key: i,
          style: {
            marginTop: 6,
            padding: '5 8',
            borderRadius: 6,
            borderWidth: 1,
            borderColor: n.tone === 'error' ? '#F1D2D2' : '#D2D9F0',
            backgroundColor: n.tone === 'error' ? '#FDF5F5' : '#F5F7FD',
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
    f.link ? h(Link, { src: f.link.href, style: { ...linkStyle, fontSize: 9, marginTop: 6 } }, f.link.label) : null,
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
        h(Text, { style: { ...serif, fontSize: 22, lineHeight: 1.25, textAlign: 'center' } }, doc.title),
        doc.intro
          ? h(Text, { style: { fontFamily: 'Playfair', fontSize: 11.5, lineHeight: 1.55, textAlign: 'center', marginTop: 10 } }, doc.intro)
          : null,
      ),
      doc.toc.length
        ? h(
            View,
            { style: { ...box, marginBottom: 18 } },
            h(Text, { style: { fontSize: 10.5, fontWeight: 600, color: C.navy, marginBottom: 6 } }, 'On this page'),
            doc.toc.map((t, i) =>
              h(
                Link,
                {
                  key: i,
                  src: `#${t.id}`,
                  style: {
                    textDecoration: 'none',
                    fontSize: t.level === 3 ? 8.5 : 9.5,
                    color: t.level === 3 ? C.ink3 : C.ink2,
                    paddingLeft: t.level === 3 ? 12 : 0,
                    marginBottom: 3,
                  },
                },
                t.text,
              ),
            ),
          )
        : null,
      doc.quickAnswer
        ? h(
            View,
            { style: { backgroundColor: C.accentTint, borderWidth: 1, borderColor: C.accentSoft, borderRadius: 8, padding: '12 14', marginBottom: 16 } },
            h(Text, { style: { ...overline, color: C.accent } }, 'Quick answer'),
            h(Text, { style: { color: C.navy } }, doc.quickAnswer),
          )
        : null,
      doc.atAGlance.length
        ? h(
            View,
            { style: { ...box, marginBottom: 16 } },
            h(Text, { style: { ...overline, color: C.ink2 } }, 'At a glance'),
            doc.atAGlance.map((g, i) =>
              g.type === 'fact'
                ? h(View, { key: i, style: { flexDirection: 'row', marginBottom: 4, fontSize: 9 } }, h(Check), h(Text, { style: { flex: 1 } }, g.text))
                : h(Table, { key: i, t: g }),
            ),
          )
        : null,
      h(Blocks, { blocks: doc.body }),
      doc.faqSections.map((s) =>
        h(
          View,
          { key: s.id, style: { marginTop: 14 } },
          h(Text, { id: s.id, style: { ...serif, fontSize: 15.5, marginBottom: 8 }, minPresenceAhead: 60 }, s.heading),
          s.faqs.map((f, i) => h(Faq, { key: i, f })),
          s.seeAll
            ? h(Link, { src: s.seeAll.href, style: { fontSize: 9, fontWeight: 600, color: C.navy, marginTop: 4 } }, s.seeAll.label)
            : null,
        ),
      ),
      doc.sources.length
        ? h(
            View,
            { style: { ...box, marginTop: 16 } },
            h(Text, { id: 'sources', style: { fontSize: 10, fontWeight: 600, color: C.navy, marginBottom: 6 }, minPresenceAhead: 30 }, `Sources (${doc.sources.length})`),
            doc.sources.map((s, i) =>
              h(
                View,
                { key: i, style: { flexDirection: 'row', marginBottom: 4, fontSize: 8.5, lineHeight: 1.5 } },
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
              ),
            ),
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
