'use client'

import { useEffect, useState } from 'react'
import { box } from '../ui/styles'

type AuditLogRow = {
  id: number | string
  action: 'create' | 'update' | 'delete'
  collectionSlug?: string
  documentId?: string
  documentTitle?: string
  userEmail?: string
  summary?: string
  createdAt: string
}

// Only link when collectionSlug names a real, admin-editable collection —
// some audit entries (e.g. newsletter sends) use a collectionSlug that
// isn't a registered collection, and would 404 if linked.
const LINKABLE_COLLECTIONS = new Set([
  'clinics', 'providers', 'reviews', 'guides', 'news', 'bookings', 'claims', 'qa',
  'data-alerts', 'promotions', 'brands', 'services', 'locations', 'zip-codes',
  'authors', 'medical-reviewers', 'faqs', 'before-after-cases', 'video-testimonials',
  'social-posts', 'subscribers', 'page-index', 'audit-logs', 'assistant-logs',
  'media', 'photos', 'users',
])

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(iso).toLocaleDateString()
}

export function ActivityFeed() {
  const [rows, setRows] = useState<AuditLogRow[] | null>(null)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/audit-logs?sort=-createdAt&depth=0&limit=15', {
          credentials: 'include',
        })
        if (!res.ok) {
          if (!cancelled) setBlocked(true)
          return
        }
        const data = await res.json()
        if (!cancelled) setRows((data?.docs ?? []) as AuditLogRow[])
      } catch {
        if (!cancelled) setBlocked(true)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (blocked) return null
  if (rows === null) return null

  return (
    <div style={{ ...box, marginTop: 8 }}>
      <strong style={{ fontSize: 15 }}>Recent activity</strong>
      {rows.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.6, margin: '10px 0 0' }}>No recent activity.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
          {rows.map((row) => {
            const linkable =
              row.collectionSlug && row.documentId && LINKABLE_COLLECTIONS.has(row.collectionSlug)
            const href = linkable ? `/admin/collections/${row.collectionSlug}/${row.documentId}` : undefined
            const content = (
              <>
                <span style={{ fontSize: 12, opacity: 0.55, width: 70, flexShrink: 0 }}>
                  {relativeTime(row.createdAt)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                  {row.userEmail || 'system'}
                </span>
                <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0, textTransform: 'capitalize' }}>
                  {row.action}
                </span>
                {row.collectionSlug && (
                  <span style={{ fontSize: 12, opacity: 0.5, flexShrink: 0 }}>{row.collectionSlug}</span>
                )}
                <span style={{ fontSize: 13, opacity: 0.85, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.documentTitle || row.summary || ''}
                </span>
              </>
            )
            const rowStyle: React.CSSProperties = {
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 4px',
              borderTop: '1px solid var(--theme-elevation-100, #f1f5f9)',
              textDecoration: 'none',
              color: 'inherit',
            }
            return href ? (
              <a key={row.id} href={href} style={rowStyle}>
                {content}
              </a>
            ) : (
              <div key={row.id} style={rowStyle}>
                {content}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
