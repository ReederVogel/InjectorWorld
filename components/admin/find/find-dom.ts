/**
 * DOM side of the admin "Find in this article" box: locate a field on the
 * Payload edit page, scroll a match into view, select it for editing, and
 * paint highlights in the three kinds of editor on the page:
 *
 *   - text inputs and textareas: highlight boxes drawn over the field, since
 *     nothing inside a <textarea> can be styled;
 *   - the Lexical body editor: the CSS Custom Highlight API, which colours a
 *     DOM Range without touching the editor's DOM (Lexical would fight that);
 *   - JSON fields (Monaco code editor): Monaco's own decorations.
 *
 * Payload markup this relies on (checked against @payloadcms/ui 3.90.2):
 *   - text and textarea controls carry id `field-<path with . as __>`;
 *   - the Lexical field wrapper carries `data-field-path="<path>"`;
 *   - the JSON field has no id, but its <label for> uses the same field id;
 *   - only the ACTIVE tab's fields are rendered (`.tabs-field__tab-button`).
 */

import type { FindField, FindOptions, Span } from './find-engine'
import { findSpans, jsonPathKey, jsonStringPositions, rawOffsets } from './find-engine'

export const HIGHLIGHT_ALL = 'iw-find'
export const HIGHLIGHT_CURRENT = 'iw-find-current'

export type Located = {
  wrap: HTMLElement
  input?: HTMLInputElement | HTMLTextAreaElement
  editable?: HTMLElement
}

export const fieldDomId = (path: string) => `field-${path.replace(/\./g, '__')}`

const esc = (s: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s)

function byFieldId(form: HTMLElement, id: string): HTMLElement | null {
  // Inside a drawer Payload suffixes ids with the edit depth (`field-title-2`).
  return form.querySelector<HTMLElement>(`#${esc(id)}`) ?? form.querySelector<HTMLElement>(`[id^="${id}-"]`)
}

export function locateField(form: HTMLElement, field: FindField): Located | null {
  const id = fieldDomId(field.path)
  if (field.kind === 'text' || field.kind === 'textarea') {
    const input = byFieldId(form, id) as HTMLInputElement | HTMLTextAreaElement | null
    if (!input || !('value' in input)) return null
    return { wrap: (input.closest('.field-type') as HTMLElement) ?? input, input }
  }
  if (field.kind === 'richText') {
    const wrap = form.querySelector<HTMLElement>(`[data-field-path="${field.path}"]`)
    const editable = wrap?.querySelector<HTMLElement>('[contenteditable="true"]')
    return wrap && editable ? { wrap, editable } : null
  }
  const label =
    form.querySelector<HTMLElement>(`label[for="${id}"]`) ?? form.querySelector<HTMLElement>(`label[for^="${id}-"]`)
  const wrap = label?.closest<HTMLElement>('.field-type')
  return wrap ? { wrap } : null
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

export async function waitFor<T>(fn: () => T | null | undefined, timeoutMs: number): Promise<T | null> {
  const until = performance.now() + timeoutMs
  for (;;) {
    const v = fn()
    if (v) return v
    if (performance.now() > until) return null
    await nextFrame()
  }
}

/**
 * Locate a field, switching tabs if it lives in one that is not showing.
 * Leaves the original tab active again if the field is found nowhere.
 */
export async function revealField(form: HTMLElement, field: FindField): Promise<Located | null> {
  const found = locateField(form, field)
  if (found) return found
  const buttons = Array.from(form.querySelectorAll<HTMLButtonElement>('.tabs-field__tab-button'))
  const original = buttons.find((b) => b.classList.contains('tabs-field__tab-button--active'))
  for (const button of buttons) {
    if (button === original) continue
    button.click()
    const loc = await waitFor(() => locateField(form, field), 800)
    if (loc) return loc
  }
  original?.click()
  return null
}

/* ── Scrolling ─────────────────────────────────────────────────────────── */

function scrollParent(el: Element): HTMLElement {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && p.scrollHeight > p.clientHeight + 1) return p
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement
}

/** Bottom edge of the sticky bar that holds Save (and this box), in viewport px. */
export function stickyBottom(form: HTMLElement): number {
  const bar = form.querySelector('.doc-controls') ?? document.querySelector('.doc-controls')
  return bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0
}

