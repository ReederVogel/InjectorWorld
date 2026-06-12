'use client'

import { useState } from 'react'

/**
 * Sends a published news article to newsletter subscribers.
 * Calls POST /api/admin/newsletter/send-news (admin-only).
 */
export function DashboardNewsSendPanel({ confirmedCount }: { confirmedCount: number }) {
  const [slug, setSlug] = useState('')
  const [audience, setAudience] = useState<'all' | 'general' | 'city-waitlist'>('all')
  const [phase, setPhase] = useState<'compose' | 'preview' | 'sending' | 'done' | 'error'>(
    'compose',
  )
  const [result, setResult] = useState<{
    sent?: number
    failed?: number
    wouldSend?: number
    articleTitle?: string
  } | null>(null)
  const [errMsg, setErrMsg] = useState('')

  async function runPreview() {
    if (!slug.trim()) return
    setPhase('sending')
    try {
      const res = await fetch('/api/admin/newsletter/send-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsSlug: slug.trim(), audience, dryRun: true }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setErrMsg(data?.error || 'Failed.')
        setPhase('error')
        return
      }
      setResult(data)
      setPhase('preview')
    } catch {
      setErrMsg('Network error.')
      setPhase('error')
    }
  }

  async function runSend() {
    setPhase('sending')
    try {
      const res = await fetch('/api/admin/newsletter/send-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsSlug: slug.trim(), audience, dryRun: false }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setErrMsg(data?.error || 'Failed.')
        setPhase('error')
        return
      }
      setResult(data)
      setPhase('done')
    } catch {
      setErrMsg('Network error.')
      setPhase('error')
    }
  }

  if (phase === 'done' && result) {
    return (
      <div
        style={{ padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}
      >
        <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#166534' }}>News article sent.</p>
        <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#15803d' }}>
          {result.articleTitle && <em>{result.articleTitle}</em>}
        </p>
        <p style={{ margin: 0, fontSize: '13px', color: '#15803d' }}>
          Sent to {result.sent} subscriber{result.sent !== 1 ? 's' : ''}.
          {(result.failed ?? 0) > 0 && ` ${result.failed} failed.`}
        </p>
        <button
          onClick={() => { setPhase('compose'); setSlug(''); setResult(null) }}
          style={{ marginTop: '10px', fontSize: '12px', color: '#3FA68A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Send another article
        </button>
      </div>
    )
  }

  if (phase === 'preview' && result) {
    return (
      <div
        style={{ padding: '16px', background: '#fefce8', borderRadius: '8px', border: '1px solid #fde68a' }}
      >
        <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#92400e' }}>Confirm send</p>
        {result.articleTitle && (
          <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#78350f' }}>
            Article: <em>{result.articleTitle}</em>
          </p>
        )}
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#78350f' }}>
          This will notify <strong>{result.wouldSend}</strong> confirmed subscriber{result.wouldSend !== 1 ? 's' : ''}.
          This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={runSend}
            style={{ padding: '8px 16px', background: '#0B1B34', color: '#fff', border: 'none', borderRadius: '999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            Send now
          </button>
          <button
            onClick={() => setPhase('compose')}
            style={{ padding: '8px 16px', background: 'none', border: '1px solid #d1d5db', borderRadius: '999px', fontSize: '13px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div
        style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}
      >
        <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#991b1b', fontSize: '13px' }}>
          {errMsg}
        </p>
        <button
          onClick={() => setPhase('compose')}
          style={{ fontSize: '12px', color: '#3FA68A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Back
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
        Sends a published news article as a newsletter email to{' '}
        <strong>{confirmedCount}</strong> confirmed subscriber{confirmedCount !== 1 ? 's' : ''}.
        Requires RESEND_API_KEY.
      </p>

      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0B1B34', marginBottom: '4px' }}>
          News article slug
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="e.g. fda-approves-new-filler"
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' as const }}
        />
        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#94A3B8' }}>
          Copy the slug from the News collection in admin.
        </p>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0B1B34', marginBottom: '4px' }}>
          Audience
        </label>
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as typeof audience)}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '13px' }}
        >
          <option value="all">All confirmed subscribers</option>
          <option value="general">General newsletter only</option>
          <option value="city-waitlist">City waitlist only</option>
        </select>
      </div>

      <button
        onClick={runPreview}
        disabled={!slug.trim() || phase === 'sending'}
        style={{
          padding: '9px 18px', background: '#0B1B34', color: '#fff',
          border: 'none', borderRadius: '999px', fontSize: '13px',
          fontWeight: 600, cursor: 'pointer',
          opacity: (!slug.trim() || phase === 'sending') ? 0.5 : 1,
          alignSelf: 'flex-start',
        }}
      >
        {phase === 'sending' ? 'Loading...' : 'Preview send'}
      </button>
    </div>
  )
}
