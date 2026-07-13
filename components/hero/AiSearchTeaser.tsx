'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import type { DirectoryClinic } from '@/lib/location-queries'

type LinkItem = { title: string; href: string; type: string }
type Answer = {
  text: string
  clinics?: DirectoryClinic[]
  links?: LinkItem[]
  unavailable?: boolean
}

function SparkleIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path
        d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function AiSearchTeaser() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const geoRef = useRef<{ lat: number; lng: number } | null>(null)
  const geoTried = useRef(false)

  const ensureGeo = useCallback(async () => {
    if (geoTried.current) return geoRef.current
    geoTried.current = true
    try {
      const r = await fetch('/api/geo/ip')
      const d = await r.json()
      if (typeof d.lat === 'number' && typeof d.lng === 'number') geoRef.current = { lat: d.lat, lng: d.lng }
    } catch {}
    return geoRef.current
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = query.trim()
      if (!trimmed || busy) return

      setOpen(true)
      setBusy(true)
      setAnswer({ text: '' })

      const userLocation = await ensureGeo()

      try {
        const res = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: trimmed }],
            userLocation,
          }),
        })

        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}))
          setAnswer({ text: j?.message || 'The assistant is unavailable right now. Please use the search bar.' })
          setBusy(false)
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        const handle = (evt: any) => {
          if (evt.type === 'unavailable') {
            setAnswer((a) => ({ ...(a || { text: '' }), unavailable: true }))
          } else if (evt.type === 'text') {
            setAnswer((a) => ({ ...(a || { text: '' }), text: (a?.text || '') + (evt.delta || '') }))
          } else if (evt.type === 'clinics') {
            setAnswer((a) => ({ ...(a || { text: '' }), clinics: [...(a?.clinics || []), ...(evt.items || [])] }))
          } else if (evt.type === 'links') {
            setAnswer((a) => ({ ...(a || { text: '' }), links: [...(a?.links || []), ...(evt.items || [])] }))
          } else if (evt.type === 'error') {
            setAnswer((a) => ({
              ...(a || { text: '' }),
              text: (a?.text ? a.text + '\n\n' : '') + (evt.message || 'Something went wrong.'),
            }))
          }
        }

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          let idx: number
          while ((idx = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, idx).trim()
            buf = buf.slice(idx + 1)
            if (line) try { handle(JSON.parse(line)) } catch {}
          }
        }
        const tail = buf.trim()
        if (tail) try { handle(JSON.parse(tail)) } catch {}
      } catch {
        setAnswer({ text: 'The assistant is unreachable. Please use the search bar for now.' })
      } finally {
        setBusy(false)
      }
    },
    [query, busy, ensureGeo],
  )

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  return (
    <div className="max-w-[720px] mx-auto mb-8 md:mb-10">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 rounded-pill border border-border bg-surface px-5 py-4 md:py-3.5 shadow-[0_4px_16px_rgba(11,27,52,0.06)] focus-within:border-brand-accent transition"
      >
        <SparkleIcon className="text-brand-accent flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Ask anything — "best injector for lip filler near me"'
          aria-label="Ask the AI assistant"
          disabled={busy}
          className="flex-1 outline-none bg-transparent text-body text-ink-primary placeholder:text-ink-tertiary min-w-0 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="flex-shrink-0 rounded-pill bg-brand-primary text-surface-canvas text-caption font-semibold px-3.5 py-1.5 disabled:opacity-40 transition"
        >
          {busy ? 'Asking…' : 'Ask AI'}
        </button>
      </form>

      {/* Answer drawer */}
      <div
        className="grid transition-[grid-template-rows] duration-500 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div
            className={`mt-4 rounded-2xl border border-border bg-surface-canvas shadow-lg transition-[opacity,transform] duration-500 ease-out ${
              open ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
            }`}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border-subtle">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex w-7 h-7 rounded-full bg-brand-accent-soft text-brand-accent items-center justify-center flex-shrink-0">
                  <SparkleIcon className="w-4 h-4" />
                </span>
                <p className="text-body-sm font-semibold text-ink-primary truncate">Answer</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close answer"
                className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-ink-tertiary hover:text-ink-primary hover:bg-surface transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="px-5 py-4 text-left">
              {answer?.unavailable ? (
                <p className="text-body-sm text-ink-secondary">
                  The assistant is not available right now. Please use the search bar below to find injectors.
                </p>
              ) : (
                <div className="space-y-3">
                  {answer?.text && (
                    <p className="text-body-sm text-ink-primary whitespace-pre-wrap leading-relaxed">{answer.text}</p>
                  )}
                  {!answer?.text && busy && (
                    <div className="flex gap-1 py-1" aria-label="Thinking">
                      <span className="w-1.5 h-1.5 rounded-full bg-ink-tertiary animate-bounce [animation-delay:-0.2s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-ink-tertiary animate-bounce [animation-delay:-0.1s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-ink-tertiary animate-bounce" />
                    </div>
                  )}
                  {answer?.clinics && answer.clinics.length > 0 && (
                    <div className="space-y-3 pt-1">
                      {answer.clinics.map((c) => (
                        <DirectoryClinicCard key={c.id} c={c} dist={(c as any).distanceMiles ?? null} />
                      ))}
                    </div>
                  )}
                  {answer?.links && answer.links.length > 0 && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      {answer.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className="inline-flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                          {l.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
