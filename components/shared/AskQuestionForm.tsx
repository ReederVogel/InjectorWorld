'use client'

import { useState } from 'react'

type Props = {
  compact?: boolean
  treatmentTag?: string
}

export function AskQuestionForm({ compact = false, treatmentTag }: Props) {
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [question, setQuestion] = useState('')
  const [detail, setDetail] = useState('')
  const [email, setEmail] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || question.trim().length < 10) return
    setState('submitting')
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionTitle: question.trim(),
          questionText: detail.trim() || undefined,
          treatmentTag: treatmentTag || undefined,
          submitterEmail: email.trim() || undefined,
        }),
      })
      if (res.ok) {
        setState('done')
      } else {
        const data = await res.json().catch(() => ({}))
        console.error('[AskQuestionForm]', data)
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className="rounded-2xl border border-brand-accent-soft bg-brand-accent-soft p-5 text-center">
        <svg className="mx-auto mb-3 text-brand-accent" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
        </svg>
        <div className="font-semibold text-body text-ink-primary mb-1">Question received</div>
        <p className="text-body-sm text-ink-secondary">
          We will review it and post an answer within 48 hours. No account needed.
        </p>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border border-border ${compact ? 'bg-surface p-5' : 'bg-surface-warm p-6'}`}>
      {!compact && (
        <>
          <div className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-2">Ask a question</div>
          <h3 className="font-serif text-h3 text-ink-primary mb-1 leading-snug">Have a question?</h3>
          <p className="text-body-sm text-ink-secondary mb-5">
            Ask anything about injectables. Answered by licensed providers, usually within 48 hours. No account required.
          </p>
        </>
      )}
      {compact && (
        <div className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3">Ask a question</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="q-title" className="sr-only">Your question</label>
          <textarea
            id="q-title"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={treatmentTag ? `Ask about ${treatmentTag}...` : 'Ask a question about injectables...'}
            rows={3}
            maxLength={200}
            required
            className="w-full px-4 py-3 rounded-xl border border-border bg-surface-canvas text-body-sm text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-brand-accent resize-none"
          />
        </div>

        {!compact && (
          <div>
            <label htmlFor="q-detail" className="sr-only">More detail (optional)</label>
            <textarea
              id="q-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Add more detail if helpful (optional)"
              rows={2}
              maxLength={500}
              className="w-full px-4 py-3 rounded-xl border border-border bg-surface-canvas text-body-sm text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-brand-accent resize-none"
            />
          </div>
        )}

        <div>
          <label htmlFor="q-email" className="sr-only">Your email (optional, to be notified)</label>
          <input
            id="q-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional, for a reply notification)"
            className="w-full px-4 py-3 rounded-xl border border-border bg-surface-canvas text-body-sm text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-brand-accent"
          />
        </div>

        {state === 'error' && (
          <p className="text-body-sm text-state-error">Something went wrong. Please try again.</p>
        )}

        <button
          type="submit"
          disabled={state === 'submitting' || question.trim().length < 10}
          className="w-full bg-brand-primary text-surface-canvas rounded-pill py-3 text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === 'submitting' ? 'Submitting...' : 'Submit question'}
        </button>

        <p className="text-caption text-ink-tertiary text-center">
          Questions are moderated before publishing. No spam or personal medical advice.
        </p>
      </form>
    </div>
  )
}
