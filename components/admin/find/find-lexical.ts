/**
 * Replace text inside a live Lexical editor (the article body), for the Find
 * box's Replace / Replace all.
 *
 * The editor's text is grouped into the same blocks as lexicalUnits() in
 * find-engine.ts (paragraph, heading, list item, quote; links count as
 * inline), so "the k-th match" means the same thing here as in the results
 * list. Changes go through editor.update(), so Payload's own change handler
 * writes them to the form (Save still needed) and Ctrl+Z in the editor
 * undoes them like any typing.
 *
 * Formatting: the replacement takes the formatting of the text node where the
 * match starts (bold, italic, link). When a match spans several nodes, e.g.
 * "lip fil" + bold "ler", the following pieces are trimmed or removed and the
 * replacement sits in the first one.
 */

import {
  $getRoot,
  $isElementNode,
  $isLineBreakNode,
  $isTextNode,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type TextNode,
} from '@payloadcms/richtext-lexical/lexical'
import type { FindOptions, Span } from './find-engine'
import { findSpans } from './find-engine'

type Piece = { node: TextNode; at: number; len: number }
type LiveUnit = { text: string; pieces: Piece[] }

const isInline = (n: LexicalNode) => $isTextNode(n) || $isLineBreakNode(n) || ($isElementNode(n) && n.isInline())

/** Text blocks of the editor, in order. Call inside editor.read()/update(). */
function $liveUnits(): LiveUnit[] {
  const units: LiveUnit[] = []
  const collect = (n: LexicalNode, unit: LiveUnit) => {
    if ($isTextNode(n)) {
      const text = n.getTextContent()
      unit.pieces.push({ node: n, at: unit.text.length, len: text.length })
      unit.text += text
    } else if ($isLineBreakNode(n)) {
      unit.text += '\n'
    } else if ($isElementNode(n)) {
      for (const child of n.getChildren()) collect(child, unit)
    }
  }
  const visit = (el: ElementNode) => {
    const children = el.getChildren()
    const inline = children.filter(isInline)
    if (inline.length) {
      const unit: LiveUnit = { text: '', pieces: [] }
      for (const child of inline) collect(child, unit)
      if (unit.text) units.push(unit)
    }
    for (const child of children) if ($isElementNode(child) && !child.isInline()) visit(child)
  }
  for (const child of $getRoot().getChildren()) if ($isElementNode(child)) visit(child)
  return units
}

/** Replace one span of a unit. Pieces must still describe the nodes (work right to left). */
function $replaceSpan(unit: LiveUnit, span: Span, replacement: string) {
  const touched = unit.pieces.filter((p) => p.at < span.end && p.at + p.len > span.start)
  if (!touched.length) return
  const first = touched[0]
  const startOff = Math.max(0, span.start - first.at)
  if (touched.length === 1) {
    first.node.spliceText(startOff, Math.min(span.end, first.at + first.len) - first.at - startOff, replacement, false)
  } else {
    first.node.spliceText(startOff, first.len - startOff, replacement, false)
    for (const p of touched.slice(1, -1)) p.node.remove()
    const last = touched[touched.length - 1]
    const endOff = Math.min(span.end - last.at, last.len)
    if (endOff >= last.len) last.node.remove()
    else last.node.spliceText(0, endOff, '', false)
  }
  if (first.node.isAttached() && first.node.getTextContentSize() === 0) first.node.remove()
}

/**
 * Replace the k-th match (`which: k`) or every match (`which: 'all'`).
 * `expect` guards a single replace: the matched text must still be what the
 * results list showed, otherwise nothing changes (the body moved on).
 * Returns how many were replaced.
 */
export function replaceInEditor(
  editor: LexicalEditor,
  which: number | 'all',
  query: string,
  opts: FindOptions,
  replacement: string,
  expect?: string,
): number {
  let count = 0
  editor.update(
    () => {
      const units = $liveUnits()
      if (which === 'all') {
        for (const unit of units) {
          const spans = findSpans(unit.text, query, opts)
          for (const span of spans.reverse()) $replaceSpan(unit, span, replacement)
          count += spans.length
        }
        return
      }
      let k = 0
      for (const unit of units) {
        for (const span of findSpans(unit.text, query, opts)) {
          if (k++ !== which) continue
          if (expect !== undefined && unit.text.slice(span.start, span.end) !== expect) return
          $replaceSpan(unit, span, replacement)
          count = 1
          return
        }
      }
    },
    { discrete: true },
  )
  return count
}

/** The Lexical editor behind a contenteditable root (Lexical stores it on the element). */
export function editorOf(root: HTMLElement | undefined | null): LexicalEditor | null {
  return ((root as any)?.__lexicalEditor as LexicalEditor | undefined) ?? null
}
