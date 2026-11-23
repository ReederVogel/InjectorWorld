'use client'

/**
 * "Find in this article": a search box in the Save bar of the Guides and News
 * edit pages (Payload `beforeDocumentControls` slot).
 *
 * It searches the form's LIVE values (so unsaved edits count), across every
 * field passed in `fields`, including ones in a tab that is not showing, like
 * SEO. Matches are highlighted on the page; Enter / Shift+Enter walk through
 * them; clicking a result or pressing Esc puts the cursor on that match so it
 * can be edited straight away. Ctrl+F (Cmd+F) on the page opens this box;
 * pressing it again inside the box gives the browser's own find.
 *
 * Nothing here writes to the document. Edits go through the normal fields and
 * the normal Save button.
 */

import { useAllFormFields } from '@payloadcms/ui'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FindField, FindOptions, Hit } from './find-engine'
import { buildHits, findSpans, snippet } from './find-engine'
import {
  HIGHLIGHT_ALL,
  HIGHLIGHT_CURRENT,
  OverlayLayer,
  controlClip,
  editableRanges,
  locateField,
  measureSpans,
  monacoIn,
  monacoRangeRect,
  monacoRanges,
  revealField,
  revealInsideControl,
  scrollRectIntoView,
  selectInEditable,
  selectedText,
  setTextHighlights,
  stickyBottom,
  toViewport,
  waitFor,
  type Located,
} from './find-dom'

const MAX_HITS = 1000
const MAX_ROWS = 300
const DEBOUNCE_MS = 150

const ORANGE = 'rgb(249, 115, 22)'

const PAGE_CSS = `
::highlight(${HIGHLIGHT_ALL}) { background-color: rgba(250, 204, 21, 0.45); }
::highlight(${HIGHLIGHT_CURRENT}) { background-color: rgba(249, 115, 22, 0.6); }
.iw-find-monaco { background: rgba(250, 204, 21, 0.35); border-radius: 2px; }
.iw-find-monaco-current { background: rgba(249, 115, 22, 0.55); outline: 1px solid rgba(249, 115, 22, 0.95); border-radius: 2px; }
.iw-find-row:hover { background: var(--theme-elevation-100) !important; }
.iw-find-icon:hover:not(:disabled) { background: var(--theme-elevation-150); }
.iw-find-input::placeholder { color: var(--theme-elevation-450); }
`

type Target = { rect: () => DOMRect | null; select: () => void }

type Props = { fields?: FindField[] }

