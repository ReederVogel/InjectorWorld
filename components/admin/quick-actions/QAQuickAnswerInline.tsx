'use client'

import { useState, type MouseEvent } from 'react'
import { useQuickAction } from './useQuickAction'
import { approveStyle, errorStyle } from './ClaimQuickActions'

type Props = {
  id: number | string
  status: string
  onDone: (newStatus: string) => void
}

/**
 * Expand-to-answer affordance for a reader question. Unlike the other 3
 * quick-actions this needs real typed content, so it can't be a single
 * click — but it still avoids the full native edit form (which also shows
 * questionText, source, submitter email, import metadata the operator
 * doesn't need just to answer).
 */
export function QAQuickAnswerInline({ id, status, onDone }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const { busy, error, run } = useQuickAction()

  if (status === 'answered') return null

  function stop(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  async function post(e: MouseEvent) {
    stop(e)
    if (!text.trim()) return
    const ok = await run(() =>
      fetch('/api/admin/qa/quick-answer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, answerText: text }),
      }),
    )
    if (ok) onDone('answered')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => { stop(e); setOpen(true) }}
        style={openStyle}
      >
        Quick answer
      </button>
    )
  }

  return (
    <div style={wrapStyle} onClick={stop}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type the answer..."
        rows={3}
        style={textareaStyle}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" disabled={busy || !text.trim()} onClick={post} style={approveStyle}>
          Post answer
        </button>
        <button type="button" onClick={(e) => { stop(e); setOpen(false) }} style={cancelStyle}>
          Cancel
        </button>
        {error && <span style={errorStyle}>{error}</span>}
      </div>
    </div>
  )
}

const openStyle = {
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 999,
  background: 'transparent',
  cursor: 'pointer',
  lineHeight: '16px',
  border: '1px solid #3FA68A',
  color: '#2f8d73',
  marginLeft: 8,
} as const

const wrapStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginTop: 6,
  minWidth: 240,
} as const

const textareaStyle = {
  fontSize: 12,
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  background: 'var(--theme-input-bg, #fff)',
  color: 'inherit',
  resize: 'vertical',
  fontFamily: 'inherit',
} as const

const cancelStyle = {
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 999,
  background: 'transparent',
  cursor: 'pointer',
  lineHeight: '16px',
  border: '1px solid var(--theme-elevation-200, #cbd5e1)',
  color: 'inherit',
  opacity: 0.75,
} as const
