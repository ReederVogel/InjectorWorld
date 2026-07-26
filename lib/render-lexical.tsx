import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { InternalLinkPreview } from '@/components/shared/InternalLinkPreview'

type LexNode = {
  type: string
  text?: string
  format?: number
  tag?: string
  url?: string
  newTab?: boolean
  listType?: string
  fields?: {
    url?: string
    newTab?: boolean
    alt?: string
    // Internal-linking agent metadata (editorial-seeded or AI-suggested). When
    // present, the link renders with a hover preview card instead of a plain anchor.
    previewTitle?: string
    previewExcerpt?: string
    previewType?: string
  }
  value?: { url?: string; alt?: string; width?: number; height?: number }
  children?: LexNode[]
}

const BOLD = 1
const ITALIC = 2
const STRIKETHROUGH = 4
const UNDERLINE = 8
const CODE = 16

function applyFormat(text: string, format: number): React.ReactNode {
  let el: React.ReactNode = text
  if (format & CODE) el = <code className="lex-code">{el}</code>
  if (format & BOLD) el = <strong>{el}</strong>
  if (format & ITALIC) el = <em>{el}</em>
  if (format & STRIKETHROUGH) el = <s>{el}</s>
  if (format & UNDERLINE) el = <u>{el}</u>
  return el
}

const MD_TABLE_SEPARATOR_ROW = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/

type TableCell = { text: string; colSpan?: number }
type ParsedTable = { headers: string[]; rows: TableCell[][] }

function splitRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

// Cell delimiters seen across import batches inside "(table) " paragraphs,
// checked in this order (pipe first, since it's the most explicit and can't
// collide with the others). " - " must come last: it's the most permissive
// and would otherwise wrongly match text that also contains "::" or "--".
const TABLE_CELL_DELIMITERS = ['|', ' :: ', ' -- ', ' - ']

function splitTableRow(segment: string, delimiter: string): string[] {
  return segment.split(delimiter).map((c) => c.trim())
}

function detectTableDelimiter(headerSegment: string): string | null {
  for (const d of TABLE_CELL_DELIMITERS) {
    if (headerSegment.split(d).length >= 2) return d
  }
  return null
}

/**
 * Some guide/news content bakes tables into plain paragraph text using
 * encodings seen across import batches:
 *  - Standard Markdown: multi-line, "| a | b |\n| --- | --- |\n| c | d |".
 *  - "(table) " prefix: single line, rows separated by ";", cells separated by
 *    one of "|", "::", "--" or "-" depending on which batch wrote it, e.g.
 *    "(table) Attribute - PRP - PRF; Full name - Platelet-Rich Plasma - ...".
 * Returns null if the text doesn't match either shape (the common case --
 * most paragraphs are just prose).
 */
function tryParseTable(text: string): ParsedTable | null {
  if (text.includes('\n') && text.includes('|')) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    const sepIdx = lines.findIndex((l) => MD_TABLE_SEPARATOR_ROW.test(l))
    if (sepIdx > 0) {
      const headers = splitRow(lines[sepIdx - 1])
      const rows = lines.slice(sepIdx + 1).map((line) => splitRow(line).map((text) => ({ text })))
      if (rows.length > 0) return { headers, rows }
    }
  }

  if (text.startsWith('(table)')) {
    // Deliberately NOT trimmed here: a leading "- PRP - PRF" header (blank
    // corner cell before the first delimiter) only splits into an empty first
    // cell if the space before that leading "-" survives into the delimiter
    // match. Individual cells are trimmed after splitting, in splitTableRow.
    const segments = text.slice('(table)'.length).split(';').filter((s) => s.trim() !== '')
    if (segments.length < 2) return null

    const delimiter = detectTableDelimiter(segments[0])
    if (!delimiter) return null

    const headers = splitTableRow(segments[0], delimiter)
    const colCount = headers.length
    const rows: TableCell[][] = []

    for (let i = 1; i < segments.length; i++) {
      const cells = splitTableRow(segments[i], delimiter)

      if (cells.length === 1 && rows.length > 0) {
        // An extra ";" was used inside a cell's own text (e.g. "Liquid that
        // gels; can form a clot, gel or membrane"), which our row split
        // mistook for a new row. Glue this fragment back onto the last cell
        // of the previous row instead of showing it as a broken one-cell row.
        const prevRow = rows[rows.length - 1]
        const lastCell = prevRow[prevRow.length - 1]
        lastCell.text = `${lastCell.text}; ${cells[0]}`
        continue
      }

      if (cells.length >= colCount) {
        // Exact fit, or the same embedded-";" issue landed in the FINAL cell
        // of a row that otherwise split correctly -- fold the overflow parts
        // back together rather than dropping them.
        const row: TableCell[] = cells.slice(0, colCount - 1).map((text) => ({ text }))
        row.push({ text: cells.slice(colCount - 1).join(` ${delimiter.trim()} `) })
        rows.push(row)
        continue
      }

      // Fewer cells than the header row: the row clearly starts a new
      // attribute (unlike the single-fragment case above) but lost its
      // trailing column(s) to an embedded ";". Keep it as its own row and
      // span the last cell across the missing columns so the table grid
      // stays intact instead of looking jagged.
      const row: TableCell[] = cells.map((text) => ({ text }))
      row[row.length - 1].colSpan = colCount - cells.length + 1
      rows.push(row)
    }

    if (rows.length > 0) return { headers, rows }
  }

  return null
}

