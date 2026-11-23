'use client'

/**
 * "Search inside all guides / news" on the list screen: which articles
 * contain a text, how many times, and in which fields. A result opens the
 * article with the "Find in this article" box already on that text
 * (?find=... is read by components/admin/find/FindInDocument.tsx).
 * Backed by GET /api/admin/content-search (read-only).
 */

import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '../cells/Badge'

type Result = {
  id: number
  title: string
  live: boolean
  matches: number
  fields: { label: string; count: number }[]
  snippets: { label: string; context?: string; before: string; match: string; after: string }[]
}
type Response = { articles: number; matches: number; results: Result[] }

export function ContentSearch({ collection, noun }: { collection: 'guides' | 'news'; noun: string }) {
  const [q, setQ] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [data, setData] = useState<Response | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const seq = useRef(0)

  useEffect(() => {
    const text = q.trim() ? q : ''
    if (!text) {
      setData(null)
      setError('')
      return
    }
    const mine = ++seq.current
    const t = setTimeout(async () => {
      setBusy(true)
      setError('')
      try {
        const params = new URLSearchParams({ collection, q })
        if (matchCase) params.set('mc', '1')
        if (wholeWord) params.set('ww', '1')
        const res = await fetch(`/api/admin/content-search?${params}`, { credentials: 'include' })
        const json = await res.json()
        if (mine !== seq.current) return
        if (!res.ok) throw new Error(json?.error || `Search failed (${res.status})`)
        setData(json)
      } catch (e) {
        if (mine === seq.current) setError(e instanceof Error ? e.message : 'Search failed')
      } finally {
        if (mine === seq.current) setBusy(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, matchCase, wholeWord, collection])

  const openHref = (id: number) => {
    const params = new URLSearchParams({ find: q })
    if (matchCase) params.set('mc', '1')
    if (wholeWord) params.set('ww', '1')
    return `/admin/collections/${collection}/${id}?${params}`
  }

  return (
    <div style={S.box}>
      <div style={S.bar}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden style={{ opacity: 0.6, flexShrink: 0 }}>
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search inside all ${noun}: body, FAQ, sources, SEO...`}
          aria-label={`Search inside all ${noun}`}
          spellCheck={false}
          style={S.input}
        />
        <Toggle pressed={matchCase} onClick={() => setMatchCase((v) => !v)} title="Match case">
          Aa
        </Toggle>
        <Toggle pressed={wholeWord} onClick={() => setWholeWord((v) => !v)} title="Whole words only">
          Whole word
        </Toggle>
      </div>

      {(busy || error || data) && (
        <div style={S.summary} aria-live="polite">
          {error
            ? error
            : busy && !data
              ? 'Searching...'
              : data && data.articles === 0
                ? `No ${noun} contain this text.`
                : data
                  ? `${data.matches} ${data.matches === 1 ? 'match' : 'matches'} in ${data.articles} ${
                      data.articles === 1 ? noun.replace(/s$/, '') : noun
                    }. Open one to see every match highlighted.`
                  : ''}
        </div>
      )}

      {data && data.results.length > 0 && (
        <div style={S.list}>
          {data.results.map((r) => (
            <a key={r.id} href={openHref(r.id)} className="iw-cs-row" style={S.row}>
              <span style={S.rowHead}>
                <span style={S.count}>{r.matches}</span>
                <span style={S.title}>{r.title || `(untitled ${r.id})`}</span>
                <Badge label={r.live ? 'Live' : 'Not live'} tone={r.live ? 'green' : 'grey'} />
              </span>
              <span style={S.fields}>{r.fields.map((f) => `${f.label} ${f.count}`).join(' · ')}</span>
              {r.snippets.map((s, i) => (
                <span key={i} style={S.snippet}>
                  <span style={S.snippetLabel}>{s.context ? `${s.label} · ${s.context}` : s.label}: </span>
                  {s.before}
                  <mark style={S.mark}>{s.match}</mark>
                  {s.after}
                </span>
              ))}
            </a>
          ))}
        </div>
      )}
      <style>{`.iw-cs-row:hover { background: var(--theme-elevation-100) !important; }`}</style>
    </div>
  )
}

function Toggle({ pressed, onClick, title, children }: { pressed: boolean; onClick: () => void; title: string; children: string }) {
  return (
    <button type="button" aria-pressed={pressed} title={title} onClick={onClick} style={{ ...S.toggle, ...(pressed ? S.togglePressed : null) }}>
      {children}
    </button>
  )
}

const S: Record<string, CSSProperties> = {
  box: {
    marginTop: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--theme-elevation-150)',
    borderRadius: 8,
    background: 'var(--theme-elevation-50)',
    overflow: 'hidden',
  },
  bar: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' },
  input: {
    flex: 1,
    minWidth: 0,
    height: 30,
    padding: '0 8px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--theme-elevation-150)',
    borderRadius: 'var(--style-radius-s, 4px)',
    background: 'var(--theme-input-bg, var(--theme-elevation-0))',
    color: 'var(--theme-text)',
    fontFamily: 'inherit',
    fontSize: 13,
    outline: 'none',
  },
  toggle: {
    height: 26,
    padding: '0 8px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--theme-elevation-150)',
    borderRadius: 'var(--style-radius-s, 4px)',
    background: 'transparent',
    color: 'var(--theme-elevation-700)',
    fontFamily: 'inherit',
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  togglePressed: {
    background: 'var(--theme-elevation-800)',
    borderColor: 'var(--theme-elevation-800)',
    color: 'var(--theme-elevation-0)',
  },
  summary: {
    padding: '6px 12px',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: 'var(--theme-elevation-100)',
    fontSize: 12,
    color: 'var(--theme-elevation-600)',
  },
  list: { maxHeight: 420, overflowY: 'auto', borderTop: '1px solid var(--theme-elevation-100)' },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    padding: '8px 12px',
    borderBottom: '1px solid var(--theme-elevation-100)',
    color: 'var(--theme-text)',
    textDecoration: 'none',
    fontSize: 13,
  },
  rowHead: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  count: {
    minWidth: 28,
    fontSize: 12,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--theme-elevation-800)',
  },
  title: { flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fields: { paddingLeft: 36, fontSize: 11, color: 'var(--theme-elevation-500)' },
  snippet: { paddingLeft: 36, fontSize: 12, color: 'var(--theme-elevation-700)', overflowWrap: 'anywhere' },
  snippetLabel: { color: 'var(--theme-elevation-500)' },
  mark: { background: 'rgba(250, 204, 21, 0.5)', color: 'inherit', borderRadius: 2, padding: '0 1px' },
}
