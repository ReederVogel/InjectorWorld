'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import type { DirectoryClinic } from '@/lib/location-queries'

type LinkItem = { title: string; href: string; type: string }
type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
  clinics?: DirectoryClinic[]
  links?: LinkItem[]
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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const geoRef = useRef<{ lat: number; lng: number } | null>(null)
  const geoTried = useRef(false)

  const started = messages.length > 0

  useEffect(() => {
    if (started) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy, started])

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

  function patchLast(fn: (m: ChatMessage) => ChatMessage) {
    setMessages((prev) => {
      if (prev.length === 0) return prev
      const copy = prev.slice()
      copy[copy.length - 1] = fn(copy[copy.length - 1])
      return copy
    })
  }

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || busy) return
      setInput('')
      setUnavailable(false)

      const nextHistory: ChatMessage[] = [...messages, { role: 'user', text: trimmed }]
      setMessages([...nextHistory, { role: 'assistant', text: '' }])
      setBusy(true)

      const userLocation = await ensureGeo()

      try {
        const res = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: nextHistory.map((m) => ({ role: m.role, content: m.text })),
            userLocation,
          }),
        })

        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}))
          patchLast((m) => ({ ...m, text: j?.message || 'The assistant is unavailable right now. Please use the search bar.' }))
          setBusy(false)
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        const handle = (evt: any) => {
          if (evt.type === 'unavailable') {
            setUnavailable(true)
            patchLast((m) => ({ ...m, text: '' }))
          } else if (evt.type === 'text') {
            patchLast((m) => ({ ...m, text: m.text + (evt.delta || '') }))
          } else if (evt.type === 'clinics') {
            patchLast((m) => ({ ...m, clinics: [...(m.clinics || []), ...(evt.items || [])] }))
          } else if (evt.type === 'links') {
            patchLast((m) => ({ ...m, links: [...(m.links || []), ...(evt.items || [])] }))
          } else if (evt.type === 'error') {
            patchLast((m) => ({ ...m, text: (m.text ? m.text + '\n\n' : '') + (evt.message || 'Something went wrong.') }))
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
        patchLast((m) => ({ ...m, text: 'The assistant is unreachable. Please use the search bar for now.' }))
      } finally {
        setBusy(false)
      }
    },
    [messages, busy, ensureGeo],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    send(input)
  }

  const resetChat = useCallback(() => {
    setMessages([])
    setInput('')
    setUnavailable(false)
  }, [])

  return (
    <div className="max-w-[720px] mx-auto mb-8 md:mb-10">
      <div
        className={`bg-surface border border-border transition-all duration-300 ease-out overflow-hidden ${
          started ? 'rounded-2xl shadow-lg' : 'rounded-pill shadow-[0_4px_16px_rgba(11,27,52,0.06)]'
        }`}
      >
        {started && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border-subtle">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex w-7 h-7 rounded-full bg-brand-accent-soft text-brand-accent items-center justify-center flex-shrink-0">
                  <SparkleIcon className="w-4 h-4" />
                </span>
                <p className="text-body-sm font-semibold text-ink-primary truncate">Assistant</p>
              </div>
              <button
                type="button"
                onClick={resetChat}
                aria-label="Close and start over"
                className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-ink-tertiary hover:text-ink-primary hover:bg-surface-canvas transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Thread */}
            <div ref={scrollRef} className="px-5 py-4 space-y-4 max-h-[420px] overflow-y-auto text-left">
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={m.role === 'user' ? 'max-w-[85%]' : 'w-full'}>
                    {m.role === 'user' ? (
                      <div className="rounded-2xl rounded-br-sm bg-brand-primary text-surface-canvas px-3.5 py-2 text-body-sm whitespace-pre-wrap">
                        {m.text}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {m.text && (
                          <div className="text-body-sm text-ink-primary whitespace-pre-wrap leading-relaxed">{m.text}</div>
                        )}
                        {!m.text && busy && i === messages.length - 1 && !unavailable && (
                          <div className="flex gap-1 py-1" aria-label="Thinking">
                            <span className="w-1.5 h-1.5 rounded-full bg-ink-tertiary animate-bounce [animation-delay:-0.2s]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-ink-tertiary animate-bounce [animation-delay:-0.1s]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-ink-tertiary animate-bounce" />
                          </div>
                        )}
                        {m.clinics && m.clinics.length > 0 && (
                          <div className="space-y-3">
                            {m.clinics.map((c) => (
                              <DirectoryClinicCard key={c.id} c={c} dist={(c as any).distanceMiles ?? null} />
                            ))}
                          </div>
                        )}
                        {m.links && m.links.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {m.links.map((l) => (
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
              ))}

              {unavailable && (
                <div className="rounded-lg border border-border bg-surface-canvas p-3 text-body-sm text-ink-secondary">
                  The assistant is not available right now. Please use the search bar below to find injectors.
                </div>
              )}
            </div>
          </>
        )}

        {/* Input -- the original pill bar before a conversation starts; becomes
            the reply box at the bottom of the thread once it does, so the
            first query and the search box are part of the same growing panel. */}
        <form
          onSubmit={handleSubmit}
          className={started ? 'flex items-center gap-2 border-t border-border-subtle px-3 py-3' : 'flex items-center gap-3 px-5 py-4 md:py-3.5'}
        >
          {!started && <SparkleIcon className="text-brand-accent flex-shrink-0" />}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={started ? 'Ask a follow-up...' : 'Ask anything — "best injector for lip filler near me"'}
            aria-label="Ask the AI assistant"
            disabled={busy}
            className="flex-1 outline-none bg-transparent text-body text-ink-primary placeholder:text-ink-tertiary min-w-0 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className={
              started
                ? 'flex-shrink-0 w-9 h-9 rounded-full bg-brand-primary text-surface-canvas flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition'
                : 'flex-shrink-0 rounded-pill bg-brand-primary text-surface-canvas text-caption font-semibold px-3.5 py-1.5 disabled:opacity-40 transition'
            }
            aria-label={started ? 'Send' : undefined}
          >
            {started ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            ) : busy ? 'Asking…' : 'Ask AI'}
          </button>
        </form>
      </div>
    </div>
  )
}