function renderNode(node: LexNode, key: number): React.ReactNode {
  switch (node.type) {
    case 'text': {
      const fmt = node.format ?? 0
      if (!fmt) return node.text ?? null
      return <React.Fragment key={key}>{applyFormat(node.text ?? '', fmt)}</React.Fragment>
    }
    case 'linebreak':
      return <br key={key} />
    case 'paragraph': {
      const soleText =
        node.children?.length === 1 && node.children[0].type === 'text' ? node.children[0].text ?? '' : null
      const table = soleText ? tryParseTable(soleText) : null
      if (table) {
        return (
          <div key={key} className="lex-table-wrap">
            <table>
              <thead>
                <tr>
                  {table.headers.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} colSpan={cell.colSpan}>
                        {cell.text}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      const children = node.children?.map((c, i) => renderNode(c, i)) ?? []
      const empty = children.every((c) => c === null || c === undefined || c === '')
      if (empty) return <br key={key} />
      return <p key={key}>{children}</p>
    }
    case 'heading': {
      const tag = (node.tag || 'h2') as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      const Tag = tag
      return <Tag key={key}>{node.children?.map((c, i) => renderNode(c, i))}</Tag>
    }
    case 'link': {
      const href = node.fields?.url || node.url || '#'
      const isExternal = node.fields?.newTab || node.newTab || href.startsWith('http')
      const children = node.children?.map((c, i) => renderNode(c, i))
      if (isExternal) {
        return (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        )
      }
      if (node.fields?.previewTitle) {
        return (
          <InternalLinkPreview
            key={key}
            href={href}
            title={node.fields.previewTitle}
            excerpt={node.fields.previewExcerpt}
            typeLabel={node.fields.previewType}
          >
            {children}
          </InternalLinkPreview>
        )
      }
      return (
        <Link key={key} href={href}>
          {children}
        </Link>
      )
    }
    case 'list': {
      const Tag = node.listType === 'number' ? 'ol' : 'ul'
      return <Tag key={key}>{node.children?.map((c, i) => renderNode(c, i))}</Tag>
    }
    case 'listitem':
      return <li key={key}>{node.children?.map((c, i) => renderNode(c, i))}</li>
    case 'quote':
      return <blockquote key={key}>{node.children?.map((c, i) => renderNode(c, i))}</blockquote>
    case 'horizontalrule':
      return <hr key={key} />
    case 'upload': {
      const src = node.value?.url
      const alt = node.value?.alt || ''
      if (!src) return null
      const w = node.value?.width || 800
      const h = node.value?.height || 450
      return (
        <figure key={key} className="lex-figure">
          <Image src={src} alt={alt} width={w} height={h} className="lex-image" />
          {alt && <figcaption className="lex-caption">{alt}</figcaption>}
        </figure>
      )
    }
    default:
      if (node.children) {
        return (
          <React.Fragment key={key}>
            {node.children.map((c, i) => renderNode(c, i))}
          </React.Fragment>
        )
      }
      return null
  }
}

export function RenderLexical({ content }: { content: any }) {
  if (!content || typeof content !== 'object') return null
  const root = content.root ?? content
  if (!Array.isArray(root?.children) || root.children.length === 0) return null
  return (
    <div className="prose-guide">
      {root.children.map((node: LexNode, i: number) => renderNode(node, i))}
    </div>
  )
}
