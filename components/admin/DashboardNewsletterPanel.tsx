'use client'

import { useState } from 'react'

/**
 * Admin broadcast panel for the dashboard widget.
 * Lets an admin compose a plain-text email and send to confirmed subscribers.
 * Calls POST /api/admin/newsletter/broadcast (admin-only, rate-limited 2/hr).
 */
export function DashboardNewsletterPanel({
  confirmedCount,
}: {
  confirmedCount: number
}) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<'all' | 'general' | 'city-waitlist'>('all')
  const [phase, setPhase] = useState<'compose' | 'preview' | 'sending' | 'done' | 'error'>('compose')
  const [result, setResult] = useState<{ sent?: number; failed?: number; wouldSend?: number } | null>(null)
  const [errMsg, setErrMsg] = useState('')

  async function runDryRun() {
    setPhase('sending')
    try {
      const res = await fetch('/api/admin/newsletter/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, audience, dryRun: true }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) { setErrMsg(data?.error || 'Failed.'); setPhase('error'); return }
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
      const res = await fetch('/api/admin/newsletter/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, audience, dryRun: false }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) { setErrMsg(data?.error || 'Failed.'); setPhase('error'); return }
      setResult(data)
      setPhase('done')
    } catch {
      setErrMsg('Network error.')
      setPhase('error')
    }
  }

  if (phase === 'done' && result) {
    return (
      <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
        <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#166534' }}>Broadcast sent.</p>
        <p style={{ margin: 0, fontSize: '13px', color: '#15803d' }}>
          Sent to {result.sent} subscriber{result.sent !== 1 ? 's' : ''}.
          {(result.failed ?? 0) > 0 && ` ${result.failed} failed.`}
        </p>
        <button
          onClick={() => { setPhase('compose'); setSubject(''); setBody(''); setResult(null) }}
          style={{ marginTop: '10px', fontSize: '12px', color: '#3FA68A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Compose another
        </button>
      </div>
    )
  }

  if (phase === 'preview' && result) {
    return (
      <div style={{ padding: '16px', background: '#fefce8', borderRadius: '8px', border: '1px solid #fde68a' }}>
        <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#92400e' }}>Confirm send</p>
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#78350f' }}>
          This will send to <strong>{result.wouldSend}</strong> confirmed subscriber{result.wouldSend !== 1 ? 's' : ''}.
          This action cannot be undone.
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
            Edit
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
        <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#991b1b', fontSize: '13px' }}>{errMsg}</p>
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
        <strong>{confirmedCount}</strong> confirmed subscriber{confirmedCount !== 1 ? 's' : ''} will receive this email.
        Requires RESEND_API_KEY.
      </p>

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

      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0B1B34', marginBottom: '4px' }}>
          Subject line
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={150}
          placeholder="e.g. New: Botox guide for first-timers"
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#0B1B34', marginBottom: '4px' }}>
          Body (plain text)
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          rows={6}
          placeholder="Write your email body here. No HTML needed."
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
      </div>

      <button
        onClick={runDryRun}
        disabled={!subject.trim() || !body.trim() || phase === 'sending'}
        style={{
          padding: '9px 18px', background: '#0B1B34', color: '#fff',
          border: 'none', borderRadius: '999px', fontSize: '13px',
          fontWeight: 600, cursor: 'pointer', opacity: (!subject.trim() || !body.trim() || phase === 'sending') ? 0.5 : 1,
          alignSelf: 'flex-start',
        }}
      >
        {phase === 'sending' ? 'Checking...' : 'Preview send'}
      </button>
      <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8' }}>
        Preview counts recipients before committing. Unsubscribe link is added automatically.
      </p>
    </div>
  )
}
