'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { button, chip, hint, input, label, panel, readError, td, th } from './faqAdminStyles'

/**
 * Categories panel on the FAQs screen. A category is the page an FAQ lives on
 * (/faq/<slug>), plus the treatment, brand, guide and place pages that show a
 * preview of it. Every change goes through app/api/admin/faqs/*.
 * See docs/FAQ-SYSTEM-2026-09-13.md.
 */

type Ref = { id: number; label: string }
type LinkType = 'services' | 'brands' | 'guides' | 'locations'

type Category = {
  id: number
  name: string
  slug: string
  type: string
  enabled: boolean
  intro: string
  metaTitle: string
  metaDescription: string
  sortRank: number
  services: Ref[]
  brands: Ref[]
  guides: Ref[]
  locations: Ref[]
  total: number
  approved: number
}

type Draft = Omit<Category, 'id' | 'total' | 'approved'> & { id?: number }

type AssignResult = {
  apply: boolean
  scanned: number
  changed: number
  sectionsGuessed: number
  categories: Array<{ slug: string; name: string; count: number; isNew: boolean }>
  errors: Array<{ id: number; reason: string }>
}

const TYPE_LABELS: Record<string, string> = {
  treatment: 'Treatment',
  brand: 'Brand',
  topic: 'Topic',
  location: 'Place',
  general: 'General',
}

const LINK_LABELS: Record<LinkType, string> = {
  services: 'Treatment pages',
  brands: 'Brand pages',
  guides: 'Guides',
  locations: 'State and city pages',
}

const FAQ_LIST = '/admin/collections/faqs'

const EMPTY_DRAFT: Draft = {
  name: '', slug: '', type: 'topic', enabled: true, intro: '', metaTitle: '', metaDescription: '', sortRank: 100,
  services: [], brands: [], guides: [], locations: [],
}