export function FindInDocument({ fields = [] }: Props) {
  const [formState] = useAllFormFields()

  const rootRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<OverlayLayer | null>(null)
  const decorationsRef = useRef(new Map<any, any>())
  const jumpPending = useRef(false)
  const paintFrame = useRef(0)

  const [query, setQuery] = useState('')
  const [term, setTerm] = useState('')
  const [opts, setOpts] = useState<FindOptions>({ matchCase: false, wholeWord: false })
  const [current, setCurrent] = useState(0)
  const [active, setActive] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const values = useMemo(() => fields.map((f) => (formState as any)?.[f.path]?.value), [fields, formState])
  const { hits, truncated } = useMemo(
    () => buildHits(fields, values, term, opts, MAX_HITS),
    [fields, values, term, opts],
  )
  const cur = hits.length ? Math.min(current, hits.length - 1) : -1

  // Event handlers and painters read the latest state from here, so they can
  // stay stable and window listeners are bound once.
  const live = useRef({ hits, cur, term, opts, active })
  live.current = { hits, cur, term, opts, active }

  const getForm = useCallback(
    (): HTMLElement | null =>
      (rootRef.current?.closest('form') as HTMLElement | null) ??
      document.querySelector<HTMLElement>('.collection-edit form'),
    [],
  )

  /* ── Painting ───────────────────────────────────────────────────────── */

  const fieldHasHits = (fi: number) => live.current.hits.some((h) => h.fieldIndex === fi)

  /** Boxes over text inputs and textareas. Cheap, so it also runs on scroll. */
  const paintOverlays = useCallback(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clear()
    const { hits, cur, term, opts, active } = live.current
    const form = getForm()
    if (!active || !term || !hits.length || !form) return
    const inset = stickyBottom(form)
    const curHit = hits[cur]
    fields.forEach((f, fi) => {
      if ((f.kind !== 'text' && f.kind !== 'textarea') || !fieldHasHits(fi)) return
      const el = locateField(form, f)?.input
      if (!el) return
      const clip = controlClip(el, inset)
      if (clip.height <= 0 || clip.bottom < 0 || clip.top > window.innerHeight) return
      const rects = measureSpans(el, findSpans(el.value, term, opts, MAX_HITS))
      rects.forEach((list, i) => {
        const isCurrent = !!curHit && curHit.fieldIndex === fi && curHit.k === i
        for (const r of list) layer.box(toViewport(el, r), clip, isCurrent)
      })
    })
    // fields is stable for the life of the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, getForm])

  /** Everything: overlays, body highlights, JSON editor decorations. */
  const paint = useCallback(() => {
    paintOverlays()
    for (const collection of decorationsRef.current.values()) collection?.clear?.()
    decorationsRef.current.clear()
    const { hits, cur, term, opts, active } = live.current
    const form = getForm()
    if (!active || !term || !hits.length || !form) {
      setTextHighlights([], null)
      return
    }
    const curHit = hits[cur]
    const all: Range[] = []
    let currentRange: Range | null = null
    fields.forEach((f, fi) => {
      if ((f.kind !== 'richText' && f.kind !== 'json') || !fieldHasHits(fi)) return
      const loc = locateField(form, f)
      if (!loc) return
      const curK = curHit && curHit.fieldIndex === fi ? curHit.k : -1
      if (f.kind === 'richText' && loc.editable) {
        const ranges = editableRanges(loc.editable, term, opts)
        all.push(...ranges)
        if (curK >= 0 && ranges.length) currentRange = ranges[Math.min(curK, ranges.length - 1)]
      } else if (f.kind === 'json') {
        const editor = monacoIn(loc.wrap)
        if (!editor?.createDecorationsCollection) return
        const fieldHits = hits.filter((h) => h.fieldIndex === fi && h.unit.jsonPath)
        const ranges = monacoRanges(
          editor,
          fieldHits.map((h) => ({ jsonPath: h.unit.jsonPath!, start: h.start, end: h.end })),
        )
        const decorations = ranges.flatMap((range, i) =>
          range
            ? [
                {
                  range,
                  options: {
                    inlineClassName: fieldHits[i].k === curK ? 'iw-find-monaco-current' : 'iw-find-monaco',
                  },
                },
              ]
            : [],
        )
        decorationsRef.current.set(editor, editor.createDecorationsCollection(decorations))
      }
    })
    setTextHighlights(all, currentRange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, getForm, paintOverlays])

  const schedulePaint = useCallback(() => {
    cancelAnimationFrame(paintFrame.current)
    paintFrame.current = requestAnimationFrame(() => paint())
  }, [paint])

  useEffect(() => {
    schedulePaint()
  }, [hits, cur, active, term, opts, schedulePaint])

  // Overlay layer lives for the life of the page; clean every highlight on leave.
  useEffect(() => {
    layerRef.current = new OverlayLayer()
    const decorations = decorationsRef.current
    return () => {
      cancelAnimationFrame(paintFrame.current)
      layerRef.current?.destroy()
      layerRef.current = null
      setTextHighlights([], null)
      for (const collection of decorations.values()) collection?.clear?.()
      decorations.clear()
    }
  }, [])

  // Scrolling or resizing moves the text-field boxes.
  useEffect(() => {
    let frame = 0
    const onMove = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => paintOverlays())
    }
    window.addEventListener('scroll', onMove, { capture: true, passive: true })
    window.addEventListener('resize', onMove)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onMove, { capture: true })
      window.removeEventListener('resize', onMove)
    }
  }, [paintOverlays])

  // Re-paint when the page itself changes: a tab switch, typing in the body.
  useEffect(() => {
    const form = getForm()
    if (!form) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new MutationObserver((records) => {
      if (!live.current.active || !live.current.term) return
      const relevant = records.some((r) => {
        const el = r.target.nodeType === 1 ? (r.target as Element) : r.target.parentElement
        // Monaco re-renders its own lines when decorations change; ignoring it avoids a loop.
        return !!el && !el.closest('.monaco-editor') && !rootRef.current?.contains(el)
      })
      if (!relevant) return
      clearTimeout(timer)
      timer = setTimeout(schedulePaint, 120)
    })
    observer.observe(form, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [getForm, schedulePaint])

  /* ── Moving between matches ─────────────────────────────────────────── */

  const targetFor = useCallback(async (loc: Located, field: FindField, hit: Hit): Promise<Target | null> => {
    const { term, opts } = live.current
    if (field.kind === 'text' || field.kind === 'textarea') {
      const el = loc.input
      if (!el) return null
      const spans = findSpans(el.value, term, opts, MAX_HITS)
      const span = spans[Math.min(hit.k, spans.length - 1)]
      if (!span) return null
      const rel = measureSpans(el, [span])[0]?.[0]
      if (rel) revealInsideControl(el, rel)
      return {
        rect: () => (rel ? toViewport(el, rel) : el.getBoundingClientRect()),
        select: () => {
          el.focus({ preventScroll: true })
          el.setSelectionRange(span.start, span.end)
        },
      }
    }
    if (field.kind === 'richText') {
      const editable = loc.editable
      if (!editable) return null
      const ranges = editableRanges(editable, term, opts)
      const range = ranges[Math.min(hit.k, ranges.length - 1)]
      if (!range) return null
      return { rect: () => range.getBoundingClientRect(), select: () => selectInEditable(editable, range) }
    }
    // JSON: Monaco loads lazily, so give it a moment after a tab switch.
    const editor = await waitFor(() => monacoIn(loc.wrap), 1500)
    if (!editor || !hit.unit.jsonPath) return null
    const [range] = monacoRanges(editor, [{ jsonPath: hit.unit.jsonPath, start: hit.start, end: hit.end }])
    if (!range) return null
    return {
      rect: () => monacoRangeRect(editor, range),
      select: () => {
        editor.setSelection(range)
        editor.focus()
      },
    }
  }, [])

  const goTo = useCallback(
    async (index: number, mode: 'show' | 'edit') => {
      const hit = live.current.hits[index]
      const form = getForm()
      if (!hit || !form) return
      setCurrent(index)
      if (mode === 'show') setActive(true)
      const field = fields[hit.fieldIndex]
      const loc = await revealField(form, field)
      if (!loc) return
      const target = await targetFor(loc, field, hit)
      const rect = target?.rect() ?? loc.wrap.getBoundingClientRect()
      scrollRectIntoView(rect, loc.wrap, stickyBottom(form))
      if (mode === 'edit' && target) target.select()
      schedulePaint()
    },
    [fields, getForm, schedulePaint, targetFor],
  )

  const step = useCallback(
    (dir: 1 | -1) => {
      const { hits, cur } = live.current
      if (!hits.length) return
      void goTo(cur < 0 ? 0 : (cur + dir + hits.length) % hits.length, 'show')
    },
    [goTo],
  )

  // Typing settles, then the first match is shown.
  useEffect(() => {
    const t = setTimeout(() => {
      if (query === live.current.term) return
      jumpPending.current = true
      setTerm(query)
      setCurrent(0)
      if (query.trim()) setActive(true)
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!jumpPending.current) return
    jumpPending.current = false
    if (hits.length) void goTo(0, 'show')
  }, [hits, goTo])

  /* ── Opening, closing, keyboard ─────────────────────────────────────── */

  const openBox = useCallback((prefill?: string) => {
    if (prefill) setQuery(prefill)
    setActive(true)
    setPanelOpen(true)
    const input = inputRef.current
    if (input) {
      input.focus()
      requestAnimationFrame(() => input.select())
    }
  }, [])

  const clear = () => {
    setQuery('')
    setTerm('')
    setCurrent(0)
    setActive(false)
    inputRef.current?.focus()
  }

  const toggle = (key: keyof FindOptions) => {
    jumpPending.current = true
    setCurrent(0)
    setOpts((o) => ({ ...o, [key]: !o[key] }))
  }

  /** Esc: close the list and put the cursor on the current match, ready to type. */
  const editHere = useCallback(async () => {
    setPanelOpen(false)
    const { cur } = live.current
    if (cur >= 0) await goTo(cur, 'edit')
    setActive(false)
  }, [goTo])

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (query !== term) {
        // Enter before the debounce fired: search now, show the first match.
        jumpPending.current = true
        setTerm(query)
        setCurrent(0)
        setActive(true)
        return
      }
      setPanelOpen(true)
      step(e.shiftKey ? -1 : 1)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (!query) {
        setPanelOpen(false)
        inputRef.current?.blur()
        return
      }
      void editHere()
    } else if (e.key === 'ArrowDown' && hits.length) {
      e.preventDefault()
      step(1)
    } else if (e.key === 'ArrowUp' && hits.length) {
      e.preventDefault()
      step(-1)
    }
  }

  // Ctrl+F / Cmd+F opens this box; F3 or Ctrl+G walks matches from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const form = getForm()
      if (!form) return
      const activeEl = document.activeElement as HTMLElement | null
      const onThisPage =
        !activeEl || activeEl === document.body || form.contains(activeEl) || !!panelRef.current?.contains(activeEl)
      if (!onThisPage) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && !e.shiftKey && !e.altKey && key === 'f') {
        if (activeEl === inputRef.current) return // second press: the browser's own find
        if (activeEl?.closest('.monaco-editor')) return // the JSON editor has its own find
        e.preventDefault()
        openBox(selectedText(activeEl) || undefined)
        return
      }
      const { term, hits } = live.current
      if (term && hits.length && (e.key === 'F3' || (mod && !e.altKey && key === 'g'))) {
        e.preventDefault()
        step(e.shiftKey ? -1 : 1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [getForm, openBox, step])

  // Close the list on a click anywhere else.
  useEffect(() => {
    if (!panelOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setPanelOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [panelOpen])

  // The list is portalled to <body> (Payload's Save bar clips overflow on
  // small screens), so it is placed by hand under the box.
  const placePanel = useCallback(() => {
    const box = boxRef.current?.getBoundingClientRect()
    if (!box) return
    const width = Math.min(480, window.innerWidth - 32)
    const left = Math.max(16, Math.min(box.right - width, window.innerWidth - 16 - width))
    setPanelPos({ top: box.bottom + 6, left, width })
  }, [])

  useLayoutEffect(() => {
    if (!panelOpen) return
    placePanel()
    window.addEventListener('resize', placePanel)
    window.addEventListener('scroll', placePanel, { capture: true, passive: true })
    return () => {
      window.removeEventListener('resize', placePanel)
      window.removeEventListener('scroll', placePanel, { capture: true })
    }
  }, [panelOpen, placePanel])

  // Keep the current row visible in the list.
  useEffect(() => {
    if (!panelOpen) return
    panelRef.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cur, panelOpen])

  /* ── Render ─────────────────────────────────────────────────────────── */

  const perField = useMemo(() => {
    const counts = new Map<number, number>()
    for (const h of hits) counts.set(h.fieldIndex, (counts.get(h.fieldIndex) ?? 0) + 1)
    return counts
  }, [hits])

  const searching = term.trim().length > 0
  const countText = !searching
    ? ''
    : hits.length
      ? `${cur + 1}/${hits.length}${truncated ? '+' : ''}`
      : '0/0'

  const summary = !searching
    ? ''
    : hits.length
      ? `${hits.length}${truncated ? '+' : ''} ${hits.length === 1 ? 'match' : 'matches'} in ${perField.size} ${
          perField.size === 1 ? 'field' : 'fields'
        }`
      : 'No matches in this article'

  const showPanel = panelOpen && searching && panelPos !== null

  // Built only while the list is open: the form re-renders this on every keystroke.
  const rows: ReactNode[] = []
  if (showPanel) hits.slice(0, MAX_ROWS).forEach((hit, i) => {
    const field = fields[hit.fieldIndex]
    if (i === 0 || hits[i - 1].fieldIndex !== hit.fieldIndex) {
      rows.push(
        <div key={`g${hit.fieldIndex}`} style={S.group}>
          {field.label} <span style={S.groupCount}>{perField.get(hit.fieldIndex)}</span>
        </div>,
      )
    }
    const s = snippet(hit.unit.text, hit.start, hit.end)
    const isCurrent = i === cur
    rows.push(
      <button
        key={i}
        type="button"
        className="iw-find-row"
        data-current={isCurrent}
        aria-current={isCurrent || undefined}
        style={{ ...S.row, ...(isCurrent ? S.rowCurrent : null) }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setPanelOpen(false)
          void goTo(i, 'edit')
        }}
      >
        {hit.unit.context && <span style={S.rowContext}>{hit.unit.context}</span>}
        <span>
          {s.before}
          <mark style={S.mark}>{s.match}</mark>
          {s.after}
        </span>
      </button>,
    )
  })

  const panel =
    showPanel && panelPos
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Find results"
            style={{ ...S.panel, top: panelPos.top, left: panelPos.left, width: panelPos.width }}
            onMouseDown={(e) => {
              // Keep focus in the box while using the list.
              if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault()
            }}
          >
            <div style={S.panelHead}>
              <span aria-live="polite">{summary}</span>
              <span style={{ display: 'flex', gap: 4 }}>
                <ToggleButton pressed={opts.matchCase} title="Match case" onClick={() => toggle('matchCase')}>
                  Aa
                </ToggleButton>
                <ToggleButton pressed={opts.wholeWord} title="Whole words only" onClick={() => toggle('wholeWord')}>
                  Whole word
                </ToggleButton>
              </span>
            </div>
            {hits.length > 0 && (
              <div style={S.list} role="list">
                {rows}
                {hits.length > MAX_ROWS && (
                  <div style={S.more}>
                    Showing the first {MAX_ROWS} of {hits.length}
                    {truncated ? '+' : ''}. Type more of the text to narrow it down.
                  </div>
                )}
              </div>
            )}
            <div style={S.panelFoot}>
              Enter: next · Shift+Enter: previous · Esc: edit at the match · Click a result to edit it
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} role="search" style={S.root}>
      <style>{PAGE_CSS}</style>
      <div ref={boxRef} style={{ ...S.box, ...(focused ? S.boxFocused : null) }}>
        <SearchIcon />
        <input
          ref={inputRef}
          className="iw-find-input"
          type="text"
          value={query}
          placeholder="Find in this article"
          aria-label="Find in this article"
          title="Find in this article (Ctrl+F)"
          spellCheck={false}
          autoComplete="off"
          style={S.input}
          onChange={(e) => {
            setQuery(e.target.value)
            setPanelOpen(true)
          }}
          onFocus={() => {
            setFocused(true)
            setPanelOpen(true)
            if (query.trim()) setActive(true)
          }}
          onBlur={(e) => {
            setFocused(false)
            const next = e.relatedTarget as Node | null
            if (next && !rootRef.current?.contains(next) && !panelRef.current?.contains(next)) setPanelOpen(false)
          }}
          onKeyDown={onInputKeyDown}
        />
        {searching && (
          <span style={{ ...S.count, ...(hits.length ? null : S.countNone) }} aria-hidden="true">
            {countText}
          </span>
        )}
        <IconButton title="Previous match (Shift+Enter)" disabled={!hits.length} onClick={() => step(-1)}>
          <Chevron up />
        </IconButton>
        <IconButton title="Next match (Enter)" disabled={!hits.length} onClick={() => step(1)}>
          <Chevron />
        </IconButton>
        {query && (
          <IconButton title="Clear" onClick={clear}>
            <CloseIcon />
          </IconButton>
        )}
      </div>
      {panel}
    </div>
  )
}

