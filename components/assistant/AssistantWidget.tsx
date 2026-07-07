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

const POPULAR = [
  'Best Botox clinics near me',
  'Botox vs filler?',
  'Lip filler in Houston',
  'How do I claim my profile?',
]

const STORAGE_KEY = 'iw_assistant_thread'
/** Keep in sync with ASSISTANT_MAX_USER_TURNS on the server. */
const MAX_USER_MESSAGES = 25

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

export function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const geoRef = useRef<{ lat: number; lng: number } | null>(null)
  const geoTried = useRef(false)

  // Restore thread across navigation.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) setMessages(JSON.parse(raw))
    } catch {}
  }, [])
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {}
  }, [messages])

  // Let other components (the homepage teaser) open the assistant.
  useEffect(() => {
    const openIt = () => setOpen(true)
    window.addEventListener('open-assistant', openIt)
    return () => window.removeEventListener('open-assistant', openIt)
  }, [])

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open, busy])

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

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || busy) return
      setInput('')
      setUnavailable(false)

      const nextHistory: ChatMessage[] = [...messages, { role: 'user', text: trimmed }]
      // Placeholder assistant message we stream into.
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

  function patchLast(fn: (m: ChatMessage) => ChatMessage) {
    setMessages((prev) => {
      if (prev.length === 0) return prev
      const copy = prev.slice()
      copy[copy.length - 1] = fn(copy[copy.length - 1])
      return copy
    })
  }

  const resetChat = useCallback(() => {
    setMessages([])
    setInput('')
    setUnavailable(false)
    try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  const userCount = messages.filter((m) => m.role === 'user').length
  const atLimit = userCount >= MAX_USER_MESSAGES

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close assistant' : 'Open AI assistant'}
        className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[60] inline-flex items-center gap-2 rounded-pill bg-brand-primary text-surface-canvas pl-4 pr-5 py-3 shadow-[0_8px_24px_rgba(11,27,52,0.28)] hover:opacity-95 active:scale-[0.98] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
      >
        <SparkleIcon className="text-brand-accent" />
        <span className="text-body-sm font-semibold">{open ? 'Close' : 'Ask AI'}</span>
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-x-3 bottom-24 top-16 md:inset-auto md:bottom-24 md:right-6 md:top-auto md:w-[400px] md:h-[600px] z-[60] flex flex-col rounded-2xl border border-border bg-surface-canvas shadow-[0_16px_48px_rgba(11,27,52,0.24)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-subtle bg-surface">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex w-8 h-8 rounded-full bg-brand-accent-soft text-brand-accent items-center justify-center flex-shrink-0">
                <SparkleIcon />
              </span>
              <div className="min-w-0">
                <p className="text-body-sm font-semibold text-ink-primary leading-tight">injector.world assistant</p>
                <p className="text-caption text-ink-tertiary leading-tight">Grounded in our verified data</p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={resetChat}
                  className="text-caption font-medium text-ink-tertiary hover:text-brand-accent px-2 py-1 rounded-lg hover:bg-surface-canvas transition"
                >
                  New chat
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-8 h-8 flex items-center justify-center rounded-full text-ink-tertiary hover:text-ink-primary hover:bg-surface-canvas transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center pt-6">
                <span className="inline-flex w-12 h-12 rounded-full bg-brand-accent-soft text-brand-accent items-center justify-center mb-3">
                  <SparkleIcon className="w-6 h-6" />
                </span>
                <p className="text-body text-ink-primary font-medium mb-1">How can I help?</p>
                <p className="text-body-sm text-ink-secondary mb-4">Find verified injectors or ask about a treatment.</p>
                <div className="flex flex-col gap-2">
                  {POPULAR.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      className="text-left px-3 py-2 rounded-lg border border-border bg-surface-canvas text-body-sm text-ink-primary hover:border-brand-accent hover:bg-surface transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                              onClick={() => setOpen(false)}
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
              <div className="rounded-lg border border-border bg-surface p-3 text-body-sm text-ink-secondary">
                The assistant is not available right now. Please use the search bar at the top of the page to find injectors.
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input) }}
            className="border-t border-border-subtle p-3 bg-surface-canvas"
          >
            {atLimit ? (
              <button
                type="button"
                onClick={resetChat}
                className="w-full rounded-pill bg-brand-primary text-surface-canvas py-2.5 text-body-sm font-semibold hover:opacity-90 transition"
              >
                Start a new chat
              </button>
            ) : (
              <div className="flex items-end gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything..."
                  disabled={busy}
                  className="flex-1 rounded-pill border border-border bg-surface px-4 py-2.5 text-body-sm text-ink-primary placeholder:text-ink-tertiary outline-none focus:border-brand-accent disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-primary text-surface-canvas flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              </div>
            )}
            <p className="text-[11px] text-ink-tertiary mt-2 px-1 leading-snug">
              Educational only, not medical advice. Always consult a licensed provider.
            </p>
          </form>
        </div>
      )}
    </>
  )
}
