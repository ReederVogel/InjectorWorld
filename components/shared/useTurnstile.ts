'use client'

import { useEffect, useRef, useState } from 'react'

export function useTurnstile() {
  const [token, setToken] = useState('')
  /**
   * Whether the visitor has touched this form yet.
   *
   * The Turnstile script is 475KB (measured on staging 2026-09-05: a 384KB XHR
   * plus a 91KB document). It used to load on EVERY page, because the two forms
   * that carry it live in the footer (NewsletterSignup) and on every clinic page
   * (ConsultationForm), and both rendered the widget container unconditionally.
   * That is 475KB spent on a search results page where nobody is subscribing.
   *
   * The script only loads once the container appears, so a caller that renders
   * `<div ref={containerRef} />` behind `engaged` pays nothing until the visitor
   * actually focuses the form. `engage()` is what flips it, and the hook was
   * already built for a container that mounts late (see the note below).
   *
   * Callers that never call engage() behave exactly as before.
   */
  const [engaged, setEngaged] = useState(false)
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

  // Mirrors `token` so waitForToken can read the current value from inside an
  // async submit handler, where the captured state variable would be stale.
  const tokenRef = useRef('')
  useEffect(() => {
    tokenRef.current = token
  }, [token])

  /**
   * Wait for a token, for callers that mount the widget on engagement.
   *
   * Deferring the widget opens a race: paste an email, hit Subscribe, and the
   * challenge may not have produced a token yet. The server rejects a missing
   * token outright (`if (!token) return false` in lib/captcha.ts), so the submit
   * would fail with a CAPTCHA error through no fault of the visitor. Submitting
   * is also the strongest possible signal of engagement, so this engages first
   * and then waits.
   *
   * Returns '' on timeout rather than throwing: the request still goes out and
   * the server still decides, which keeps the failure mode identical to today.
   */
  async function waitForToken(timeoutMs = 8000): Promise<string> {
    if (!siteKey) return ''
    setEngaged(true)
    const start = Date.now()
    while (!tokenRef.current && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 100))
    }
    return tokenRef.current
  }

  // containerRef is the callback ref itself: `<div ref={containerRef} />` works
  // unchanged at every call site, but now also tells us when the node appears.
  return {
    token,
    containerRef: setContainer,
    reset,
    siteKey,
    /** True once the visitor has touched the form. Gate the container on this. */
    engaged,
    /** Call from the form's onFocusCapture to start loading the challenge. */
    engage: () => setEngaged(true),
    waitForToken,
  }
}
