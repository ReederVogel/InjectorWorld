'use client'

import { useCallback, useEffect, useState } from 'react'

type Pending = { id: string | number; path: string; pageType: string; dataCount: number; indexed: boolean }

/**
 * Page-index control: shows how many service/location pages are indexed, lets the
 * admin re-scan, and surfaces "new page now has data" notifications with explicit
 * acknowledge / force-index / no-index actions. Backed by /api/admin/page-index + /scan-pages.
 */
export function DashboardPageIndexPanel() {
  const [pending, setPending] = useState<Pending[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [indexedCount, setIndexedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/page-index', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) {
        setPending(data.pending ?? [])
        setPendingCount(data.pendingCount ?? 0)
        setIndexedCount(data.indexedCount ?? 0)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function runScan() {
    setScanning(true); setMsg('')
    try {
      const res = await fetch('/api/admin/scan-pages', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) { setMsg(data?.error || 'Scan failed.') }
      else {
        setMsg(
          data.baseline
            ? `Baseline set: ${data.created} data-backed pages staged noindex.`
            : `Scan done. ${data.created} new, ${data.updated} updated, ${data.lostData} lost data.`,
        )
        await load()
      }
    } catch { setMsg('Network error.') }
    setScanning(false)
  }

  async function act(id: string | number, action: 'keep' | 'noindex' | 'index') {
    setPending((prev) => prev.filter((p) => p.id !== id)) // optimistic
    try {
      await fetch('/api/admin/page-index', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, action }),
      })
      setPendingCount((c) => Math.max(0, c - 1))
      if (action === 'index') setIndexedCount((c) => c + 1)
    } catch { load() }
  }

  return (
    <div style={{ padding: '18px 20px', background: '#fff', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: '#0B1B34', fontSize: '15px' }}>Page indexing</p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>
            New pages with data stay noindex until an admin explicitly indexes them.
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          style={{ padding: '8px 16px', background: '#0B1B34', color: '#fff', border: 'none', borderRadius: '999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: scanning ? 0.5 : 1, flexShrink: 0 }}
        >
          {scanning ? 'Scanning…' : 'Run page scan'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', margin: '10px 0 14px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#0B1B34', lineHeight: 1 }}>{loading ? '—' : indexedCount.toLocaleString()}</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>Indexed pages</div>
        </div>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: pendingCount > 0 ? '#3FA68A' : '#94A3B8', lineHeight: 1 }}>{loading ? '—' : pendingCount.toLocaleString()}</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>New / unreviewed</div>
        </div>
      </div>

      {msg && <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#475569', background: '#F7F8FA', padding: '8px 10px', borderRadius: '6px' }}>{msg}</p>}

      {pending.length > 0 ? (
        <div style={{ border: '1px solid #EEF1F5', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '6px 12px', background: '#FAF7F2', fontSize: '11px', fontWeight: 600, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            New pages with data. Acknowledge, force index, or keep noindex:
          </div>
          {pending.map((p) => (
            <div key={String(p.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderTop: '1px solid #EEF1F5' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#0B1B34', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.path}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>{p.pageType} · {p.dataCount} clinics</div>
              </div>
              <button onClick={() => act(p.id, 'keep')} style={{ padding: '5px 11px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Acknowledge</button>
              <button onClick={() => act(p.id, 'index')} style={{ padding: '5px 11px', background: '#E6F2EE', color: '#3FA68A', border: 'none', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Force index</button>
              <button onClick={() => act(p.id, 'noindex')} style={{ padding: '5px 11px', background: 'none', color: '#B91C1C', border: '1px solid #fecaca', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>No-index</button>
            </div>
          ))}
        </div>
      ) : (
        !loading && <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>No new pages to review.</p>
      )}
    </div>
  )
}
