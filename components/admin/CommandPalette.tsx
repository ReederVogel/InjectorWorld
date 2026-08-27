'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type PaletteItem = {
  id: string
  label: string
  sublabel?: string
  href: string
  group: string
}

const NAV_ITEMS: PaletteItem[] = [
  { id: 'nav-dashboard', label: 'Dashboard', href: '/admin', group: 'Navigation' },
  { id: 'nav-ops', label: 'Operations', href: '/admin/ops', group: 'Navigation' },
  { id: 'nav-indexing', label: 'Indexing', href: '/admin/indexing', group: 'Navigation' },
  { id: 'nav-tools', label: 'Data Tools', href: '/admin/tools', group: 'Navigation' },
  { id: 'nav-analytics', label: 'Analytics', href: '/admin/analytics', group: 'Navigation' },
]

const COLLECTIONS: Array<{ slug: string; label: string }> = [
  { slug: 'clinics', label: 'Clinics' },
  { slug: 'providers', label: 'Providers' },
  { slug: 'reviews', label: 'Reviews' },
  { slug: 'guides', label: 'Guides' },
  { slug: 'news', label: 'News' },
  { slug: 'bookings', label: 'Bookings' },
  { slug: 'claims', label: 'Claims' },
  { slug: 'qa', label: 'Q&A' },
  { slug: 'data-alerts', label: 'Data Alerts' },
  { slug: 'promotions', label: 'Promotions' },
  { slug: 'brands', label: 'Brands' },
  { slug: 'services', label: 'Services' },
  { slug: 'locations', label: 'Locations' },
  { slug: 'zip-codes', label: 'Zip Codes' },
  { slug: 'authors', label: 'Authors' },
  { slug: 'medical-reviewers', label: 'Medical Reviewers' },
  { slug: 'faqs', label: 'FAQs' },
  { slug: 'before-after-cases', label: 'Before/After Cases' },
  { slug: 'video-testimonials', label: 'Video Testimonials' },
  { slug: 'social-posts', label: 'Social Posts' },
  { slug: 'subscribers', label: 'Subscribers' },
  { slug: 'page-index', label: 'URLs' },
  { slug: 'audit-logs', label: 'Audit Logs' },
  { slug: 'assistant-logs', label: 'Assistant Logs' },
  { slug: 'media', label: 'Media' },
  { slug: 'photos', label: 'Photos' },
  { slug: 'users', label: 'Users' },
]

const COLLECTION_ITEMS: PaletteItem[] = COLLECTIONS.map((c) => ({
  id: `col-${c.slug}`,
  label: c.label,
  href: `/admin/collections/${c.slug}`,
  group: 'Collections',
}))

const QUICK_CREATE_ITEMS: PaletteItem[] = [
  { id: 'create-guide', label: 'New Guide', href: '/admin/collections/guides/create', group: 'Quick create' },
  { id: 'create-news', label: 'New News', href: '/admin/collections/news/create', group: 'Quick create' },
  { id: 'create-clinic', label: 'New Clinic', href: '/admin/collections/clinics/create', group: 'Quick create' },
  { id: 'create-promotion', label: 'New Promotion', href: '/admin/collections/promotions/create', group: 'Quick create' },
]

const STATIC_ITEMS: PaletteItem[] = [...NAV_ITEMS, ...QUICK_CREATE_ITEMS, ...COLLECTION_ITEMS]

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(11, 27, 52, 0.5)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: '12vh',
}

const panelStyle: React.CSSProperties = {
  width: 560,
  maxWidth: '90vw',
  maxHeight: '60vh',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--theme-elevation-0, #fff)',
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 12,
  boxShadow: '0 20px 60px rgba(11, 27, 52, 0.35)',
  overflow: 'hidden',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  fontSize: 15,
  border: 'none',
  borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)',
  background: 'var(--theme-input-bg, var(--theme-elevation-0, #fff))',
  color: 'var(--theme-text, #0B1B34)',
  outline: 'none',
}

const listStyle: React.CSSProperties = {
  overflowY: 'auto',
  padding: '6px 0',
}

function rowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 16px',
    cursor: 'pointer',
    background: active ? 'var(--theme-elevation-100, #f1f5f9)' : 'transparent',
    color: 'var(--theme-text, #0B1B34)',
    textDecoration: 'none',
  }
}

const groupLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  opacity: 0.5,
  padding: '10px 16px 4px',
}

type ClinicHit = { id: number; clinicName: string; city?: string | null; state?: string | null }

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [clinicHits, setClinicHits] = useState<PaletteItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setClinicHits([])
    setSelectedIndex(0)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isK = e.key === 'k' || e.key === 'K'
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault()
        setOpen((prev) => !prev)
        return
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [open])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 3) {
      setClinicHits([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/clinics?limit=5&depth=0&where[clinicName][like]=${encodeURIComponent(query.trim())}`,
          { credentials: 'include' },
        )
        if (!res.ok) return
        const data = await res.json()
        const docs = (data?.docs ?? []) as ClinicHit[]
        setClinicHits(
          docs.map((c) => ({
            id: `clinic-${c.id}`,
            label: c.clinicName,
            sublabel: [c.city, c.state].filter(Boolean).join(', ') || undefined,
            href: `/admin/collections/clinics/${c.id}`,
            group: 'Clinics',
          })),
        )
      } catch {
        // silent-fail — live search is a convenience, not critical
      }
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const filteredStatic = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return STATIC_ITEMS
    return STATIC_ITEMS.filter((item) => item.label.toLowerCase().includes(q))
  }, [query])

  const results = useMemo(() => [...filteredStatic, ...clinicHits], [filteredStatic, clinicHits])

  useEffect(() => {
    setSelectedIndex(0)
  }, [results.length, query])

  const navigate = useCallback(
    (href: string) => {
      close()
      router.push(href)
    },
    [close, router],
  )

  useEffect(() => {
    if (!open) return
    function onNavKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = results[selectedIndex]
        if (item) navigate(item.href)
      }
    }
    window.addEventListener('keydown', onNavKeyDown)
    return () => window.removeEventListener('keydown', onNavKeyDown)
  }, [open, results, selectedIndex, navigate])

  if (!open) return null

  let lastGroup = ''

  return (
    <div style={overlayStyle} onClick={close}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to a page, collection, or clinic…"
          style={inputStyle}
        />
        <div style={listStyle}>
          {results.length === 0 && (
            <div style={{ padding: '16px', fontSize: 13, opacity: 0.6 }}>No matches.</div>
          )}
          {results.map((item, index) => {
            const showGroup = item.group !== lastGroup
            lastGroup = item.group
            return (
              <div key={item.id}>
                {showGroup && <div style={groupLabelStyle}>{item.group}</div>}
                <div
                  role="button"
                  tabIndex={-1}
                  style={rowStyle(index === selectedIndex)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => navigate(item.href)}
                >
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{item.label}</span>
                  {item.sublabel && (
                    <span style={{ fontSize: 12, opacity: 0.6 }}>{item.sublabel}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function CommandPaletteProvider({ children }: { children?: React.ReactNode }) {
  return (
    <>
      {children}
      <CommandPalette />
    </>
  )
}