/** Scroll so `rect` sits mid-screen, unless it is already comfortably in view. */
export function scrollRectIntoView(rect: DOMRect, anchor: Element, topInset: number) {
  const sp = scrollParent(anchor)
  const isRoot = sp === document.scrollingElement || sp === document.documentElement
  const top = isRoot ? 0 : sp.getBoundingClientRect().top
  const height = isRoot ? window.innerHeight : sp.clientHeight
  const visibleTop = Math.max(top, topInset) + 16
  const visibleBottom = top + height - 32
  if (rect.top >= visibleTop && rect.bottom <= visibleBottom) return
  const middle = (Math.max(top, topInset) + top + height) / 2
  sp.scrollTop += rect.top + rect.height / 2 - middle
}

/* ── Text inputs and textareas ─────────────────────────────────────────── */

const MIRROR_PROPS = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch', 'letterSpacing',
  'lineHeight', 'textTransform', 'textIndent', 'wordSpacing', 'tabSize', 'wordBreak',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
] as const

/**
 * The control's padding box in viewport px, minus any scrollbar. Built from
 * the computed borders because for an <input> Chrome reports clientLeft and
 * clientWidth for the inner text box (padding included in clientLeft), not
 * for the padding box as it does for a <textarea>.
 */
function paddingBox(el: HTMLInputElement | HTMLTextAreaElement): DOMRect {
  const cs = getComputedStyle(el)
  const box = el.getBoundingClientRect()
  const bl = parseFloat(cs.borderLeftWidth) || 0
  const bt = parseFloat(cs.borderTopWidth) || 0
  const isInput = el.tagName === 'INPUT'
  const width = isInput ? box.width - bl - (parseFloat(cs.borderRightWidth) || 0) : el.clientWidth
  const height = isInput ? box.height - bt - (parseFloat(cs.borderBottomWidth) || 0) : el.clientHeight
  return new DOMRect(box.left + bl, box.top + bt, width, height)
}

/**
 * Rects of each span inside a text control, relative to the control's padding
 * box and ignoring its own scroll. Measured with an off-screen copy of the
 * control's text that wraps exactly like the control does.
 */
export function measureSpans(el: HTMLInputElement | HTMLTextAreaElement, spans: Span[]): DOMRect[][] {
  if (!spans.length) return []
  const cs = getComputedStyle(el)
  const isInput = el.tagName === 'INPUT'
  const inner = paddingBox(el)
  const m = document.createElement('div')
  for (const p of MIRROR_PROPS) (m.style as any)[p] = (cs as any)[p]
  Object.assign(m.style, {
    position: 'absolute',
    visibility: 'hidden',
    top: '0',
    left: '-100000px',
    boxSizing: 'content-box',
    border: '0',
    overflow: 'hidden',
    width: `${inner.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)}px`,
    whiteSpace: isInput ? 'pre' : 'pre-wrap',
    overflowWrap: isInput ? 'normal' : 'break-word',
  })
  if (isInput) {
    // An input centres its single line vertically in its content box.
    m.style.lineHeight = `${inner.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)}px`
  }
  const value = el.value
  const marks: HTMLSpanElement[] = []
  let pos = 0
  for (const s of spans) {
    m.append(document.createTextNode(value.slice(pos, s.start)))
    const mark = document.createElement('span')
    mark.textContent = value.slice(s.start, s.end)
    m.append(mark)
    marks.push(mark)
    pos = s.end
  }
  m.append(document.createTextNode(value.slice(pos) + '\u200b'))
  document.body.append(m)
  const base = m.getBoundingClientRect()
  const out = marks.map((mark) =>
    Array.from(mark.getClientRects()).map((r) => new DOMRect(r.left - base.left, r.top - base.top, r.width, r.height)),
  )
  m.remove()
  return out
}

/** Convert a rect from measureSpans to viewport coordinates. */
export function toViewport(el: HTMLInputElement | HTMLTextAreaElement, r: DOMRect): DOMRect {
  const inner = paddingBox(el)
  return new DOMRect(inner.left + r.x - el.scrollLeft, inner.top + r.y - el.scrollTop, r.width, r.height)
}