export function FaqCategoriesPanel({ onChanged }: { onChanged: () => void }) {
  const [cats, setCats] = useState<Category[] | null>(null)
  const [uncategorised, setUncategorised] = useState(0)
  const [noSection, setNoSection] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [assign, setAssign] = useState<AssignResult | null>(null)

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const res = await fetch('/api/admin/faqs/categories', { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error(await readError(res, 'Could not load categories'))
      const j = await res.json()
      setCats(j.categories)
      setUncategorised(j.uncategorised)
      setNoSection(j.noSection)
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load categories.')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!cats) return []
    return q ? cats.filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q)) : cats
  }, [cats, filter])

  async function save() {
    if (!draft) return
    setBusy('save')
    setMsg('')
    try {
      const body = {
        ...draft,
        services: draft.services.map((r) => r.id),
        brands: draft.brands.map((r) => r.id),
        guides: draft.guides.map((r) => r.id),
        locations: draft.locations.map((r) => r.id),
      }
      const res = await fetch(draft.id ? `/api/admin/faqs/categories/${draft.id}` : '/api/admin/faqs/categories', {
        method: draft.id ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await readError(res, 'Save failed'))
      setMsg(draft.id ? `Saved "${draft.name}".` : `Created "${draft.name}".`)
      setDraft(null)
      await load()
      onChanged()
    } catch (err: any) {
      setMsg(err?.message || 'Save failed.')
    } finally {
      setBusy('')
    }
  }

  async function toggleEnabled(c: Category) {
    setBusy(`toggle:${c.id}`)
    setMsg('')
    try {
      const res = await fetch(`/api/admin/faqs/categories/${c.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...c,
          enabled: !c.enabled,
          services: c.services.map((r) => r.id),
          brands: c.brands.map((r) => r.id),
          guides: c.guides.map((r) => r.id),
          locations: c.locations.map((r) => r.id),
        }),
      })
      if (!res.ok) throw new Error(await readError(res, 'Update failed'))
      setMsg(`"${c.name}" is now ${c.enabled ? 'hidden' : 'live'}.`)
      await load()
    } catch (err: any) {
      setMsg(err?.message || 'Update failed.')
    } finally {
      setBusy('')
    }
  }

  async function remove(c: Category) {
    if (!window.confirm(`Delete the category "${c.name}"? This cannot be undone.`)) return
    setBusy(`delete:${c.id}`)
    setMsg('')
    try {
      const res = await fetch(`/api/admin/faqs/categories/${c.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error(await readError(res, 'Delete failed'))
      setMsg(`Deleted "${c.name}".`)
      await load()
      onChanged()
    } catch (err: any) {
      setMsg(err?.message || 'Delete failed.')
    } finally {
      setBusy('')
    }
  }

  async function runAssign(apply: boolean) {
    setBusy(apply ? 'assign' : 'preview')
    setMsg('')
    try {
      const res = await fetch('/api/admin/faqs/assign', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply }),
      })
      if (!res.ok) throw new Error(await readError(res, 'Assign failed'))
      const j: AssignResult = await res.json()
      setAssign(j)
      if (apply) {
        setMsg(`Updated ${j.changed} FAQ(s).`)
        await load()
        onChanged()
      }
    } catch (err: any) {
      setMsg(err?.message || 'Assign failed.')
    } finally {
      setBusy('')
    }
  }

  const missing = uncategorised + noSection

  return (
    <div style={panel}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <strong style={{ fontSize: 14 }}>FAQ categories</strong>
          <div style={hint}>
            Each category is one public page, /faq/&lt;url&gt;. Link it to treatment, brand, guide or place pages and
            those pages show its first few questions. To move many FAQs at once, tick them in the list below, click
            Edit, and set Category.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={button('primary', !!busy)} disabled={!!busy} onClick={() => { setDraft({ ...EMPTY_DRAFT }); setMsg('') }}>
            New category
          </button>
          <a href="/faq" target="_blank" rel="noreferrer" style={{ ...button('ghost'), textDecoration: 'none' }}>
            Open /faq
          </a>
        </div>
      </div>

      {missing > 0 && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: '#FBF3E1', border: '1px solid #C2A14E', color: '#0B1B34', fontSize: 12.5 }}>
          <strong>{uncategorised}</strong> FAQ(s) have no category and <strong>{noSection}</strong> have no section. FAQs
          without a category do not appear on any /faq page.
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" style={button('ghost', busy === 'preview')} disabled={!!busy} onClick={() => runAssign(false)}>
              {busy === 'preview' ? 'Checking…' : 'Preview automatic assignment'}
            </button>
            {assign && !assign.apply && assign.scanned > 0 && (
              <button type="button" style={button('accent', busy === 'assign')} disabled={!!busy} onClick={() => runAssign(true)}>
                {busy === 'assign' ? 'Assigning…' : `Assign ${assign.scanned} FAQ(s)`}
              </button>
            )}
          </div>
        </div>
      )}

      {assign && (
        <div style={{ marginTop: 10, fontSize: 12.5 }}>
          <div>
            {assign.apply ? 'Assigned' : 'Would assign'} {assign.scanned} FAQ(s) to {assign.categories.length} categor
            {assign.categories.length === 1 ? 'y' : 'ies'}; {assign.sectionsGuessed} section(s) guessed from the question.
          </div>
          {assign.categories.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {assign.categories.map((c) => (
                <span key={c.slug} style={chip}>
                  {c.name} ({c.count}){c.isNew ? ' new' : ''}
                </span>
              ))}
            </div>
          )}
          {assign.errors.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 16, color: '#B91C1C' }}>
              {assign.errors.map((e) => <li key={e.id}>FAQ {e.id}: {e.reason}</li>)}
            </ul>
          )}
        </div>
      )}

      {draft && (
        <CategoryForm draft={draft} setDraft={setDraft} busy={busy === 'save'} onSave={save} onCancel={() => setDraft(null)} />
      )}

      {msg && <p style={{ fontSize: 12.5, margin: '10px 0 0' }}>{msg}</p>}
      {loadError && <p style={{ fontSize: 12.5, margin: '10px 0 0', color: '#B91C1C' }}>{loadError}</p>}

      {cats && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <input
              style={{ ...input, maxWidth: 260 }}
              placeholder={`Filter ${cats.length} categories`}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={th}>Category</th>
                  <th style={th}>Type</th>
                  <th style={th}>Shows a preview on</th>
                  <th style={th}>FAQs (live / all)</th>
                  <th style={th}>Page</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const links = [...c.services, ...c.brands, ...c.guides, ...c.locations]
                  return (
                    <tr key={c.id}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <a href={`/faq/${c.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, opacity: 0.75 }}>
                          /faq/{c.slug}
                        </a>
                      </td>
                      <td style={td}>{TYPE_LABELS[c.type] ?? c.type}</td>
                      <td style={td}>
                        {links.length === 0 ? (
                          <span style={{ opacity: 0.5 }}>Nothing linked</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {links.slice(0, 4).map((r, i) => <span key={`${r.id}-${i}`} style={chip}>{r.label}</span>)}
                            {links.length > 4 && <span style={chip}>+{links.length - 4}</span>}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        <a href={`${FAQ_LIST}?where[category][equals]=${c.id}`}>
                          {c.approved} / {c.total}
                        </a>
                      </td>
                      <td style={td}>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() => toggleEnabled(c)}
                          title={c.enabled ? 'Live. Click to hide the page and its previews.' : 'Hidden. Click to make it live.'}
                          style={{ ...button(c.enabled ? 'accent' : 'ghost', busy === `toggle:${c.id}`), padding: '3px 10px' }}
                        >
                          {c.enabled ? 'Live' : 'Hidden'}
                        </button>
                        {c.enabled && c.approved === 0 && <div style={hint}>No live FAQs, so the page 404s.</div>}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <button type="button" style={{ ...button('ghost'), padding: '3px 10px' }} disabled={!!busy}
                          onClick={() => { setDraft({ ...c }); setMsg(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                          Edit
                        </button>{' '}
                        <button type="button" style={{ ...button('danger', busy === `delete:${c.id}`), padding: '3px 10px' }}
                          disabled={!!busy || c.total > 0}
                          title={c.total > 0 ? 'Move its FAQs to another category first.' : 'Delete this empty category.'}
                          onClick={() => remove(c)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {shown.length === 0 && (
                  <tr><td style={td} colSpan={6}>{cats.length === 0 ? 'No categories yet.' : 'No category matches that filter.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!cats && !loadError && <p style={{ fontSize: 12.5, marginTop: 10, opacity: 0.7 }}>Loading categories…</p>}
    </div>
  )
}

function CategoryForm({ draft, setDraft, busy, onSave, onCancel }: {
  draft: Draft
  setDraft: (d: Draft) => void
  busy: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v })

  return (
    <div style={{ marginTop: 14, padding: 14, borderRadius: 8, border: '1px solid var(--theme-elevation-250, #cbd5e1)' }}>
      <strong style={{ fontSize: 13 }}>{draft.id ? `Edit "${draft.name}"` : 'New category'}</strong>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 10 }}>
        <div>
          <label style={label}>Name</label>
          <input style={input} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Botox" />
        </div>
        <div>
          <label style={label}>Url</label>
          <input style={input} value={draft.slug} onChange={(e) => set('slug', e.target.value)} placeholder="botox" />
          <div style={hint}>/faq/{draft.slug || '(from the name)'}. Changing it breaks old links to this page.</div>
        </div>
        <div>
          <label style={label}>Type</label>
          <select style={input} value={draft.type} onChange={(e) => set('type', e.target.value)}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div style={hint}>Only decides the group on /faq.</div>
        </div>
        <div>
          <label style={label}>Order</label>
          <input style={input} type="number" min={0} value={draft.sortRank} onChange={(e) => set('sortRank', Number(e.target.value) || 0)} />
          <div style={hint}>Lower shows first on /faq and wins when two categories link the same page.</div>
        </div>
      </div>

      <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
        <input type="checkbox" checked={draft.enabled} onChange={(e) => set('enabled', e.target.checked)} />
        Live (page and previews visible)
      </label>

      <div style={{ marginTop: 12 }}>
        <label style={label}>Intro</label>
        <textarea style={{ ...input, minHeight: 60 }} value={draft.intro} onChange={(e) => set('intro', e.target.value)}
          placeholder="Shown under the heading. Leave empty for a standard line." />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 12 }}>
        <div>
          <label style={label}>Search title (optional)</label>
          <input style={input} value={draft.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} />
        </div>
        <div>
          <label style={label}>Search description (optional)</label>
          <input style={input} value={draft.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <strong style={{ fontSize: 12.5 }}>Show a preview of this category on</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 8 }}>
          {(Object.keys(LINK_LABELS) as LinkType[]).map((t) => (
            <EntityPicker key={t} type={t} title={LINK_LABELS[t]} value={draft[t]} onChange={(v) => set(t, v)} />
          ))}
        </div>
        <div style={hint}>
          Treatment, brand and guide pages show the first questions of this category. State and city pages only show
          FAQs whose Place is that state or city; linking a place here points their "See all" link at this category.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button type="button" style={button('primary', busy)} disabled={busy || !draft.name.trim()} onClick={onSave}>
          {busy ? 'Saving…' : draft.id ? 'Save changes' : 'Create category'}
        </button>
        <button type="button" style={button('ghost')} disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function EntityPicker({ type, title, value, onChange }: {
  type: LinkType
  title: string
  value: Ref[]
  onChange: (v: Ref[]) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Ref[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/faqs/lookup?type=${type}&q=${encodeURIComponent(q)}`, { credentials: 'include' })
        const j = await res.json()
        setResults(Array.isArray(j.results) ? j.results : [])
      } catch {
        setResults([])
      }
    }, 250)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [q, open, type])

  const chosen = new Set(value.map((v) => v.id))

  return (
    <div style={{ position: 'relative' }}>
      <label style={label}>{title}</label>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {value.map((v) => (
            <span key={v.id} style={chip}>
              {v.label}
              <button type="button" aria-label={`Remove ${v.label}`} onClick={() => onChange(value.filter((x) => x.id !== v.id))}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1, color: 'inherit' }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        style={input}
        value={q}
        placeholder="Search to add"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQ(e.target.value)}
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 20, left: 0, right: 0, marginTop: 2, maxHeight: 220, overflowY: 'auto',
          borderRadius: 8, border: '1px solid var(--theme-elevation-250, #cbd5e1)', background: 'var(--theme-elevation-0, #fff)',
        }}>
          {results.filter((r) => !chosen.has(r.id)).map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange([...value, r]); setQ('') }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 9px', fontSize: 12.5, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--theme-text, #0B1B34)' }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
