'use client'

import { useEffect, useRef, useState } from 'react'

export function useTurnstile() {
  const [token, setToken] = useState('')
  // A callback ref, not useRef: the widget container is frequently mounted
  // LATER than this hook (RegisterForm only renders it once you pick a role).
  // With a plain ref the effect ran once on mount, found container === null,
  // returned, and never re-ran — so turnstile.render() was never called, no
  // token was produced, and every submit failed with "CAPTCHA verification
  // failed". Tracking the node in state re-runs the effect when it appears.
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const widgetRef = useRef<string | undefined>(undefined)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || typeof window === 'undefined' || !container) return

    const render = () => {
      if (widgetRef.current !== undefined) return
      widgetRef.current = (window as any).turnstile?.render(container, {
        sitekey: siteKey,
        // Invisible unless Cloudflare actually needs the visitor to do
        // something (client request 2026-08-06: the "Success!" box under the
        // newsletter form was noise). The check still runs and still returns a
        // token through the callback below, so bot protection is unchanged.
        appearance: 'interaction-only',
        callback: (t: string) => setToken(t),
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken(''),
      })
    }

    if ((window as any).turnstile) {
      render()
    } else {
      const existing = document.querySelector(
        'script[src*="challenges.cloudflare.com/turnstile"]',
      ) as HTMLScriptElement | null
      if (!existing) {
        const script = document.createElement('script')
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.defer = true
        script.onload = render
        document.head.appendChild(script)
      } else {
        existing.addEventListener('load', render)
      }
    }

    return () => {
      if (widgetRef.current !== undefined && (window as any).turnstile) {
        ;(window as any).turnstile.remove(widgetRef.current)
        widgetRef.current = undefined
      }
    }
  }, [siteKey, container])

  function reset() {
    if (widgetRef.current !== undefined && (window as any).turnstile) {
      ;(window as any).turnstile.reset(widgetRef.current)
    }
    setToken('')
  }

  // containerRef is the callback ref itself: `<div ref={containerRef} />` works
  // unchanged at every call site, but now also tells us when the node appears.
  return { token, containerRef: setContainer, reset, siteKey }
}