/* ── Small pieces ─────────────────────────────────────────────────────── */

function IconButton({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="iw-find-icon"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{ ...S.iconButton, ...(disabled ? { opacity: 0.35, cursor: 'default' } : null) }}
    >
      {children}
    </button>
  )
}

function ToggleButton({
  pressed,
  title,
  onClick,
  children,
}: {
  pressed: boolean
  title: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={pressed}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{ ...S.toggle, ...(pressed ? S.togglePressed : null) }}
    >
      {children}
    </button>
  )
}

const svgProps = {
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function SearchIcon() {
  return (
    <svg {...svgProps} style={{ flexShrink: 0, opacity: 0.6 }}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  )
}

function Chevron({ up }: { up?: boolean }) {
  return (
    <svg {...svgProps}>
      <path d={up ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg {...svgProps}>
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </svg>
  )
}

const S: Record<string, CSSProperties> = {
  root: { position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 },
  box: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    height: 30,
    padding: '0 4px 0 8px',
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 'var(--style-radius-s, 4px)',
    background: 'var(--theme-input-bg, var(--theme-elevation-0))',
    color: 'var(--theme-text)',
    transition: 'border-color 120ms',
  },
  boxFocused: { borderColor: 'var(--theme-elevation-400)' },
  input: {
    width: 'clamp(120px, 16vw, 220px)',
    height: '100%',
    padding: '0 6px',
    border: 0,
    outline: 'none',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    fontSize: 13,
  },
  count: {
    fontSize: 12,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--theme-elevation-600)',
    padding: '0 4px',
    whiteSpace: 'nowrap',
  },
  countNone: { color: 'var(--theme-error-500, #B91C1C)' },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    padding: 0,
    border: 0,
    borderRadius: 'var(--style-radius-s, 4px)',
    background: 'transparent',
    color: 'var(--theme-elevation-800)',
    cursor: 'pointer',
  },
  panel: {
    position: 'fixed',
    zIndex: 60,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'min(60vh, 560px)',
    background: 'var(--theme-bg)',
    color: 'var(--theme-text)',
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 6,
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
    overflow: 'hidden',
    fontSize: 13,
  },
  panelHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '8px 12px',
    borderBottom: '1px solid var(--theme-elevation-100)',
    fontSize: 12,
    color: 'var(--theme-elevation-700)',
  },
  toggle: {
    height: 22,
    padding: '0 8px',
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 'var(--style-radius-s, 4px)',
    background: 'transparent',
    color: 'var(--theme-elevation-700)',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  togglePressed: {
    background: 'var(--theme-elevation-800)',
    borderColor: 'var(--theme-elevation-800)',
    color: 'var(--theme-elevation-0)',
  },
  list: { overflowY: 'auto', flex: 1, padding: '4px 0' },
  group: {
    padding: '10px 12px 4px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--theme-elevation-500)',
  },
  groupCount: { fontWeight: 500, marginLeft: 4 },
  row: {
    display: 'block',
    width: '100%',
    padding: '6px 12px 6px 10px',
    border: 0,
    borderLeft: '2px solid transparent',
    background: 'transparent',
    color: 'var(--theme-text)',
    font: 'inherit',
    fontSize: 13,
    lineHeight: 1.45,
    textAlign: 'left',
    cursor: 'pointer',
    overflowWrap: 'anywhere',
  },
  rowCurrent: { background: 'var(--theme-elevation-100)', borderLeftColor: ORANGE },
  rowContext: { display: 'block', fontSize: 11, color: 'var(--theme-elevation-500)', marginBottom: 2 },
  mark: { background: 'rgba(250, 204, 21, 0.5)', color: 'inherit', borderRadius: 2, padding: '0 1px' },
  more: { padding: '8px 12px', fontSize: 12, color: 'var(--theme-elevation-500)' },
  panelFoot: {
    padding: '7px 12px',
    borderTop: '1px solid var(--theme-elevation-100)',
    fontSize: 11,
    color: 'var(--theme-elevation-500)',
  },
}