/** Scroll a textarea's own content so the span is visible (field-sizing may make this a no-op). */
export function revealInsideControl(el: HTMLInputElement | HTMLTextAreaElement, rel: DOMRect) {
  if (el.scrollHeight > el.clientHeight + 1) {
    if (rel.y < el.scrollTop || rel.y + rel.height > el.scrollTop + el.clientHeight) {
      el.scrollTop = Math.max(0, rel.y - el.clientHeight / 2)
    }
  }
  if (el.scrollWidth > el.clientWidth + 1) {
    if (rel.x < el.scrollLeft || rel.x + rel.width > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = Math.max(0, rel.x - el.clientWidth / 2)
    }
  }
}

/** A fixed layer of highlight boxes drawn over text controls. */
export class OverlayLayer {
  private layer: HTMLDivElement

  constructor() {
    this.layer = document.createElement('div')
    this.layer.setAttribute('aria-hidden', 'true')
    this.layer.dataset.iwFindLayer = ''
    // Below Payload's sticky Save bar (z-index 5), above the fields.
    Object.assign(this.layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '3' })
    document.body.append(this.layer)
  }

  clear() {
    this.layer.replaceChildren()
  }

  /** Draw `rect` clipped to `clip` (the visible part of the field). */
  box(rect: DOMRect, clip: DOMRect, current: boolean) {
    const left = Math.max(rect.left, clip.left)
    const top = Math.max(rect.top, clip.top)
    const right = Math.min(rect.right, clip.right)
    const bottom = Math.min(rect.bottom, clip.bottom)
    if (right - left < 1 || bottom - top < 1) return
    const b = document.createElement('div')
    Object.assign(b.style, {
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${right - left}px`,
      height: `${bottom - top}px`,
      borderRadius: '2px',
      background: current ? 'rgba(249, 115, 22, 0.45)' : 'rgba(250, 204, 21, 0.35)',
      boxShadow: current ? '0 0 0 1px rgba(249, 115, 22, 0.95)' : 'none',
    })
    this.layer.append(b)
  }

  destroy() {
    this.layer.remove()
  }
}

/** The visible area of a text control's content, also cut below the sticky bar. */
export function controlClip(el: HTMLInputElement | HTMLTextAreaElement, topInset: number): DOMRect {
  const inner = paddingBox(el)
  const top = Math.max(inner.top, topInset)
  const bottom = Math.min(inner.bottom, window.innerHeight)
  return new DOMRect(inner.left, top, inner.width, Math.max(0, bottom - top))
}

/* ── Lexical body editor ───────────────────────────────────────────────── */

const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'TD', 'TH'])

type Segment = { text: string; parts: { node: Text; at: number }[] }

/**
 * The editor's text grouped by block element, the same grouping as
 * lexicalUnits() in find-engine.ts. Non-editable islands (uploads, blocks)
 * are skipped; a <br> counts as "\n", like a Lexical linebreak node.
 */
function editableSegments(root: HTMLElement): Segment[] {
  const segments: Segment[] = []
  let current: Segment | null = null
  let currentBlock: Element | null = null
  const blockOf = (n: Node): Element => {
    for (let p = n.parentElement; p && p !== root; p = p.parentElement) if (BLOCK_TAGS.has(p.tagName)) return p
    return root
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) =>
      n.nodeType === 1 && (n as Element).getAttribute('contenteditable') === 'false'
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const isBr = n.nodeType === 1 && (n as Element).tagName === 'BR'
    if (n.nodeType !== 3 && !isBr) continue
    const block = blockOf(n)
    if (block !== currentBlock || !current) {
      current = { text: '', parts: [] }
      segments.push(current)
      currentBlock = block
    }
    if (isBr) {
      current.text += '\n'
    } else {
      current.parts.push({ node: n as Text, at: current.text.length })
      current.text += (n as Text).data
    }
  }
  return segments
}

function segmentRange(seg: Segment, start: number, end: number): Range | null {
  const at = (off: number, isEnd: boolean) => {
    for (const p of seg.parts) {
      const len = p.node.data.length
      if (isEnd ? off > p.at && off <= p.at + len : off >= p.at && off < p.at + len) {
        return { node: p.node, offset: off - p.at }
      }
    }
    return null
  }
  const a = at(start, false)
  const b = at(end, true)
  if (!a || !b) return null
  const range = document.createRange()
  range.setStart(a.node, a.offset)
  range.setEnd(b.node, b.offset)
  return range
}

/** Every match in the editor, as DOM Ranges in document order. */
export function editableRanges(root: HTMLElement, query: string, opts: FindOptions): Range[] {
  const out: Range[] = []
  for (const seg of editableSegments(root)) {
    for (const s of findSpans(seg.text, query, opts)) {
      const r = segmentRange(seg, s.start, s.end)
      if (r) out.push(r)
    }
  }
  return out
}

export function setTextHighlights(all: Range[], current: Range | null): void {
  const registry = (globalThis as any).CSS?.highlights
  const HighlightCtor = (globalThis as any).Highlight
  if (!registry || !HighlightCtor) return
  registry.delete(HIGHLIGHT_ALL)
  registry.delete(HIGHLIGHT_CURRENT)
  if (all.length) registry.set(HIGHLIGHT_ALL, new HighlightCtor(...all))
  if (current) {
    const h = new HighlightCtor(current)
    h.priority = 1
    registry.set(HIGHLIGHT_CURRENT, h)
  }
}

/** Put the caret selection on a range inside the Lexical editor. */
export function selectInEditable(root: HTMLElement, range: Range) {
  root.focus({ preventScroll: true })
  // Lexical restores its own selection on focus; set ours on the next frame
  // so its selectionchange listener picks this one up.
  requestAnimationFrame(() => {
    const sel = window.getSelection()
    if (!sel) return
    sel.removeAllRanges()
    sel.addRange(range)
  })
}

/* ── JSON fields (Monaco) ──────────────────────────────────────────────── */

/** The Monaco editor instance inside a JSON field wrapper, once it has loaded. */
export function monacoIn(wrap: HTMLElement): any | null {
  const editors: any[] | undefined = (globalThis as any).monaco?.editor?.getEditors?.()
  if (!editors) return null
  return editors.find((e) => wrap.contains(e.getContainerDomNode?.())) ?? null
}

/**
 * Monaco ranges for matches inside JSON string values. `targets` are the
 * matches found in the form value (path inside the JSON + offsets in the
 * decoded string); they are mapped onto the editor's current source text.
 */
export function monacoRanges(
  editor: any,
  targets: { jsonPath: (string | number)[]; start: number; end: number }[],
): any[] {
  const monaco = (globalThis as any).monaco
  const model = editor?.getModel?.()
  if (!monaco || !model) return []
  const src: string = model.getValue()
  const positions = jsonStringPositions(src)
  if (!positions) return []
  return targets.map((t) => {
    const pos = positions.get(jsonPathKey(t.jsonPath))
    if (!pos) return null
    const map = rawOffsets(src.slice(pos.start, pos.end))
    if (t.end >= map.length) return null
    const a = model.getPositionAt(pos.start + map[t.start])
    const b = model.getPositionAt(pos.start + map[t.end])
    return new monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column)
  })
}

/** Viewport rect of a Monaco range (Payload's JSON editor grows to fit, so the page scrolls, not Monaco). */
export function monacoRangeRect(editor: any, range: any): DOMRect | null {
  const dom: HTMLElement | undefined = editor?.getDomNode?.()
  const p = editor?.getScrolledVisiblePosition?.({ lineNumber: range.startLineNumber, column: range.startColumn })
  if (!dom || !p) return null
  const box = dom.getBoundingClientRect()
  return new DOMRect(box.left + p.left, box.top + p.top, 8, p.height)
}

/* ── Selection the user already made (to prefill the box on Ctrl+F) ────── */

export function selectedText(active: Element | null): string {
  let text = ''
  if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
    const el = active as HTMLInputElement | HTMLTextAreaElement
    if (el.selectionStart != null && el.selectionEnd != null) text = el.value.slice(el.selectionStart, el.selectionEnd)
  } else {
    text = window.getSelection()?.toString() ?? ''
  }
  // A double-click in Chrome selects the word plus its trailing space.
  text = text.trim()
  return text.length > 0 && text.length <= 120 && !/[\r\n]/.test(text) ? text : ''
}
